# ============================================================
# rag_core.py — the actual RAG pipeline, shared by every surface
# ============================================================
#
# query.py (CLI) and api.py (web backend) both import from here.
# Retrieval, the anti-hallucination threshold, the prompt, and citation
# cleanup live in exactly one place change the pipeline once, both
# surfaces pick it up. Neither file re-implements any of this.

import os
import re
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
from groq import Groq

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

COLLECTION_NAME = "youtube_transcripts"

# Chunks scoring below this are treated as "not actually relevant" and
# dropped before they ever reach the LLM. This is the single biggest
# lever against hallucination here: the model can't invent a confident
# answer from a weakly-related chunk if that chunk is never in its context.
MIN_SCORE = 0.35

client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

print("Loading embedding model...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("Ready.\n")


def fmt_time(seconds):
    seconds = int(seconds)
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def youtube_link(video_id, start):
    return f"https://youtu.be/{video_id}?t={int(start)}"


def search(query, top_k=5):
    query_vector = model.encode(query).tolist()
    results = client.query_points(
        collection_name=COLLECTION_NAME,
        query=query_vector,
        limit=top_k,
        with_payload=True,
    ).points
    return [r for r in results if r.score >= MIN_SCORE]


def build_context(results):
    return "\n\n".join(
        f"[{i}] ({r.payload['title']} @ {fmt_time(r.payload['start'])})\n{r.payload['text']}"
        for i, r in enumerate(results, 1)
    )


def normalize_citations(text):
    """
    gpt-oss-120b sometimes ignores the requested [n] format and emits its
    own bracket-star annotation style instead, e.g. 【5】 or 【1†L1-L9】.
    Those don't match the [n] numbering in the returned sources list, so
    collapse them back to plain [n] regardless of what's inside the marks.
    """
    return re.sub(r"【(\d+)[^】]*】", r"[\1]", text)


def ask_llm(question, context, history=None):
    if not context.strip():
        # nothing cleared the relevance bar — don't even call the LLM,
        # there's nothing honest it could say
        return "I don't know based on the provided information."

    system_prompt = (
        "You are a study assistant. Answer ONLY using the excerpts given below.\n"
        "Rules:\n"
        "1. Do not use outside knowledge, even if you're confident about the answer.\n"
        "2. Every claim must cite the excerpt tag it came from, like [1] or [2].\n"
        "3. If the excerpts only partially answer the question, say what's missing "
        "instead of filling the gap yourself.\n"
        "4. If none of the excerpts are actually relevant, reply exactly: "
        "\"I don't know based on the provided information.\"\n"
        "5. Prior conversation turns (if shown) are for understanding follow-up "
        "phrasing ONLY — they are not a source of facts and must not be cited or "
        "treated as verified. Every claim must still trace back to an excerpt tag."
    )

    history_block = ""
    if history:
        history_block = "\n\nPrevious conversation (context only, not a source):\n" + "\n".join(
            f"Q: {q}\nA: {a}" for q, a in history
        )

    user_prompt = f"Excerpts:\n{context}{history_block}\n\nQuestion: {question}"

    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-120b",
        temperature=1,  # deterministic — no creative drift on repeated questions
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return normalize_citations(response.choices[0].message.content)


def ask(question, history=None, top_k=5):
    """
    Returns (answer, results) — results is the filtered list of Qdrant
    ScoredPoint objects, NOT a pre-formatted string. Callers (CLI prints
    plain text, API returns JSON) format results however they need.
    """
    # Retrieval ALWAYS runs fresh against the actual question — history is
    # never a substitute for search, only a way to help phrase the search.
    # Folding the previous question in helps a vague follow-up ("explain
    # that more", "what about the recursive one") still retrieve the right
    # chunks, without ever skipping retrieval itself.
    retrieval_query = question
    if history:
        last_q, _ = history[-1]
        retrieval_query = f"{last_q} {question}"

    results = search(retrieval_query, top_k=top_k)
    context = build_context(results)
    answer = ask_llm(question, context, history=history)

    return answer, results
