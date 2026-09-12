import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import {
  Navigation, Plus, Trash2, Send, Copy, Check,
  Loader2, MessageSquare, ChevronRight, Sparkles, User,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { format, parseISO, isValid, isToday, isYesterday } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('bdvv_token');
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    ...opts,
    credentials: 'include',   // still send the httpOnly cookie when the browser allows it
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res;
}

function groupSessionsByDate(sessions) {
  const groups = { today: [], yesterday: [], older: [] };
  for (const s of sessions) {
    try {
      const d = parseISO(s.updated_at);
      if (isToday(d)) groups.today.push(s);
      else if (isYesterday(d)) groups.yesterday.push(s);
      else groups.older.push(s);
    } catch {
      groups.older.push(s);
    }
  }
  return groups;
}

// ── Streaming message cursor ──────────────────────────────────────────────────
function StreamCursor() {
  return (
    <span
      className="inline-block w-[2px] h-4 ml-0.5 align-middle animate-pulse"
      style={{ backgroundColor: 'var(--cta)', verticalAlign: 'text-bottom' }}
    />
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      style={{ color: 'var(--app-muted)' }}
      title="Copy"
      data-testid="copy-message-btn"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, isStreaming }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} group`}
      data-testid={`message-bubble-${isUser ? 'user' : 'assistant'}`}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md"
        style={{
          background: isUser
            ? 'linear-gradient(135deg, var(--surface-2), #2a3d6b)'
            : 'linear-gradient(135deg, #e8a830, #c9871a)',
          color: isUser ? 'var(--app-fg)' : '#0e1c36',
          border: `1px solid ${isUser ? 'var(--stroke)' : 'rgba(232,168,48,0.4)'}`,
        }}
      >
        {isUser ? <User className="w-4 h-4" /> : <Navigation className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm relative"
          style={{
            background: isUser
              ? 'linear-gradient(135deg, rgba(232,168,48,0.18), rgba(201,135,26,0.12))'
              : 'var(--surface-2)',
            border: `1px solid ${isUser ? 'rgba(232,168,48,0.30)' : 'var(--stroke)'}`,
            color: 'var(--app-fg)',
            borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          }}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="compass-md prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1" style={{ color: 'var(--cta)' }}>{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1" style={{ color: 'var(--cta)' }}>{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5" style={{ color: 'var(--app-fg)' }}>{children}</h3>,
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--cta)' }}>{children}</strong>,
                  em: ({ children }) => <em className="italic" style={{ color: 'var(--app-muted)' }}>{children}</em>,
                  ul: ({ children }) => <ul className="ml-4 mb-2 space-y-0.5 list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="ml-4 mb-2 space-y-0.5 list-decimal">{children}</ol>,
                  li: ({ children }) => (
                    <li className="flex items-start gap-1.5 text-sm">
                      <span style={{ color: 'var(--cta)' }} className="mt-1 flex-shrink-0">·</span>
                      <span>{children}</span>
                    </li>
                  ),
                  code: ({ inline, children }) => inline
                    ? <code className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ backgroundColor: 'rgba(232,168,48,0.12)', color: 'var(--cta)' }}>{children}</code>
                    : <pre className="p-3 rounded-lg overflow-x-auto text-[11px] font-mono mt-2 mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: '#e2e8f0' }}><code>{children}</code></pre>,
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="w-full text-xs border-collapse">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold border-b" style={{ borderColor: 'var(--stroke)', color: 'var(--cta)' }}>{children}</th>,
                  td: ({ children }) => <td className="px-3 py-1.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'var(--app-fg)' }}>{children}</td>,
                  blockquote: ({ children }) => (
                    <blockquote className="pl-3 my-2 italic" style={{ borderLeft: '2px solid var(--cta)', color: 'var(--app-muted)' }}>{children}</blockquote>
                  ),
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--cta)' }}>{children}</a>,
                  hr: () => <hr className="my-3" style={{ borderColor: 'var(--stroke)' }} />,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <StreamCursor />}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isStreaming && (
          <div className="flex items-center gap-1 px-1">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Thinking indicator ────────────────────────────────────────────────────────
function ThinkingIndicator() {
  return (
    <div className="flex gap-3" data-testid="thinking-indicator">
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-md"
        style={{ background: 'linear-gradient(135deg, #e8a830, #c9871a)' }}
      >
        <Navigation className="w-4 h-4 text-[#0e1c36]" />
      </div>
      <div
        className="px-4 py-3 rounded-2xl flex items-center gap-2 text-sm"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--stroke)',
          borderRadius: '4px 18px 18px 18px',
          color: 'var(--app-muted)',
        }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--cta)' }} />
        <span className="text-xs">Compass is thinking…</span>
      </div>
    </div>
  );
}

// ── Welcome Screen ────────────────────────────────────────────────────────────
function WelcomeScreen({ onSuggestion }) {
  const services = [
    { icon: '✈️', label: 'Flights', text: 'I need to book flights' },
    { icon: '🏨', label: 'Hotel', text: 'I need to find a hotel' },
    { icon: '🛂', label: 'Visa', text: 'I need help with a visa application' },
    { icon: '📘', label: 'Passport', text: 'I need passport application help' },
    { icon: '🗺️', label: 'Tours', text: 'I need tours and a tour guide' },
    { icon: '📦', label: 'Tour Package', text: 'I need a complete tour package' },
    { icon: '💼', label: 'Quotation', text: 'I need to build a tour quotation' },
    { icon: '⚖️', label: 'Compare', text: 'I want to compare prices and options' },
    { icon: '🌍', label: 'Destination', text: 'Help me find the right destination' },
    { icon: '🛡️', label: 'Insurance', text: 'I need travel insurance options' },
    { icon: '👤', label: 'Tour Manager', text: 'I need a tour manager for a group' },
  ];

  const agentSuggestions = [
    { icon: '📧', text: 'Draft a follow-up email for a cold lead who hasn\'t responded in 5 days' },
    { icon: '📋', text: 'Summarise my current pipeline and list overdue follow-ups' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 py-8" data-testid="welcome-screen">
      {/* Logo */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #e8a830, #c9871a)' }}
      >
        <Navigation className="w-7 h-7 text-[#0e1c36]" />
      </div>
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--app-fg)', fontFamily: 'Montserrat, sans-serif' }}>
        Good day! I'm <span style={{ color: 'var(--cta)' }}>Compass</span>
      </h2>
      <p className="text-sm mb-1" style={{ color: 'var(--app-muted)' }}>
        Your AI Travel Planning Assistant — Blue Diamond Voyage & Vision
      </p>
      <p className="text-xs mb-5 max-w-lg" style={{ color: 'var(--app-muted)', opacity: 0.7 }}>
        Tell me which service you need, or tap a quick-start below. I'll run a dedicated question flow, browse live sources, and build a verified result for your review.
      </p>

      {/* Service picker grid */}
      <div className="w-full max-w-2xl mb-5">
        <p className="text-[9px] uppercase tracking-[0.25em] font-semibold mb-2.5 text-left" style={{ color: 'var(--app-muted)', opacity: 0.55 }}>
          Start a service enquiry
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {services.map((s) => (
            <button
              key={s.label}
              onClick={() => onSuggestion(s.text)}
              className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl text-center text-xs transition-all duration-150"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--stroke)',
                color: 'var(--app-fg)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(232,168,48,0.45)';
                e.currentTarget.style.background = 'rgba(232,168,48,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--stroke)';
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              data-testid={`service-chip-${s.label}`}
            >
              <span className="text-lg leading-none">{s.icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--app-muted)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Agent / internal suggestions */}
      <div className="w-full max-w-2xl">
        <p className="text-[9px] uppercase tracking-[0.25em] font-semibold mb-2 text-left" style={{ color: 'var(--app-muted)', opacity: 0.55 }}>
          Internal tools
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {agentSuggestions.map((s, i) => (
            <button
              key={s.icon}
              onClick={() => onSuggestion(s.text)}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs transition-all duration-150"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--stroke)',
                color: 'var(--app-fg)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(232,168,48,0.4)';
                e.currentTarget.style.background = 'rgba(232,168,48,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--stroke)';
                e.currentTarget.style.background = 'var(--surface-2)';
              }}
              data-testid={`agent-chip-${i}`}
            >
              <span className="text-base flex-shrink-0 mt-0.5">{s.icon}</span>
              <span style={{ color: 'var(--app-muted)' }}>{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Session Item ──────────────────────────────────────────────────────────────
function SessionItem({ session, isActive, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-xs group transition-all duration-100"
      style={{
        background: isActive
          ? 'rgba(232,168,48,0.12)'
          : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: isActive ? '1px solid rgba(232,168,48,0.25)' : '1px solid transparent',
        color: isActive ? 'var(--cta)' : 'var(--app-muted)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      data-testid={`session-item-${session.id}`}
    >
      <MessageSquare className="w-3 h-3 flex-shrink-0" />
      <span className="flex-1 truncate font-medium">{session.title}</span>
      {(hovered || isActive) && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(session.id); }}
          className="flex-shrink-0 p-0.5 rounded hover:text-red-400 transition-colors"
          title="Delete"
          data-testid={`delete-session-${session.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Pre-fill input from Dashboard Compass Command Bar navigation
  useEffect(() => {
    const q = location?.state?.initialQuery;
    if (q) {
      setInput(q);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [location?.state?.initialQuery]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/ai/sessions');
      const data = await res.json();
      setSessions(data || []);
    } catch (e) {
      console.warn('[AIAssistant] Failed to load sessions:', e);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const loadMessages = useCallback(async (sessionId) => {
    if (!sessionId) { setMessages([]); return; }
    setLoadingMessages(true);
    try {
      const res = await apiFetch(`/ai/sessions/${sessionId}/messages`);
      const data = await res.json();
      setMessages(data || []);
    } catch {
      toast.error('Failed to load conversation');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { loadMessages(activeSessionId); }, [activeSessionId, loadMessages]);

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setStreamingText('');
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (id) => {
    try {
      await apiFetch(`/ai/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        setActiveSessionId(null);
        setMessages([]);
      }
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const handleSend = useCallback(async (overrideMsg) => {
    const msg = (overrideMsg || input).trim();
    if (!msg || isStreaming) return;
    setInput('');

    // Add user message to UI immediately
    const tempId = `tmp-${Date.now()}`;
    const userMsg = { id: tempId, role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    setIsStreaming(true);
    setStreamingText('');

    let accumulated = '';
    let newSessionId = activeSessionId;

    try {
      const authToken = localStorage.getItem('bdvv_token');
      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        credentials: 'include',   // still send the httpOnly cookie when the browser allows it
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ session_id: activeSessionId, message: msg }),
        signal: abortRef.current,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          // Parse JSON separately so syntax errors don't swallow real stream errors
          let evt;
          try {
            evt = JSON.parse(line.slice(6));
          } catch (e) {
            console.warn('[AIAssistant] Skipping malformed SSE JSON:', e);
            continue;
          }
          // Handle each event type — errors thrown here propagate to the outer catch
          if (evt.type === 'session_id') {
            newSessionId = evt.session_id;
            if (!activeSessionId) {
              setActiveSessionId(evt.session_id);
              await loadSessions();
            }
          } else if (evt.type === 'delta') {
            accumulated += evt.content;
            setStreamingText(accumulated);
          } else if (evt.type === 'done') {
            const aiMsg = { id: evt.message_id, role: 'assistant', content: accumulated };
            setMessages(prev => [...prev, aiMsg]);
            setStreamingText('');
            await loadSessions();
          } else if (evt.type === 'error') {
            // Backend signalled a stream-level error — throw so outer catch handles it
            throw new Error(evt.message || 'Compass encountered an error');
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        const msg = err.message && !err.message.startsWith('HTTP')
          ? `Compass: ${err.message}`
          : 'Compass failed to respond. Please try again.';
        toast.error(msg);
        setStreamingText('');
        // Remove the temp user message on hard failure
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, activeSessionId, loadSessions]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const grouped = groupSessionsByDate(sessions);

  return (
    <div
      className="-mx-6 -my-5 flex overflow-hidden"
      style={{ height: 'calc(100vh - 56px - 28px)', backgroundColor: 'var(--app-bg)' }}
      data-testid="ai-assistant-page"
    >
      {/* ── Sessions Sidebar ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="w-60 flex-shrink-0 flex flex-col border-r overflow-hidden"
          style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--stroke)' }}
          data-testid="sessions-sidebar"
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--stroke)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #e8a830, #c9871a)' }}
              >
                <Navigation className="w-3.5 h-3.5 text-[#0e1c36]" />
              </div>
              <span className="text-xs font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Montserrat, sans-serif' }}>Compass</span>
            </div>
            <button
              onClick={handleNewChat}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--app-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(232,168,48,0.1)'; e.currentTarget.style.color = 'var(--cta)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--app-muted)'; }}
              title="New chat"
              data-testid="new-chat-btn"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Session list */}
          <ScrollArea className="flex-1 px-2 py-2">
            {sessions.length === 0 ? (
              <p className="text-[10px] text-center py-6" style={{ color: 'var(--app-muted)', opacity: 0.5 }}>
                No conversations yet
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.today.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold px-2 mb-1" style={{ color: 'var(--app-muted)', opacity: 0.5 }}>Today</p>
                    <div className="space-y-0.5">
                      {grouped.today.map(s => (
                        <SessionItem
                          key={s.id} session={s}
                          isActive={s.id === activeSessionId}
                          onClick={() => setActiveSessionId(s.id)}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {grouped.yesterday.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold px-2 mb-1" style={{ color: 'var(--app-muted)', opacity: 0.5 }}>Yesterday</p>
                    <div className="space-y-0.5">
                      {grouped.yesterday.map(s => (
                        <SessionItem
                          key={s.id} session={s}
                          isActive={s.id === activeSessionId}
                          onClick={() => setActiveSessionId(s.id)}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {grouped.older.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest font-semibold px-2 mb-1" style={{ color: 'var(--app-muted)', opacity: 0.5 }}>Older</p>
                    <div className="space-y-0.5">
                      {grouped.older.map(s => (
                        <SessionItem
                          key={s.id} session={s}
                          isActive={s.id === activeSessionId}
                          onClick={() => setActiveSessionId(s.id)}
                          onDelete={handleDeleteSession}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer info */}
          <div
            className="px-3 py-2.5 flex-shrink-0 text-[9px]"
            style={{ borderTop: '1px solid var(--stroke)', color: 'var(--app-muted)', opacity: 0.5 }}
          >
            Compass · Claude Sonnet 4 · BDV TravelOS · 11 Services
          </div>
        </div>
      )}

      {/* ── Main Chat Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Chat Header */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-5 py-3"
          style={{ borderBottom: '1px solid var(--stroke)', backgroundColor: 'var(--surface)' }}
        >
          <button
            onClick={() => setSidebarOpen(p => !p)}
            className="p-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--app-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--cta)'; e.currentTarget.style.backgroundColor = 'rgba(232,168,48,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            data-testid="toggle-sidebar-btn"
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #e8a830, #c9871a)' }}
            >
              <Navigation className="w-3.5 h-3.5 text-[#0e1c36]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold" style={{ color: 'var(--app-fg)', fontFamily: 'Montserrat, sans-serif' }}>Compass</p>
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.25)' }}
                >
                  ● Online
                </span>
              </div>
              <p className="text-[10px] truncate" style={{ color: 'var(--app-muted)' }}>
                BDV AI Travel Consultant · Claude Sonnet 4
              </p>
            </div>
          </div>

          {activeSessionId && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-all duration-150"
              style={{
                backgroundColor: 'rgba(232,168,48,0.1)',
                border: '1px solid rgba(232,168,48,0.25)',
                color: 'var(--cta)',
              }}
              data-testid="new-chat-header-btn"
            >
              <Plus className="w-3 h-3" />
              New Chat
            </button>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto" data-testid="messages-container">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--cta)' }} />
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <WelcomeScreen onSuggestion={(text) => { setInput(text); setTimeout(() => inputRef.current?.focus(), 50); }} />
          ) : (
            <div className="px-5 py-6 space-y-5 max-w-4xl mx-auto w-full">
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} isStreaming={false} />
              ))}
              {isStreaming && streamingText && (
                <MessageBubble
                  message={{ id: 'streaming', role: 'assistant', content: streamingText }}
                  isStreaming={true}
                />
              )}
              {isStreaming && !streamingText && <ThinkingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 px-5 py-4"
          style={{ borderTop: '1px solid var(--stroke)', backgroundColor: 'var(--surface)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div
              className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-all duration-150"
              style={{
                backgroundColor: 'var(--qb-field, #0f1a33)',
                border: '1px solid var(--qb-field-border, rgba(255,255,255,0.08))',
              }}
              onFocusCapture={e => {
                e.currentTarget.style.borderColor = 'rgba(232,168,48,0.4)';
              }}
              onBlurCapture={e => {
                e.currentTarget.style.borderColor = 'var(--qb-field-border, rgba(255,255,255,0.08))';
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  // Auto resize
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Compass — flights, hotels, visa, quotation, tours, destination, or internal tasks…"
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed min-h-[22px] max-h-40"
                style={{
                  color: 'var(--app-fg)',
                  caretColor: 'var(--cta)',
                }}
                data-testid="chat-input"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: !input.trim() || isStreaming
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg, #e8a830, #c9871a)',
                  color: !input.trim() || isStreaming ? 'var(--app-muted)' : '#0e1c36',
                }}
                data-testid="send-btn"
              >
                {isStreaming
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-[9px] text-center mt-2" style={{ color: 'var(--app-muted)', opacity: 0.4 }}>
              Press Enter to send · Shift+Enter for new line · Compass drafts for your review — never sends directly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
