# ============================================================
# query.py — CLI chat loop
# ============================================================
#
# All retrieval/prompting logic lives in rag_core.py so the CLI and the
# web API (api.py) never drift out of sync. This file only handles the
# terminal loop and formatting results as text.

from rag_core import ask, fmt_time, youtube_link


def format_sources(results):
    if not results:
        return "(none cleared the relevance threshold)"
    return "\n".join(
        f"[{i}] {r.payload['title']} @ {fmt_time(r.payload['start'])} - "
        f"{youtube_link(r.payload['video_id'], r.payload['start'])}"
        for i, r in enumerate(results, 1)
    )


def run_repl():
    print("Type 'exit' or 'quit' to stop.\n")
    history = []  # list of (question, answer) — capped, see below

    while True:
        question = input("Ask a question: ").strip()
        if not question:
            continue
        if question.lower() in ("exit", "quit"):
            break

        answer, results = ask(question, history=history)
        print("\nAnswer:\n" + answer)
        print("\nSources:\n" + format_sources(results))
        print()

        history.append((question, answer))
        history = history[-3:]  # only the last 3 exchanges — enough for follow-ups,
                                 # not enough to quietly bloat every prompt going forward


if __name__ == "__main__":
    run_repl()
