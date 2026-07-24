const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Streams the Forecast Copilot's reply as an async generator of
 * { event, data } frames ('meta' | 'action' | 'token' | 'error' | 'done').
 * Uses native fetch (not the axios instance) since streaming needs raw
 * body access — EventSource can't POST or set custom auth headers, so the
 * event-stream framing is parsed by hand here.
 *
 * Never sends any forecast NUMBER to the backend — only the site id, the
 * message, trimmed history, and the current scenario/horizon/lookback
 * *selections* as display hints. The backend independently re-derives and
 * validates every figure from the database.
 */
export async function* streamForecastAssistant({
  siteId, message, history, scenario, horizonMonths, lookbackMonths, signal,
}) {
  const token = localStorage.getItem('accessToken');
  const sessionId = localStorage.getItem('sessionId');

  const response = await fetch(`${API_BASE_URL}/forecast/assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(sessionId ? { 'X-Session-ID': sessionId } : {}),
    },
    body: JSON.stringify({
      site_id: siteId,
      message,
      history: (history || []).slice(-8),
      scenario,
      horizonMonths,
      lookbackMonths,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    let detail = '';
    try { detail = (await response.json())?.message; } catch { /* ignore */ }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let blankIndex;
    while ((blankIndex = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, blankIndex);
      buffer = buffer.slice(blankIndex + 2);

      let event = null;
      let data = null;
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data = line.slice(6);
      }
      if (!event || data === null) continue; // e.g. a ': ping' heartbeat block

      try {
        yield { event, data: JSON.parse(data) };
      } catch {
        // malformed frame — skip rather than crash the whole stream
      }
    }
  }
}
