import { useState, useRef, useEffect } from "react";

interface Source {
  index: number;
  title: string;
  video_id: string;
  start: number;
  timestamp: string; // "mm:ss" or "hh:mm:ss", pre-formatted by the backend
  url: string;
}
interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  sources?: Source[];
}

const BG = "#1E2B2F";
const SURFACE = "rgba(36,51,56,0.55)";
const SURFACE2 = "rgba(42,60,66,0.5)";
const BORDER = "rgba(255,255,255,0.06)";
const CORAL = "#FF7F50";
const CORAL_DIM = "rgba(255,127,80,0.12)";
const TEXT = "#e8e0d8";
const TEXT2 = "#8a9a9e";
const TEXT3 = "#4e6166";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const SUGGESTIONS = [
  "What is the sliding window pattern?",
  "How does binary search work?",
  "Explain dynamic programming",
];

const PLAYLIST_URL = "https://youtube.com/playlist?list=PLbJhGqY-mq47k_WLUtzVjmarUm1EuXPj2&si=06M9SwXKZ5BI9Gg7";
const GITHUB_URL = "https://github.com/apkacoderji";

const NO_ANSWER = "I don't know based on the provided information.";

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function SourceChip({ src, active, onSeek }: { src: Source; active: boolean; onSeek: (s: Source) => void }) {
  return (
    <button
      onClick={() => onSeek(src)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 6, cursor: "pointer",
        background: active ? "rgba(255,127,80,0.2)" : CORAL_DIM,
        border: `1px solid ${active ? "rgba(255,127,80,0.5)" : "rgba(255,127,80,0.25)"}`,
        color: CORAL, fontSize: 12, fontFamily: "Outfit, sans-serif",
        fontWeight: 400, transition: "all 0.15s", letterSpacing: "0.01em",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,127,80,0.2)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,127,80,0.5)";
      }}
      onMouseLeave={e => {
        if (active) return;
        (e.currentTarget as HTMLElement).style.background = CORAL_DIM;
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,127,80,0.25)";
      }}
    >
      <span style={{ opacity: 0.7 }}>▶</span>
      <span style={{ fontWeight: 500 }}>{src.timestamp}</span>
      <span style={{ color: TEXT3, margin: "0 1px" }}>·</span>
      <span style={{ color: TEXT2 }}>{truncate(src.title, 34)}</span>
    </button>
  );
}

function renderText(text: string) {
  // backtick code spans, plus [n] citation markers rendered as plain
  // emphasis (the chip row below the bubble is what's actually clickable —
  // this just keeps the inline reference legible)
  return text.split(/(`[^`]+`|\[\d+\])/g).map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} style={{ background: "rgba(255,127,80,0.1)", color: CORAL, padding: "1px 5px", borderRadius: 4, fontSize: "0.9em" }}>{p.slice(1, -1)}</code>;
    }
    if (/^\[\d+\]$/.test(p)) {
      return <span key={i} style={{ color: CORAL, fontSize: "0.85em", fontWeight: 500 }}>{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

function Bubble({ msg, activeKey, onSeek }: { msg: Message; activeKey: string | null; onSeek: (msgId: string, s: Source) => void }) {
  if (msg.role === "user") {
    return (
      <div className="fade-up" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div className="glass-light" style={{
          maxWidth: "72%", padding: "10px 16px", borderRadius: "18px 18px 4px 18px",
          color: TEXT, fontSize: 14, lineHeight: 1.6, fontWeight: 300,
        }}>
          {msg.text}
        </div>
      </div>
    );
  }
  const isNoAnswer = msg.text.trim() === NO_ANSWER;
  return (
    <div className="fade-up" style={{ marginBottom: 20 }}>
      <div className="glass" style={{
        padding: "12px 18px", borderRadius: "4px 18px 18px 18px",
        fontSize: 14, lineHeight: 1.7, color: isNoAnswer ? TEXT2 : TEXT, fontWeight: 300,
        fontStyle: isNoAnswer ? "italic" : "normal",
      }}>
        {msg.text.split("\n").map((line, i) => line.trim()
          ? <p key={i} style={{ margin: "3px 0" }}>{renderText(line)}</p>
          : <br key={i} />
        )}
      </div>
      {msg.sources?.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {msg.sources.map(s => (
            <SourceChip
              key={s.index}
              src={s}
              active={activeKey === `${s.video_id}-${s.start}`}
              onSeek={src => onSeek(msg.id, src)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 24px", userSelect: "none" }}>
      <p style={{ fontSize: 20, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 6, lineHeight: 1 }}>
        <span style={{ color: TEXT }}>D</span>
        <span style={{ color: CORAL }}>S</span>
        <span style={{ color: TEXT }}>A </span>
        <span style={{ color: CORAL }}>R</span>
        <span style={{ color: TEXT }}>EW</span>
        <span style={{ color: CORAL }}>I</span>
        <span style={{ color: TEXT }}>ND</span>
      </p>
      <p style={{ fontSize: 14, color: TEXT3, marginBottom: 36, fontWeight: 300 }}>ask anything. jump to the exact moment.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onPick(s)} style={{
            textAlign: "left", padding: "10px 14px", borderRadius: 8, cursor: "pointer",
            background: "transparent", border: "none",
            color: TEXT2, fontSize: 13, fontFamily: "Outfit, sans-serif",
            fontWeight: 300, transition: "all 0.15s", 
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = TEXT;
              (e.currentTarget as HTMLElement).style.background = CORAL_DIM;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = TEXT2;
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,14,15,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, zIndex: 50,
      }}
    >
      <div
        className="glass fade-up"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 440, width: "100%", padding: "28px 28px 24px",
          borderRadius: 18, border: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: "0.06em" }}>
            <span style={{ color: TEXT }}>about </span>
            <span style={{ color: CORAL }}>DSA REWIND</span>
          </span>
          <button onClick={onClose} aria-label="Close" style={{
            background: "transparent", border: "none", color: TEXT3, fontSize: 18,
            cursor: "pointer", lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>
        <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.7, fontWeight: 300, margin: "0 0 14px" }}>
          This is a <span style={{ color: CORAL }}>RAG (retrieval-augmented generation)</span> project.
          Every answer is generated only from what's actually said in one DSA YouTube playlist —
          nothing is made up, and nothing outside the playlist is used.
        </p>
        <p style={{ fontSize: 14, color: TEXT, lineHeight: 1.7, fontWeight: 300, margin: "0 0 20px" }}>
          If a question isn't covered in the playlist, it says so instead of guessing.
          Each `[n]` next to an answer is a real citation — click it to jump straight to that
          moment in the source video.
        </p>
        <a
          href={PLAYLIST_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "9px 16px", borderRadius: 9, textDecoration: "none",
            background: CORAL_DIM, border: "1px solid rgba(255,127,80,0.3)",
            color: CORAL, fontSize: 13, fontWeight: 500,
          }}
        >
          ▶ Watch the source playlist
        </a>
      </div>
    </div>
  );
}

export default function App() {
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selected, setSelected] = useState<{ videoId: string; videoTitle: string; start: number } | null>(null);
  const [seekKey, setSeekKey] = useState(0);
  const [focusedMsgId, setFocusedMsgId] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Backend keeps history stateless — the frontend resends the last 3 turns
  // with every request, same contract query.py and api.py already share.
  const historyRef = useRef<{ question: string; answer: string }[]>([]);

  const displayed = msgs;
  const messagesWithSources = displayed.filter(m => m.role === "ai" && m.sources?.length);
  const focusedMsg =
    (focusedMsgId && displayed.find(m => m.id === focusedMsgId)) ||
    messagesWithSources[messagesWithSources.length - 1];
  const panelSources: Source[] = focusedMsg?.sources ?? [];
  const activeKey = selected ? `${selected.videoId}-${selected.start}` : null;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [displayed, loading]);

  const selectSource = (msgId: string, s: Source) => {
    setFocusedMsgId(msgId);
    setSelected({ videoId: s.video_id, videoTitle: s.title, start: s.start });
    setSeekKey(k => k + 1);
    if (window.innerWidth < 768) document.getElementById("vpanel")?.scrollIntoView({ behavior: "smooth" });
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: q };
    setMsgs(m => [...m, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          history: historyRef.current,
          top_k: 5,
        }),
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();

      const sources: Source[] = (data.sources || []).map((s: any) => ({
        index: s.index,
        title: s.title,
        video_id: s.video_id,
        start: s.start,
        timestamp: s.timestamp,
        url: s.url,
      }));

      const answer: string = data.answer ?? "No answer returned.";
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", text: answer, sources };
      setMsgs(m => [...m, aiMsg]);

      historyRef.current = [...historyRef.current, { question: q, answer }].slice(-3);

      setFocusedMsgId(aiMsg.id);
      if (sources.length) {
        setSelected({ videoId: sources[0].video_id, videoTitle: sources[0].title, start: sources[0].start });
        setSeekKey(k => k + 1);
      }
    } catch (err) {
      setMsgs(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: "ai",
        text: `Couldn't reach the backend at ${API_BASE}. Make sure api.py is running (uvicorn api:app --reload --port 8000) and try again.`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const embedSrc = selected
    ? `https://www.youtube.com/embed/${selected.videoId}?start=${Math.floor(selected.start)}&autoplay=1&rel=0&modestbranding=1`
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: BG, fontFamily: "Outfit, sans-serif" }}>

      {/* Header */}
      <header className="glass" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 62, flexShrink: 0,
      }}>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", lineHeight: 1 }}>
          <span style={{ color: TEXT }}>D</span>
          <span style={{ color: CORAL }}>S</span>
          <span style={{ color: TEXT }}>A </span>
          <span style={{ color: CORAL }}>R</span>
          <span style={{ color: TEXT }}>EW</span>
          <span style={{ color: CORAL }}>I</span>
          <span style={{ color: TEXT }}>ND</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setAboutOpen(true)} style={{
            padding: "4px 12px", borderRadius: 6, background: "transparent", border: "none",
            color: TEXT3, fontSize: 13, fontFamily: "Outfit, sans-serif", fontWeight: 300,
            cursor: "pointer", transition: "color 0.15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>about</button>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            style={{ padding: "4px 10px", borderRadius: 6, color: TEXT3, fontSize: 13, textDecoration: "none", fontWeight: 300, transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT3)}>github</a>
        </div>
      </header>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}

      {/* Body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "row" }} className="flex-col-mobile">

        {/* Chat */}
        <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="scroll-area" style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            {displayed.length === 0 && !loading
              ? <EmptyState onPick={s => { setInput(s); inputRef.current?.focus(); }} />
              : <>
                {displayed.map(m => <Bubble key={m.id} msg={m} activeKey={activeKey} onSeek={selectSource} />)}
                {loading && (
                  <div className="fade-up" style={{ display: "flex", gap: 6, alignItems: "center", padding: "12px 0" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className={`dot${i + 1}`} style={{ width: 6, height: 6, borderRadius: "50%", background: CORAL, display: "inline-block" }} />
                    ))}
                    <span style={{ fontSize: 12, color: TEXT3, marginLeft: 6, fontWeight: 300 }}>searching your library…</span>
                  </div>
                )}
                <div ref={endRef} />
              </>
            }
          </div>

          {/* Input */}
          <div className="glass" style={{ padding: "16px 24px", flexShrink: 0 }}>
            <div className="glass-light" style={{
              display: "flex", alignItems: "center", gap: 10,
              borderRadius: 16, padding: "9px 14px",
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder="ask a dsa doubt…"
                disabled={loading}
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: TEXT, fontSize: 14, fontFamily: "Outfit, sans-serif",
                  fontWeight: 300, caretColor: CORAL,
                }}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading} style={{
                width: 32, height: 32, borderRadius: 10, border: "none",
                background: input.trim() && !loading ? CORAL : "rgba(255,127,80,0.15)",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s", flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke={input.trim() && !loading ? "#1E2B2F" : CORAL} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Video panel */}
        <div id="vpanel" className="glass" style={{ flex: "0 0 40%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Mobile toggle */}
          <button
            onClick={() => setVideoOpen(v => !v)}
            style={{
              display: "none", width: "100%", padding: "12px 20px",
              background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`,
              color: TEXT2, fontSize: 13, fontFamily: "Outfit, sans-serif",
              cursor: "pointer", textAlign: "left",
            }}
            className="mobile-toggle"
          >
            {videoOpen ? "▾ video" : "▸ video"}
          </button>

          <div className={`scroll-area vpanel-content${videoOpen ? "" : " vpanel-hidden"}`} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {/* Player */}
            {embedSrc ? (
              <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", borderRadius: 16, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                <iframe
                  key={`${selected?.videoId}-${selected?.start}-${seekKey}`}
                  src={embedSrc}
                  title={selected?.videoTitle || "video"}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            ) : (
              <div style={{
                width: "100%", paddingBottom: "56.25%", borderRadius: 16, position: "relative",
                border: `1px dashed ${BORDER}`, background: "rgba(255,255,255,0.02)",
              }}>
                <div style={{
                  position: "absolute", inset: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", padding: 24, textAlign: "center",
                }}>
                  <p style={{ fontSize: 13, color: TEXT3, fontWeight: 300, lineHeight: 1.6 }}>
                    Ask a question — the clip that answers it will play here.
                  </p>
                </div>
              </div>
            )}

            {/* Now playing */}
            <div style={{ marginTop: 12, paddingBottom: 16 }}>
              <p style={{ fontSize: 11, color: TEXT3, marginBottom: 3, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" }}>now playing</p>
              <p style={{ fontSize: 13, color: TEXT, fontWeight: 400, lineHeight: 1.4 }}>
                {selected ? selected.videoTitle : "—"}
              </p>
            </div>

            {/* Sources for the focused answer */}
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, color: TEXT3, marginBottom: 10, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                sources
              </p>
              {panelSources.length === 0 ? (
                <p style={{ fontSize: 12.5, color: TEXT3, fontWeight: 300, lineHeight: 1.6 }}>
                  The clips behind your last answer will show up here.
                </p>
              ) : panelSources.map(s => {
                const isActive = activeKey === `${s.video_id}-${s.start}`;
                return (
                  <button key={s.index} onClick={() => focusedMsg && selectSource(focusedMsg.id, s)} style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%",
                    padding: "9px 10px", borderRadius: 7, marginBottom: 2, cursor: "pointer",
                    background: isActive ? CORAL_DIM : "transparent",
                    border: "none",
                    transition: "all 0.15s", textAlign: "left",
                  }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = `rgba(255,255,255,0.03)`; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: 5, background: isActive ? CORAL_DIM : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <polygon points="1.5,1 8,4.5 1.5,8" fill={isActive ? CORAL : TEXT3} />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: isActive ? TEXT : TEXT2, fontWeight: isActive ? 400 : 300, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: TEXT3 }}>{s.timestamp}</span>
                        <span style={{ fontSize: 10, color: isActive ? CORAL : TEXT3, background: isActive ? CORAL_DIM : "transparent", padding: "0 5px", borderRadius: 3 }}>[{s.index}]</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .flex-col-mobile { flex-direction: column !important; }
          #vpanel { order: -1; flex: 0 0 auto !important; }
          .mobile-toggle { display: flex !important; }
          .vpanel-hidden { display: none !important; }
        }
        input::placeholder { color: ${TEXT3}; }
      `}</style>
    </div>
  );
}
