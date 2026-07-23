import { useMemo, useState } from 'react'
import './App.css'

type HeaderFinding = {
  header: string
  present: boolean
  value: string | null
  points: number
  note: string
}

type AuditResponse = {
  url: string
  final_url: string
  status_code: number
  uses_https: boolean
  score: number
  max_score: number
  priority: string
  grade: string
  header_findings: HeaderFinding[]
  review_notes: string[]
  review_notes_count: number
  checked_at_utc: string
}

const API_BASE_URL = 'http://127.0.0.1:8000'

function App() {
  const [url, setUrl] = useState('https://example.com')
  const [result, setResult] = useState<AuditResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [scanHistory, setScanHistory] = useState<AuditResponse[]>([])
  const [batchUrls, setBatchUrls] = useState(
    'https://example.com\nhttps://www.iana.org',
  )
  const [batchResults, setBatchResults] = useState<AuditResponse[]>([])
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)

  async function auditTarget(targetUrl: string) {
    const response = await fetch(`${API_BASE_URL}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl }),
    })

    if (!response.ok) {
      const errorPayload = await response.json()
      throw new Error(errorPayload.detail ?? 'Audit request failed.')
    }

    return (await response.json()) as AuditResponse
  }

  async function runAudit() {
    setIsLoading(true)
    setErrorMessage('')
    setResult(null)

    try {
      const data = await auditTarget(url)
      setResult(data)
      setScanHistory((currentHistory) => [data, ...currentHistory].slice(0, 5))
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Audit request failed.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function runBatchAudit() {
    const targets = batchUrls
      .split('\n')
      .map((target) => target.trim())
      .filter(Boolean)

    if (targets.length === 0) {
      setErrorMessage('Add at least one URL for batch scanning.')
      return
    }

    setIsBatchLoading(true)
    setErrorMessage('')
    setBatchResults([])
    setBatchProgress(0)

    const completedScans: AuditResponse[] = []

    try {
      for (const target of targets) {
        const data = await auditTarget(target)
        completedScans.push(data)

        setBatchResults([...completedScans])
        setBatchProgress(completedScans.length)
        setScanHistory((currentHistory) => [data, ...currentHistory].slice(0, 5))
      }

      setResult(completedScans[completedScans.length - 1] ?? null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Batch audit failed.',
      )
    } finally {
      setIsBatchLoading(false)
    }
  }

  const presentHeaders = useMemo(
    () => result?.header_findings.filter((finding) => finding.present).length ?? 0,
    [result],
  )

  const missingHeaders = useMemo(
    () =>
      result?.header_findings.filter((finding) => !finding.present).length ?? 0,
    [result],
  )

  const batchTargets = useMemo(
    () =>
      batchUrls
        .split('\n')
        .map((target) => target.trim())
        .filter(Boolean),
    [batchUrls],
  )

  const totalHeaders = presentHeaders + missingHeaders

  const postureLabel = result
    ? `${result.priority} / Grade ${result.grade}`
    : 'Awaiting first scan'

  return (
    <main className="console-shell">
      <section className="console-frame">
        <header className="console-topbar">
          <div className="brand-block">
            <span className="brand-mark">WSH</span>
            <div>
              <p>Passive Header Automation</p>
              <h1>Web Security Header Auditor</h1>
            </div>
          </div>

          <div className="runtime-status">
            <span className="pulse-dot" />
            Local API Ready
          </div>
        </header>

        <section className="command-strip">
          <div className="command-input">
            <span>target</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              aria-label="URL to audit"
            />
          </div>

          <button onClick={runAudit} disabled={isLoading || isBatchLoading}>
            {isLoading ? 'Scanning' : 'Run Audit'}
          </button>
        </section>

        <section className="batch-console">
          <div className="board-heading">
            <div>
              <p>Batch Mode</p>
              <h2>Multi Target Scan</h2>
            </div>
            <span>
              {isBatchLoading
                ? `${batchProgress} / ${batchTargets.length} complete`
                : `${batchTargets.length} queued`}
            </span>
          </div>

          <div className="batch-grid">
            <textarea
              value={batchUrls}
              onChange={(event) => setBatchUrls(event.target.value)}
              placeholder="https://example.com&#10;https://www.iana.org"
              aria-label="Batch URLs"
            />

            <div className="batch-actions">
              <button onClick={runBatchAudit} disabled={isLoading || isBatchLoading}>
                {isBatchLoading ? 'Batch Running' : 'Run Batch'}
              </button>
              <p>
                Add one URL per line. The GUI sends passive audit requests to the
                local API.
              </p>
            </div>
          </div>

          {batchResults.length > 0 ? (
            <div className="batch-results">
              {batchResults.map((scan) => (
                <article
                  className="batch-result"
                  key={`${scan.final_url}-${scan.checked_at_utc}`}
                >
                  <div>
                    <strong>{scan.final_url}</strong>
                    <span>{scan.priority}</span>
                  </div>
                  <b>{scan.score}</b>
                  <small>{scan.grade}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">
              Batch results will appear here after the first multi target run.
            </p>
          )}
        </section>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

        <section className="mission-grid">
          <aside className="score-module">
            <div className="module-heading">
              <span>posture score</span>
              <strong>{result ? result.grade : '--'}</strong>
            </div>

            <div className="score-beacon">
              <div className="score-core">
                <strong>{result ? result.score : '--'}</strong>
                <span>/ {result ? result.max_score : '100'}</span>
              </div>
            </div>

            <p>{postureLabel}</p>

            <div className="mini-stats">
              <div>
                <span>Status</span>
                <strong>{result ? result.status_code : '--'}</strong>
              </div>
              <div>
                <span>HTTPS</span>
                <strong>{result ? (result.uses_https ? 'Yes' : 'No') : '--'}</strong>
              </div>
            </div>
          </aside>

          <section className="scan-module">
            <div className="module-heading">
              <span>scan pipeline</span>
              <strong>{result ? result.final_url : 'idle'}</strong>
            </div>

            <div
              className={
                isLoading || isBatchLoading ? 'scan-lane is-running' : 'scan-lane'
              }
            >
              <div className="lane-track">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="lane-labels">
                <span>Resolve URL</span>
                <span>Fetch Headers</span>
                <span>Score Posture</span>
                <span>Build Notes</span>
              </div>
            </div>

            <div className="control-grid">
              <article>
                <span>Present</span>
                <strong>{presentHeaders}</strong>
              </article>
              <article>
                <span>Missing</span>
                <strong>{missingHeaders}</strong>
              </article>
              <article>
                <span>Total</span>
                <strong>{totalHeaders || '--'}</strong>
              </article>
              <article>
                <span>Notes</span>
                <strong>{result ? result.review_notes_count : '--'}</strong>
              </article>
            </div>
          </section>
        </section>

        <section className="history-board">
          <div className="board-heading">
            <div>
              <p>Recent Runs</p>
              <h2>Scan History</h2>
            </div>
            <span>{scanHistory.length} stored locally</span>
          </div>

          {scanHistory.length > 0 ? (
            <div className="history-list">
              {scanHistory.map((scan) => (
                <article
                  className="history-item"
                  key={`${scan.final_url}-${scan.checked_at_utc}`}
                >
                  <div>
                    <strong>{scan.final_url}</strong>
                    <span>{scan.priority}</span>
                  </div>
                  <b>{scan.score}</b>
                  <small>{scan.grade}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">
              Completed scans will be listed here during this session.
            </p>
          )}
        </section>

        <section className="workbench">
          <div className="headers-board">
            <div className="board-heading">
              <div>
                <p>Security Controls</p>
                <h2>Header Matrix</h2>
              </div>
              <span>{result ? `${totalHeaders} controls checked` : 'No scan data'}</span>
            </div>

            <div className="header-matrix">
              {result ? (
                result.header_findings.map((finding) => (
                  <article
                    className={finding.present ? 'control-card pass' : 'control-card fail'}
                    key={finding.header}
                  >
                    <div className="control-card-top">
                      <span>{finding.present ? 'active' : 'missing'}</span>
                      <strong>{finding.points} pts</strong>
                    </div>
                    <h3>{finding.header}</h3>
                    <p>{finding.value ?? finding.note}</p>
                  </article>
                ))
              ) : (
                <div className="matrix-empty">
                  Enter a target and run an audit to populate the control matrix.
                </div>
              )}
            </div>
          </div>

          <aside className="triage-board">
            <div className="board-heading">
              <div>
                <p>Review Queue</p>
                <h2>Analyst Notes</h2>
              </div>
              <span>{result ? `${result.review_notes_count} items` : 'idle'}</span>
            </div>

            {result ? (
              <ol className="note-list">
                {result.review_notes.map((note, index) => (
                  <li key={note}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{note}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-copy">
                Findings and remediation notes will appear here after the scan.
              </p>
            )}
          </aside>
        </section>
      </section>
    </main>
  )
}

export default App