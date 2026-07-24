import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import ScenarioLabModal from './ScenarioLabModal';
import { streamForecastAssistant } from '../services/forecastAssistant.service';
import {
  Sparkles, X, Send, Square, Maximize2, Minimize2, FlaskConical, ChevronRight,
} from 'lucide-react';

const QUICK_PROMPTS = [
  'Find my biggest risk',
  'Explain next month',
  'Run ₹3 Cr what-if',
  'Improve the outcome',
];

let idCounter = 0;
const nextId = () => `fc-${Date.now()}-${idCounter++}`;

/**
 * Fixed bottom-right AI copilot for the Finance Forecast page. Reuses the
 * page's already-fetched `forecast` (no second query) and never sends any
 * forecast NUMBER to the backend — only siteId, the message, trimmed
 * history, and the current scenario/horizon/lookback selections as hints.
 * The backend independently re-derives and validates every figure.
 */
export default function ForecastCopilot({ siteId, forecast, scenario, horizonMonths, lookbackMonths, onApplyScenario }) {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [scenarioSeed, setScenarioSeed] = useState({ openingCash: null, amount: null });
  const [scenarioSeedKey, setScenarioSeedKey] = useState(0);

  const abortControllerRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const handleSend = async (rawText) => {
    const text = (rawText ?? input).trim();
    if (!text || isStreaming || !siteId) return;
    setInput('');

    const historyPayload = messages
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = nextId();
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', streaming: true },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      for await (const frame of streamForecastAssistant({
        siteId, message: text, history: historyPayload, scenario, horizonMonths, lookbackMonths, signal: controller.signal,
      })) {
        if (frame.event === 'action') {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, action: frame.data } : m)));
        } else if (frame.event === 'token') {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + (frame.data.delta || '') } : m)));
        } else if (frame.event === 'error') {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, error: frame.data.message } : m)));
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setMessages((prev) => prev.map((m) => (m.id === assistantId && !m.content
          ? { ...m, content: "Can't reach the assistant right now — please try again in a moment." }
          : m)));
      }
    } finally {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const openScenarioLab = (action) => {
    setScenarioSeed({ openingCash: action?.openingCash, amount: action?.suggestedAmount });
    setScenarioSeedKey((k) => k + 1);
    setScenarioOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ask Forecast AI"
        className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 text-white shadow-lg shadow-indigo-600/30 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/40 active:scale-95 sm:px-5"
      >
        {open ? <X className="h-5 w-5 shrink-0" /> : <Sparkles className="h-5 w-5 shrink-0" />}
        <span className="hidden text-sm font-semibold sm:inline">{open ? 'Close' : 'Ask Forecast AI'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Forecast Copilot"
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 animate-in fade-in slide-in-from-bottom-4 duration-200',
            maximized
              ? 'bottom-4 right-4 left-4 top-4 sm:left-auto sm:w-[560px]'
              : 'bottom-24 right-4 h-[min(70vh,640px)] w-[calc(100vw-2rem)] sm:right-6 sm:w-[400px]'
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-violet-50 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Forecast Copilot</p>
              <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className={cn('h-1.5 w-1.5 rounded-full', siteId && forecast ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')} />
                {siteId && forecast ? 'Live forecast context' : 'Loading forecast…'}
              </p>
            </div>
            <button
              type="button" onClick={() => setMaximized((m) => !m)}
              aria-label={maximized ? 'Minimize panel' : 'Maximize panel'}
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button" onClick={() => setOpen(false)}
              aria-label="Close Forecast Copilot"
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                  <Sparkles className="h-5 w-5" />
                </span>
                <p className="text-sm text-slate-500">Ask about risk, next month, or try a what-if — answers use your live forecast.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={cn(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-5 whitespace-pre-wrap break-words',
                      m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                    )}>
                      {m.content}
                      {m.streaming && <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-slate-400 align-middle" />}
                      {m.action?.type === 'open_scenario_lab' && !m.streaming && (
                        <button
                          type="button"
                          onClick={() => openScenarioLab(m.action)}
                          className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-left text-[12px] font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
                        >
                          <span className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Explore this scenario</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {m.error && <p className="mt-1 text-[11px] text-rose-500">{m.error}</p>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-slate-100 px-3 py-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p} type="button" disabled={isStreaming || !siteId}
                onClick={() => handleSend(p)}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex shrink-0 items-end gap-2 border-t border-slate-100 p-3">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Ask about your forecast…"
              rows={1}
              aria-label="Message Forecast Copilot"
              disabled={!siteId}
              className="max-h-24 min-h-9 flex-1 resize-none text-sm"
            />
            {isStreaming ? (
              <Button
                type="button" size="icon" variant="outline"
                onClick={() => abortControllerRef.current?.abort()}
                aria-label="Stop generating"
                className="h-9 w-9 shrink-0 rounded-full"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button" size="icon"
                onClick={() => handleSend()}
                disabled={!input.trim() || !siteId}
                aria-label="Send message"
                className="h-9 w-9 shrink-0 rounded-full bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      <ScenarioLabModal
        key={scenarioSeedKey}
        open={scenarioOpen}
        onOpenChange={setScenarioOpen}
        forecast={forecast}
        initialOpeningCash={scenarioSeed.openingCash}
        initialAmount={scenarioSeed.amount}
        onApply={onApplyScenario}
      />
    </>
  );
}
