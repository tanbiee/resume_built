import { useState, useRef } from 'react'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/resume/optimize` : 'http://localhost:5000/api/resume/optimize'

const getClass = (score) => score >= 75 ? 'high' : score >= 50 ? 'med' : 'low'
const getVerdict = (score) => score >= 75 ? 'STRONG MATCH' : score >= 50 ? 'PARTIAL MATCH' : 'WEAK MATCH'
const getMsg = (score) => {
  if (score >= 85) return "You're in elite territory. This resume will sail through most ATS systems."
  if (score >= 70) return "Good alignment. A few targeted tweaks will push you past the ATS threshold."
  if (score >= 50) return "Moderate overlap detected. Apply the suggestions below to significantly boost your score."
  return "Low keyword density vs. the JD. Major optimization needed to pass ATS screening."
}

const VARIANT_META = [
  { icon: '📋', desc: 'Clean, structured ATS-safe format with traditional sections.' },
  { icon: '⚡', desc: 'Power-verb driven language for maximum impact.' },
  { icon: '🎯', desc: 'Keyword-maximized, laser-targeted at this exact JD.' },
]

export default function App() {
  const [jd, setJd] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  const pickFile = (f) => {
    if (!f) return
    const exts = /\.(pdf|doc|docx)$/i
    if (!exts.test(f.name)) { setError('Only PDF or Word documents accepted.'); return }
    setFile(f); setError(null)
  }

  const submit = async () => {
    if (!jd.trim()) return setError('Job description cannot be empty.')
    if (!file) return setError('Please upload your resume.')
    setError(null); setLoading(true); setResults(null)
    try {
      const fd = new FormData()
      fd.append('resume', file)
      fd.append('jobDescription', jd)
      const res = await fetch(API_URL, { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Server error')
      setResults(json.data)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const [downloading, setDownloading] = useState(null)

  const download = async (link) => {
    setDownloading(link.filename)
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const res = await fetch(`${baseUrl}${link.url}`)
      if (!res.ok) throw new Error('File not found on server.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${link.style_name.replace(/\s+/g, '_')}_CV.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Download failed: ${e.message}`)
    } finally {
      setDownloading(null)
    }
  }

  const step = results ? 3 : loading ? 2 : 1
  const cls = results ? getClass(results.ats_score) : 'high'

  return (
    <>
      <div className="grid-bg" />
      <div className="scanline" />

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="nav-logo">
          <span className="logo-bracket">[</span>
          ResumeIQ
          <span className="logo-bracket">]</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a
            href="https://t.me/Make_your_resume_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-telegram"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', 
              textDecoration: 'none', color: '#fff', 
              background: 'rgba(0, 136, 204, 0.2)', 
              border: '1px solid #0088cc',
              padding: '6px 12px', borderRadius: '4px', 
              fontSize: '0.8rem', fontWeight: 'bold', 
              transition: 'all 0.2s ease',
              textTransform: 'uppercase'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0, 136, 204, 0.4)'; e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 136, 204, 0.5)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(0, 136, 204, 0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2L2 11.5l6.5 2.5L21.5 2z" />
              <path d="M21.5 2L15 22l-6.5-6L21.5 2z" />
            </svg>
            use TG Bot
          </a>
          <div className="nav-status">
            <div className="dot" />
            SYSTEM_ONLINE
          </div>
        </div>
      </nav>

      <div className="app">

        {/* HERO */}
        <section className="hero">
          <div className="hero-eyebrow">v2.0 · AI-Powered ATS Engine</div>
          <h1>
            <span className="line1">Get past the robots.</span>
            <span className="line2">Beat ATS. Get hired.</span>
            <span className="line3">no cap.</span>
          </h1>
          <p className="hero-sub">
            Drop your resume + the job description. Our AI scores your ATS compatibility,
            flags <strong>missing keywords</strong>, and spits out optimized CV variants ready to download.
          </p>
          <div className="stats">
            <div className="stat">
              <div className="stat-val">98%</div>
              <div className="stat-label">ATS_PASS_RATE</div>
            </div>
            <div className="stat">
              <div className="stat-val blue">3×</div>
              <div className="stat-label">MORE_INTERVIEWS</div>
            </div>
            <div className="stat">
              <div className="stat-val pink">{'<'}30s</div>
              <div className="stat-label">ANALYSIS_TIME</div>
            </div>
          </div>
        </section>

        {/* MAIN PANEL */}
        <div className="panel-wrap">
          <div className="panel">
            {/* Panel header */}
            <div className="panel-header">
              <div className="panel-tabs">
                <div className={`panel-tab ${step === 1 ? 'active' : ''}`}>input.jd</div>
                <div className={`panel-tab ${step === 2 ? 'active' : ''}`}>processing...</div>
                <div className={`panel-tab ${step === 3 ? 'active' : ''}`}>results.json</div>
              </div>
              <div className="panel-controls">
                <div className="ctrl-dot" /><div className="ctrl-dot" /><div className="ctrl-dot" />
              </div>
            </div>

            <div className="panel-body">
              {/* Steps */}
              <div className="steps">
                {[['01', 'UPLOAD'], ['02', 'ANALYZE'], ['03', 'RESULTS']].map(([n, label], i) => (
                  <div key={i} className={`step-item ${step > i + 1 ? 'done' : step === i + 1 ? 'active' : ''}`}>
                    <div className="snum">{step > i + 1 ? '✓' : n}</div>
                    {label}
                  </div>
                ))}
              </div>

              {/* === LOADING === */}
              {loading && (
                <div className="loading fade-in">
                  <div className="terminal-loader">
                    <div className="term-line green">$ resumeiq --analyze --mode=deep</div>
                    <div className="term-line">› loading resume parser......  <span style={{color:'var(--neon-green)'}}>✓</span></div>
                    <div className="term-line blue">› extracting text content.....  <span style={{color:'var(--neon-blue)'}}>✓</span></div>
                    <div className="term-line active">
                      › running AI analysis....
                      <div className="term-cursor" />
                    </div>
                  </div>
                  <div className="bar-track"><div className="bar-fill" /></div>
                </div>
              )}

              {/* === INPUT FORM === */}
              {!loading && !results && (
                <div className="form fade-in">
                  {error && <div className="err">! {error}</div>}
                  <div>
                    <div className="field-label">job_description</div>
                    <textarea
                      rows={6}
                      value={jd}
                      onChange={e => setJd(e.target.value)}
                      placeholder="// paste the full job description here&#10;// include: role, responsibilities, required skills, qualifications..."
                    />
                  </div>
                  <div>
                    <div className="field-label">resume_file</div>
                    <div
                      className={`upload-zone ${drag ? 'drag-over' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDrag(true) }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]) }}
                      onClick={() => fileRef.current.click()}
                    >
                      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{display:'none'}}
                        onChange={e => pickFile(e.target.files[0])} />
                      <div className="upload-icon-wrap">
                        <svg viewBox="0 0 64 64" fill="none">
                          <rect x="8" y="16" width="48" height="40" rx="2" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5"/>
                          <path d="M22 16V12c0-2.2 1.8-4 4-4h12c2.2 0 4 1.8 4 4v4" stroke="rgba(0,212,255,0.3)" strokeWidth="1.5"/>
                          <path d="M32 28v16M24 36l8-8 8 8" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h3>drag & drop your resume</h3>
                      <p>or click to browse — max 5MB</p>
                      <div className="file-badges">
                        {['PDF', 'DOC', 'DOCX'].map(t => <span key={t} className="fbadge">{t}</span>)}
                      </div>
                    </div>
                    {file && (
                      <div className="file-ok">
                        <span className="check">▶</span>
                        {file.name}
                        <span style={{marginLeft:'auto', opacity:0.5, fontSize:'0.72rem'}}>{(file.size/1024).toFixed(1)} KB</span>
                      </div>
                    )}
                  </div>
                  <button className="btn-main" onClick={submit} disabled={!jd.trim() || !file}>
                    ▶ RUN_ANALYSIS()
                  </button>
                </div>
              )}

              {/* === RESULTS === */}
              {!loading && results && (
                <div className="results fade-in">
                  <div className="results-top">
                    <h2>// OUTPUT &gt; ATS_REPORT</h2>
                    <button className="btn-back" onClick={() => { setResults(null); setFile(null); setJd('') }}>
                      ← restart
                    </button>
                  </div>

                  {error && <div className="err">! {error}</div>}

                  {/* Score */}
                  <div className="score-block">
                    <div className="score-block-head">
                      <div className="col-dot" style={{color:'var(--neon-green)'}} />
                      ats_score.result
                    </div>
                    <div className="score-block-body">
                      <div className="score-left">
                        <div className={`score-num-big ${cls}`}>{results.ats_score}</div>
                        <div className="score-denom">/ 100</div>
                        <div className={`score-verdict ${cls}`}>{getVerdict(results.ats_score)}</div>
                      </div>
                      <div className="score-right">
                        <h3>ATS Compatibility Score</h3>
                        <p>{getMsg(results.ats_score)}</p>
                        <div className="prog-track">
                          <div className={`prog-fill ${cls}`} style={{ width: `${results.ats_score}%` }} />
                        </div>
                        <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:'0.7rem', color:'var(--text3)'}}>
                          score: {results.ats_score}/100 · threshold: 70/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Keywords */}
                  {results.missing_keywords?.length > 0 && (
                    <div className="info-block">
                      <div className="info-head">
                        <span className="accent-pink">■</span>
                        missing_keywords ({results.missing_keywords.length} detected)
                      </div>
                      <div className="info-body">
                        <div className="kw-grid">
                          {results.missing_keywords.map((k, i) => (
                            <span key={i} className="kw-chip">{k}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {results.optimization_suggestions?.length > 0 && (
                    <div className="info-block">
                      <div className="info-head">
                        <span className="accent">■</span>
                        optimization_suggestions
                      </div>
                      <div className="info-body">
                        <div className="sug-list">
                          {results.optimization_suggestions.map((s, i) => (
                            <div key={i} className="sug-item">
                              <span className="sug-idx">[{String(i+1).padStart(2,'0')}]</span>
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CV Variants — PDF Downloads */}
                  {results.download_links?.length > 0 && (
                    <div className="info-block">
                      <div className="info-head">
                        <span className="accent-green">■</span>
                        generated_cv_variants — formatted PDFs ready
                      </div>
                      <div className="info-body">
                        <div className="variants-grid">
                          {results.download_links.map((link, i) => (
                            <div key={i} className="variant">
                              <div className="variant-num">VARIANT_{String(i+1).padStart(2,'0')}</div>
                              <div className="variant-icon">{VARIANT_META[i]?.icon || '📄'}</div>
                              <h4>{link.style_name}</h4>
                              <p>{VARIANT_META[i]?.desc || 'Optimized CV variant.'}</p>
                              <button
                                className="btn-dl"
                                onClick={() => download(link)}
                                disabled={!!downloading}
                              >
                                {downloading === link.filename ? '⏳ downloading...' : '↓ download PDF'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
