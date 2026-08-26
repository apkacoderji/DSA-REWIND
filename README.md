# DSA Rewind

DSA Rewind is a RAG-powered chatbot that answers Data Structures & Algorithms questions using a curated YouTube playlist as its knowledge source. Instead of just giving a text answer, it points you to the exact moment in the video where the concept is explained — with a clickable timestamp that jumps straight to that point in the same player.

## Features

- 🔍 **Ask DSA questions in natural language** — get answers grounded in real lecture content, not hallucinated explanations
- ⏱️ **Clickable timestamps** — jump directly to the relevant part of the video, right inside the same player (no new tab)
- 📚 **RAG pipeline** — transcripts from an entire YouTube playlist are ingested, chunked, and embedded for retrieval
- 🤖 **Multi-provider LLM support** — built to work with Gemini, DeepSeek, and Mistral

## Tech Stack

**Backend**
- Python
- FastAPI-style API (`api.py`)
- Qdrant for vector storage/retrieval
- `uv` for dependency management

**Frontend**
- React + TypeScript
- Vite
- pnpm

## Project Structure

```
DSA-REWIND/
├── Backend/
│   ├── api.py            # API entrypoint
│   ├── ingest.py         # Ingests & indexes YouTube transcripts
│   ├── rag_core.py        # Core RAG logic (retrieval + generation)
│   ├── query.py           # Query handling
│   ├── transcripts/       # Indexed video transcripts (JSON)
│   ├── indexed_videos.json
│   └── pyproject.toml
└── Frontend/
    ├── src/
    │   ├── App.tsx
    │   └── main.tsx
    ├── index.html
    └── package.json
```

## Getting Started

### Prerequisites
- Python 3.10+ and [uv](https://github.com/astral-sh/uv)
- Node.js and [pnpm](https://pnpm.io/)
- A running Qdrant instance (local or cloud)

### Backend Setup

```bash
cd Backend
uv sync
```

Create a `.env` file inside `Backend/` with your API keys:

```
GEMINI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
MISTRAL_API_KEY=your_key_here
```

Ingest the playlist transcripts:

```bash
uv run ingest.py
```

Run the API:

```bash
uv run api.py
```

### Frontend Setup

```bash
cd Frontend
pnpm install
pnpm dev
```

## How It Works

1. **Ingestion** — Transcripts from a DSA YouTube playlist are pulled, chunked, and embedded into a Qdrant vector store, along with their timestamps.
2. **Query** — When a user asks a question, the query is embedded and matched against the stored chunks to retrieve the most relevant segments.
3. **Generation** — An LLM (Gemini/DeepSeek/Mistral) uses the retrieved context to generate an answer.
4. **Playback** — The frontend surfaces the matching timestamp(s) as clickable links that seek the embedded video player directly to that point.

## Roadmap

- [ ] Add support for more playlists/sources
- [ ] Improve chunking strategy for long lecture transcripts
- [ ] Add conversation history / follow-up question support

## Author

Built by [Shubham](https://github.com/apkacoderji)
