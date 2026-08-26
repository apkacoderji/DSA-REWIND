# ============================================================
# ingest.py — run this ONLY when you add/change transcripts
# ============================================================
#
# This script's only job is: read transcripts -> clean them -> chunk them -> embed new ones -> upload.
# Ask questions from query.py instead.

import os
import glob
import json
import time
import hashlib

from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, PayloadSchemaType
from qdrant_client.http.exceptions import ResponseHandlingException
from sentence_transformers import SentenceTransformer

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

COLLECTION_NAME = "youtube_transcripts"
EMBEDDING_SIZE = 384
TRANSCRIPT_FOLDER = "transcripts"
MANIFEST_PATH = "indexed_videos.json"  # tracks which video_ids are already in Qdrant

CHUNK_WINDOW_SECONDS = 45
CHUNK_MAX_CHARS = 800
CHUNK_OVERLAP_SECONDS = 8  # roughly how much of the last sentence carries into the next chunk

# Cloud Qdrant will drop the connection on one giant upsert (thousands of
# vectors + payload text in a single HTTP request). Upload in small batches
# instead, with a couple of retries for transient network resets.
UPSERT_BATCH_SIZE = 100
UPSERT_MAX_RETRIES = 3

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)


def ensure_collection():
    """Only create the collection if it doesn't exist. Never auto-delete."""
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_SIZE, distance=Distance.COSINE),
        )
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="video_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )
        print(f"Created collection: {COLLECTION_NAME}")
    else:
        print(f"Collection already exists: {COLLECTION_NAME} (not touching existing data)")


def load_manifest():
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            return set(json.load(f))
    return set()


def save_manifest(video_ids):
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted(video_ids), f, indent=2)


def dedupe_segments(segments):
    """
    Whisper loops on silence / repetitive audio and outputs the exact
    same sentence back-to-back, sometimes 5-10 times in a row (you'll
    see this in your own transcripts, e.g. "Entry-level jobs were 80%
    less..." repeated 7 times). If that goes straight into a chunk, it
    gets embedded as if it were real signal, and can get retrieved and
    cited as a "source" for a completely unrelated question. This
    collapses consecutive duplicate segments into one before chunking.
    """
    cleaned = []
    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        if cleaned and cleaned[-1]["text"].strip().lower() == text.lower():
            # same sentence repeated — just extend the timespan we keep,
            # don't add a second copy of the text
            cleaned[-1]["end"] = seg["end"]
            continue
        cleaned.append({"start": seg["start"], "end": seg["end"], "text": text})
    return cleaned


def chunk_segments(video):
    """
    Merge whisper segments into ~45s windows (same idea as before), but:
    - runs on deduped segments, so hallucinated loops don't pollute a chunk
    - carries the last sentence of a chunk into the start of the next one,
      so a sentence that straddles a chunk boundary doesn't lose context
    """
    video_id = video["video_id"]
    title = video.get("title", "")
    segments = dedupe_segments(video["segments"])

    chunks = []
    buf_text, buf_start, buf_end = [], None, None

    def flush():
        if buf_text:
            chunks.append({
                "video_id": video_id,
                "title": title,
                "start": buf_start,
                "end": buf_end,
                "text": " ".join(buf_text).strip(),
            })

    for seg in segments:
        if buf_start is None:
            buf_start = seg["start"]
        buf_text.append(seg["text"])
        buf_end = seg["end"]

        covered = buf_end - buf_start
        char_len = sum(len(t) for t in buf_text)

        if covered >= CHUNK_WINDOW_SECONDS or char_len >= CHUNK_MAX_CHARS:
            flush()
            overlap_text = buf_text[-1] if buf_text else None
            buf_text = [overlap_text] if overlap_text else []
            buf_start = (buf_end - CHUNK_OVERLAP_SECONDS) if overlap_text else None
            buf_end = None

    flush()
    return chunks


def stable_point_id(video_id, start):
    """
    Deterministic ID derived from (video_id, start time) instead of a
    running counter. This means re-running ingest never creates duplicate
    points for the same chunk, and IDs don't shift around based on
    filesystem glob order.
    """
    digest = hashlib.sha256(f"{video_id}_{start}".encode()).hexdigest()
    return int(digest, 16) % (10 ** 12)


def upsert_in_batches(points):
    """
    Upload in small batches instead of one massive request. Retries a
    batch a few times with backoff if the connection gets reset —
    Qdrant Cloud does this occasionally under load, and it's transient.
    """
    for i in range(0, len(points), UPSERT_BATCH_SIZE):
        batch = points[i:i + UPSERT_BATCH_SIZE]
        for attempt in range(1, UPSERT_MAX_RETRIES + 1):
            try:
                client.upsert(collection_name=COLLECTION_NAME, points=batch)
                break
            except ResponseHandlingException as e:
                if attempt == UPSERT_MAX_RETRIES:
                    raise
                wait = 2 ** attempt
                print(f"  batch {i // UPSERT_BATCH_SIZE + 1} failed ({e}), retrying in {wait}s...")
                time.sleep(wait)
        print(f"  uploaded {min(i + UPSERT_BATCH_SIZE, len(points))}/{len(points)} points")


def main():
    ensure_collection()
    indexed = load_manifest()

    pending_videos = []
    for path in glob.glob(os.path.join(TRANSCRIPT_FOLDER, "*.json")):
        with open(path, "r", encoding="utf-8") as f:
            video = json.load(f)
        if video["video_id"] not in indexed:
            pending_videos.append(video)

    if not pending_videos:
        print("Nothing new to index — every transcript is already in Qdrant.")
        return

    print(f"Found {len(pending_videos)} new video(s) to index.")

    model = SentenceTransformer("all-MiniLM-L6-v2")

    # Process one video at a time and save the manifest after each one
    # finishes uploading. If something fails on video 80, videos 1-79
    # are already safely in Qdrant and won't be re-embedded on retry.
    for n, video in enumerate(pending_videos, 1):
        video_id = video["video_id"]
        chunks = chunk_segments(video)
        if not chunks:
            indexed.add(video_id)
            save_manifest(indexed)
            continue

        print(f"[{n}/{len(pending_videos)}] {video.get('title', video_id)} — {len(chunks)} chunk(s)")

        texts = [c["text"] for c in chunks]
        embeddings = model.encode(texts, show_progress_bar=False)

        points = [
            PointStruct(id=stable_point_id(c["video_id"], c["start"]), vector=vec.tolist(), payload=c)
            for c, vec in zip(chunks, embeddings)
        ]

        upsert_in_batches(points)

        indexed.add(video_id)
        save_manifest(indexed)  # persist progress immediately, not just at the very end

    print(f"Done. Indexed {len(pending_videos)} video(s).")


if __name__ == "__main__":
    main()