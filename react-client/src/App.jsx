import React, { useState, useEffect } from 'react';

const TABS = [
  { id: 'summarize', label: '1. Summarize' },
  { id: 'translate', label: '2. Translate' },
  { id: 'stt', label: '3. Speech-to-Text' },
  { id: 'tts', label: '4. Text-to-Speech' },
  { id: 'pdf2html', label: '5. PDF to HTML' },
  { id: 'ocr', label: '6. RapidOCR' },
  { id: 'classify', label: '7. CLIP Classify' },
  { id: 'entities', label: '8. Extract JSON' },
  { id: 'pipeline', label: '9. Process Doc' },
];

const DEFAULT_SCHEMA = JSON.stringify(
  {
    type: 'object',
    properties: {
      document_title: { type: ['string', 'null'] },
      vendor_or_sender: { type: ['string', 'null'] },
      document_date: { type: ['string', 'null'] },
      total_amount: { type: ['number', 'null'] },
      currency: { type: ['string', 'null'] },
    },
    required: ['document_title', 'vendor_or_sender', 'document_date', 'total_amount', 'currency'],
  },
  null,
  2
);

export default function App() {
  const [activeTab, setActiveTab] = useState('summarize');
  const [health, setHealth] = useState('checking...');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [error, setError] = useState('');
  const [jsonResult, setJsonResult] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [htmlPreview, setHtmlPreview] = useState('');

  // Form states
  const [textInput, setTextInput] = useState(
    'Invoice #INV-2026-884 from Acme Cloud Services dated November 23, 2026. Total amount due is $1,450.00 USD for annual CPU cluster hosting.'
  );
  const [maxBullets, setMaxBullets] = useState(3);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [ttsVoice, setTtsVoice] = useState('af_heart');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [file, setFile] = useState(null);
  const [clipLabels, setClipLabels] = useState('invoice, receipt, contract, passport, handwritten note');
  const [forceOcr, setForceOcr] = useState(false);
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? 'Online' : 'Error'))
      .then(setHealth)
      .catch(() => setHealth('Offline'));
  }, []);

  const switchTab = (id) => {
    setActiveTab(id);
    setError('');
    setJsonResult(null);
    setAudioUrl('');
    setHtmlPreview('');
    setElapsed(null);
  };

  const runRequest = async (fn) => {
    setLoading(true);
    setError('');
    setJsonResult(null);
    setAudioUrl('');
    setHtmlPreview('');
    const t0 = performance.now();
    try {
      await fn();
      setElapsed(((performance.now() - t0) / 1000).toFixed(2));
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runRequest(async () => {
      if (activeTab === 'summarize') {
        const res = await fetch('/api/v1/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput, max_bullets: Number(maxBullets) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        setJsonResult(data);
      } else if (activeTab === 'translate') {
        const res = await fetch('/api/v1/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput, target_language: targetLang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        setJsonResult(data);
      } else if (activeTab === 'tts') {
        const res = await fetch('/api/v1/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput, voice: ttsVoice, speed: Number(ttsSpeed), response_format: 'mp3' }),
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
      } else if (activeTab === 'entities') {
        const res = await fetch('/api/v1/extract-entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput, json_schema: JSON.parse(schemaText) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        setJsonResult(data);
      } else {
        if (!file) throw new Error('Please select a file first.');
        const fd = new FormData();
        fd.append('file', file);

        if (activeTab === 'stt') {
          const res = await fetch('/api/v1/stt', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
          setJsonResult(data);
        } else if (activeTab === 'pdf2html') {
          fd.append('force_ocr', String(forceOcr));
          const res = await fetch('/api/v1/pdf-to-html', { method: 'POST', body: fd });
          const html = await res.text();
          if (!res.ok) throw new Error(html);
          setHtmlPreview(html);
          setJsonResult({
            total_pages: res.headers.get('X-Total-Pages'),
            ocr_fallback_pages: res.headers.get('X-OCR-Fallback-Pages'),
          });
        } else if (activeTab === 'ocr') {
          const res = await fetch('/api/v1/ocr', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
          setJsonResult(data);
        } else if (activeTab === 'classify') {
          if (clipLabels.trim()) fd.append('labels', clipLabels);
          const res = await fetch('/api/v1/classify-image', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
          setJsonResult(data);
        } else if (activeTab === 'pipeline') {
          if (clipLabels.trim()) fd.append('labels', clipLabels);
          if (schemaText.trim()) fd.append('json_schema', schemaText);
          fd.append('max_bullets', String(maxBullets));
          fd.append('force_ocr', String(forceOcr));
          const res = await fetch('/api/v1/process-document', { method: 'POST', body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
          setJsonResult(data);
        }
      }
    });
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>CPU AI Gateway — React Test Console</h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Proxying <code>/api/*</code> &rarr; <code>gateway:8080</code>
          </p>
        </div>
        <span
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            background: health === 'Online' ? '#064e3b' : '#7f1d1d',
            color: health === 'Online' ? '#6ee7b7' : '#fca5a5',
          }}
        >
          Gateway: {health}
        </span>
      </header>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #334155',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              background: activeTab === t.id ? '#2563eb' : '#1e293b',
              color: activeTab === t.id ? '#fff' : '#cbd5e1',
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <form
        onSubmit={handleSubmit}
        style={{ background: '#1e293b', padding: 20, borderRadius: 10, border: '1px solid #334155' }}
      >
        {['summarize', 'translate', 'tts', 'entities'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Input Text</label>
            <textarea
              rows={5}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {['stt', 'pdf2html', 'ocr', 'classify', 'pipeline'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              Upload File ({activeTab === 'stt' ? 'WAV / MP3 / M4A' : activeTab === 'pdf2html' ? 'PDF' : 'PDF / PNG / JPG'})
            </label>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ color: '#e2e8f0' }} />
          </div>
        )}

        {['summarize', 'pipeline'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Max Summary Bullets</label>
            <input type="number" min={1} max={15} value={maxBullets} onChange={(e) => setMaxBullets(e.target.value)} style={inputStyle} />
          </div>
        )}

        {activeTab === 'translate' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Target Language</label>
            <input type="text" value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={inputStyle} />
          </div>
        )}

        {activeTab === 'tts' && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Kokoro Voice</label>
              <select value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} style={inputStyle}>
                <option value="af_heart">af_heart (US Female)</option>
                <option value="af_bella">af_bella (US Female)</option>
                <option value="am_michael">am_michael (US Male)</option>
                <option value="bf_emma">bf_emma (UK Female)</option>
              </select>
            </div>
            <div style={{ width: 140 }}>
              <label style={labelStyle}>Speed</label>
              <input type="number" step="0.1" min="0.5" max="2.0" value={ttsSpeed} onChange={(e) => setTtsSpeed(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}

        {['classify', 'pipeline'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Candidate Labels (comma-separated)</label>
            <input type="text" value={clipLabels} onChange={(e) => setClipLabels(e.target.value)} style={inputStyle} />
          </div>
        )}

        {['pdf2html', 'pipeline'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="checkbox" checked={forceOcr} onChange={(e) => setForceOcr(e.target.checked)} />
              Force RapidOCR on all PDF pages
            </label>
          </div>
        )}

        {['entities', 'pipeline'].includes(activeTab) && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>JSON Schema for Entity Extraction</label>
            <textarea rows={8} value={schemaText} onChange={(e) => setSchemaText(e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 18px',
            borderRadius: 6,
            border: 'none',
            background: loading ? '#475569' : '#10b981',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Running on CPU...' : 'Send Request'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: '#7f1d1d', color: '#fecaca' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {audioUrl && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: '#1e293b', border: '1px solid #334155' }}>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#94a3b8' }}>Generated Speech ({elapsed}s):</p>
          <audio controls autoPlay src={audioUrl} style={{ width: '100%' }} />
        </div>
      )}

      {jsonResult && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 8, background: '#1e293b', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: '#94a3b8' }}>
            <span>Response JSON</span>
            {elapsed && <span>Completed in {elapsed}s</span>}
          </div>
          <pre style={{ margin: 0, overflowX: 'auto', fontSize: 13, color: '#a5f3fc' }}>
            {JSON.stringify(jsonResult, null, 2)}
          </pre>
        </div>
      )}

      {htmlPreview && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Rendered HTML Preview:</p>
          <iframe
            title="PDF HTML Output"
            srcDoc={htmlPreview}
            style={{ width: '100%', height: 500, background: '#fff', borderRadius: 8, border: '1px solid #334155' }}
          />
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: 6, fontSize: 13, color: '#94a3b8', fontWeight: 500 };
const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: 14,
};
