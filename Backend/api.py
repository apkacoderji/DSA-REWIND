# ============================================================
# api.py — web backend for the frontend
# ============================================================
#
# Stateless on purpose: the frontend sends its own recent chat history
# back with each request instead of this server keeping session state
# in memory. That means this can be deployed as a plain HTTP service —
# no sticky sessions, nothing lost if the process restarts, and it
# scales to multiple instances without needing a shared session store.
#
# Run locally:   uv run uvicorn api:app --reload --port 8000
# Docs UI:       http://localhost:8000/docs

import os
from typing import List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag_core import ask, fmt_time, youtube_link

app = FastAPI(title="Personal Learning Assistant API")

# Comma-separated list of frontend origins allowed to call this API, e.g.
#   ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173
# Defaults to "*" (any origin) for local development only. Set this env
# var before deploying publicly — "*" means any website's JS could call
# your API from a visitor's browser.
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Turn(BaseModel):
    question: str
    answer: str


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1)
    # Frontend sends back its own recent turns (e.g. last 3 chat bubbles).
    # This server never stores conversation state itself.
    history: Optional[List[Turn]] = None
    top_k: int = Field(default=5, ge=1, le=10)


class Source(BaseModel):
    index: int
    title: str
    video_id: str
    start: float          # raw seconds — this is what the frontend passes
    timestamp: str        # "12:34" — for display
    url: str              # plain youtu.be link — fallback if not embedding a player


class AskResponse(BaseModel):
    answer: str
    sources: List[Source]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
def ask_endpoint(req: AskRequest):
    history_pairs = [(t.question, t.answer) for t in (req.history or [])][-3:]

    answer, results = ask(req.question, history=history_pairs, top_k=req.top_k)

    sources = [
        Source(
            index=i,
            title=r.payload["title"],
            video_id=r.payload["video_id"],
            start=r.payload["start"],
            timestamp=fmt_time(r.payload["start"]),
            url=youtube_link(r.payload["video_id"], r.payload["start"]),
        )
        for i, r in enumerate(results, 1)
    ]

    return AskResponse(answer=answer, sources=sources)
