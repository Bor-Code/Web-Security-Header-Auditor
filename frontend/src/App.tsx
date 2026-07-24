import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t, i18n } = useTranslation()

  const [url, setUrl] = useState('https://example.com')
  const [result, setResult] = useState<AuditResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [scanHistory, setScanHistory] = useState<AuditResponse[]>([])
  const [batchUrls, setBatchUrls] = useState(
    'https://example.com\nhttps://www.iana.org',
  )
  const [batchResults, setBatchResults] = useState<AuditResponse[]>([])
  const [isBatchLoading, setIsBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)

  function toggleLanguage() {
    void i18n.changeLanguage(i18n.language === 'en' ? 'tr' : 'en')
  }

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

  const batchAverageScore = useMemo(() => {
    if (batchResults.length === 0) {
      return '--'
    }

    const totalScore = batchResults.reduce((sum, scan) => sum + scan.score, 0)
    return Math.round(totalScore / batchResults.length).toString()
  }, [batchResults])

  const batchWeakestResult = useMemo(() => {
    if (batchResults.length === 0) {
      return null
    }

    return batchResults.reduce((weakestScan, scan) =>
      scan.score < weakestScan.score ? scan : weakestScan,
    )
  }, [batchResults])

  const batchLowestScore = batchWeakestResult
    ? batchWeakestResult.score.toString()
    : '--'

  const batchHighPriorityCount = useMemo(
    () =>
      batchResults.filter((scan) => scan.priority === 'High review priority')
        .length,
    [batchResults],
  )

  function getBatchResultClassName(scan: AuditResponse) {
    return [
      'batch-result',
      getScoreTone(scan.score),
      batchWeakestResult?.checked_at_utc === scan.checked_at_utc
        ? 'weakest'
        : '',
      result?.checked_at_utc === scan.checked_at_utc ? 'selected' : '',
    ]
      .filter(Boolean)
      .join(' ')
  }

  function getMissingHeaderNames(scan: AuditResponse) {
    const missingHeaders = scan.header_findings
      .filter((finding) => !finding.present)
      .map((finding) => finding.header)

    return missingHeaders.length > 0 ? missingHeaders.join(', ') : 'None'
  }

  function buildAuditSummary(scan: AuditResponse) {
    const summaryLines = [
      'Web Security Header Audit Summary',
      `URL: ${scan.url}`,
      `Final URL: ${scan.final_url}`,
      `Status Code: ${scan.status_code}`,
      `Uses HTTPS: ${scan.uses_https ? 'Yes' : 'No'}`,
      `Score: ${scan.score} / ${scan.max_score}`,
      `Grade: ${scan.grade}`,
      `Priority: ${scan.priority}`,
      `Missing Headers: ${getMissingHeaderNames(scan)}`,
      `Review Notes Count: ${scan.review_notes_count}`,
    ]

    return summaryLines.join('\n')
  }

  function getExportFileName(scan: AuditResponse, extension: string) {
    const fileNameTarget = scan.final_url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()

    return `wsh-audit-${fileNameTarget || 'result'}.${extension}`
  }

  function downloadBlob(content: string, type: string, fileName: string) {
    const blob = new Blob([content], { type })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = downloadUrl
    link.download = fileName
    link.click()

    URL.revokeObjectURL(downloadUrl)
  }

  function downloadAuditJson() {
    const selectedResult = result

    if (!selectedResult) {
      setCopyMessage('Run or select an audit first.')
      return
    }

    downloadBlob(
      JSON.stringify(selectedResult, null, 2),
      'application/json',
      getExportFileName(selectedResult, 'json'),
    )

    setCopyMessage(t('app.jsonDownloaded'))
  }

  function escapeCsvValue(value: string | number | boolean) {
    return `"${value.toString().replace(/"/g, '""')}"`
  }

  function buildAuditCsv(scan: AuditResponse) {
    const missingHeaders = scan.header_findings
      .filter((finding) => !finding.present)
      .map((finding) => finding.header)
      .join('; ')

    const headers = [
      'url',
      'final_url',
      'status_code',
      'uses_https',
      'score',
      'max_score',
      'grade',
      'priority',
      'review_notes_count',
      'missing_headers',
    ]

    const row = [
      scan.url,
      scan.final_url,
      scan.status_code,
      scan.uses_https,
      scan.score,
      scan.max_score,
      scan.grade,
      scan.priority,
      scan.review_notes_count,
      missingHeaders || 'None',
    ]

    return [
      headers.map(escapeCsvValue).join(','),
      row.map(escapeCsvValue).join(','),
    ].join('\n')
  }

  function downloadAuditCsv() {
    const selectedResult = result

    if (!selectedResult) {
      setCopyMessage('Run or select an audit first.')
      return
    }

    downloadBlob(
      buildAuditCsv(selectedResult),
      'text/csv;charset=utf-8',
      getExportFileName(selectedResult, 'csv'),
    )

    setCopyMessage(t('app.csvDownloaded'))
  }

  async function copyAuditSummary() {
    if (!result) {
      setCopyMessage('Run or select an audit first.')
      return
    }

    await navigator.clipboard.writeText(buildAuditSummary(result))
    setCopyMessage('Summary copied.')
  }

  useEffect(() => {
    if (!copyMessage) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopyMessage('')
    }, 2200)

    return () => window.clearTimeout(timeoutId)
  }, [copyMessage])

  const totalHeaders = presentHeaders + missingHeaders

  function getScoreTone(score?: number) {
    if (score === undefined) {
      return 'risk-idle'
    }

    if (score >= 80) {
      return 'risk-strong'
    }

    if (score >= 50) {
      return 'risk-review'
    }

    return 'risk-high'
  }

function getLocalizedPriority(priority: string) {
  if (i18n.language !== 'tr') {
    return priority
  }

  const priorityMap: Record<string, string> = {
    'Strong header posture': 'Güçlü header duruşu',
    'Needs review': 'İnceleme gerekli',
    'High review priority': 'Yüksek inceleme önceliği',
  }

  return priorityMap[priority] ?? priority
}

  const postureLabel = result
    ? `${getLocalizedPriority(result.priority)} / Grade ${result.grade}`
    : t('app.awaiting')

  return (
    <main className="console-shell">
      <section className="console-frame">
        <header className="console-topbar">
          <div className="brand-block">
            <span className="brand-mark">WSH</span>
            <div>
              <p>{t('app.eyebrow')}</p>
              <h1>{t('app.title')}</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="language-toggle" onClick={toggleLanguage}>
              {i18n.language === 'en' ? 'TR' : 'EN'}
            </button>

            <div className="export-panel">
              <span className="export-panel-label">{t('app.reportActions')}</span>
              <div className="export-actions">
                <button
                  className="summary-copy-button"
                  onClick={copyAuditSummary}
                  disabled={!result}
                >
                  {t('app.copySummary')}
                </button>

                <button
                  className="summary-copy-button"
                  onClick={downloadAuditJson}
                  disabled={!result}
                >
                  {t('app.downloadJson')}
                </button>

                <button
                  className="summary-copy-button"
                  onClick={downloadAuditCsv}
                  disabled={!result}
                >
                  {t('app.downloadCsv')}
                </button>
              </div>
            </div>

            <div className="runtime-status">
              <span className="pulse-dot" />
              {t('app.api')}
            </div>
          </div>
        </header>

        <section className="command-strip">
          <div className="command-input">
            <span>{t('app.target')}</span>
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com"
              aria-label="URL to audit"
            />
          </div>

          <button onClick={runAudit} disabled={isLoading || isBatchLoading}>
            {isLoading ? t('app.scanning') : t('app.runAudit')}
          </button>
        </section>

        <section className="batch-console">
          <div className="board-heading">
            <div>
              <p>{t('app.batchMode')}</p>
              <h2>{t('app.batchTitle')}</h2>
            </div>
            <span>
              {isBatchLoading
                ? `${batchProgress} / ${batchTargets.length} ${t('app.complete')}`
                : `${batchTargets.length} ${t('app.queued')}`}
            </span>
          </div>

          <div className="batch-grid">
            <textarea
              value={batchUrls}
              onChange={(event) => setBatchUrls(event.target.value)}
              placeholder={'https://example.com\nhttps://www.iana.org'}
              aria-label="Batch URLs"
            />

            <div className="batch-actions">
              <button onClick={runBatchAudit} disabled={isLoading || isBatchLoading}>
                {isBatchLoading ? t('app.batchRunning') : t('app.runBatch')}
              </button>
              <p>{t('app.batchHelp')}</p>
            </div>
          </div>

          {batchResults.length > 0 ? (
            <>
              <div className="batch-summary">
                <article>
                  <span>{t('app.completed')}</span>
                  <strong>{batchResults.length}</strong>
                </article>
                <article>
                  <span>{t('app.averageScore')}</span>
                  <strong>{batchAverageScore}</strong>
                </article>
                <article>
                  <span>{t('app.lowestScore')}</span>
                  <strong>{batchLowestScore}</strong>
                </article>
                <article>
                  <span>{t('app.highPriority')}</span>
                  <strong>{batchHighPriorityCount}</strong>
                </article>
              </div>

              {batchWeakestResult ? (
                <div className="weakest-target">
                  <div>
                    <span>{t('app.weakestTarget')}</span>
                    <strong>{batchWeakestResult.final_url}</strong>
                  </div>
                  <b>{batchWeakestResult.score}</b>
                  <small>{batchWeakestResult.grade}</small>
                </div>
              ) : null}

              <div className="batch-results">
                {batchResults.map((scan) => (
                  <article
                    className={getBatchResultClassName(scan)}
                    key={`${scan.final_url}-${scan.checked_at_utc}`}
                    onClick={() => setResult(scan)}
                  >
                    <div>
                      <strong>{scan.final_url}</strong>
                      <span>{getLocalizedPriority(scan.priority)}</span>
                    </div>
                    <b>{scan.score}</b>
                    <small>{scan.grade}</small>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-copy">{t('app.batchEmpty')}</p>
          )}
        </section>

        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
        {copyMessage ? <div className="copy-banner">{copyMessage}</div> : null}

        <section className="mission-grid">
          <aside className={`score-module ${getScoreTone(result?.score)}`}>
            <div className="module-heading">
              <span>{t('app.postureScore')}</span>
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
              <span>{t('app.scanPipeline')}</span>
              <strong>{result ? result.final_url : t('app.idle')}</strong>
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
                <span>{t('app.resolveUrl')}</span>
                <span>{t('app.fetchHeaders')}</span>
                <span>{t('app.scorePosture')}</span>
                <span>{t('app.buildNotes')}</span>
              </div>
            </div>

            <div className="control-grid">
              <article>
                <span>{t('app.present')}</span>
                <strong>{presentHeaders}</strong>
              </article>
              <article>
                <span>{t('app.missing')}</span>
                <strong>{missingHeaders}</strong>
              </article>
              <article>
                <span>{t('app.total')}</span>
                <strong>{totalHeaders || '--'}</strong>
              </article>
              <article>
                <span>{t('app.notes')}</span>
                <strong>{result ? result.review_notes_count : '--'}</strong>
              </article>
            </div>
          </section>
        </section>

        <section className="history-board">
          <div className="board-heading">
            <div>
              <p>{t('app.recentRuns')}</p>
              <h2>{t('app.scanHistory')}</h2>
            </div>
            <span>
              {scanHistory.length} {t('app.storedLocally')}
            </span>
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
                    <span>{getLocalizedPriority(scan.priority)}</span>
                  </div>
                  <b>{scan.score}</b>
                  <small>{scan.grade}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">{t('app.historyEmpty')}</p>
          )}
        </section>

        <section className="workbench">
          <div className="headers-board">
            <div className="board-heading">
              <div>
                <p>{t('app.securityControls')}</p>
                <h2>{t('app.headerMatrix')}</h2>
              </div>
              <span>
                {result
                  ? `${totalHeaders} ${t('app.controlsChecked')}`
                  : t('app.noScanData')}
              </span>
            </div>

            <div className="header-matrix">
              {result ? (
                result.header_findings.map((finding) => (
                  <article
                    className={finding.present ? 'control-card pass' : 'control-card fail'}
                    key={finding.header}
                  >
                    <div className="control-card-top">
                      <span
                        className={
                          finding.present
                            ? 'finding-status present'
                            : 'finding-status missing'
                        }
                      >
                        {finding.present ? t('app.present') : t('app.missing')}
                      </span>
                      <strong>{finding.points} pts</strong>
                    </div>
                    <h3>{finding.header}</h3>
                    <p>{finding.value ?? finding.note}</p>
                  </article>
                ))
              ) : (
                <div className="matrix-empty">{t('app.matrixEmpty')}</div>
              )}
            </div>
          </div>

          <aside className="triage-board">
            <div className="board-heading">
              <div>
                <p>{t('app.reviewQueue')}</p>
                <h2>{t('app.analystNotes')}</h2>
              </div>
              <span>
                {result
                  ? `${result.review_notes_count} ${t('app.items')}`
                  : t('app.idle')}
              </span>
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
              <p className="empty-copy">{t('app.notesEmpty')}</p>
            )}
          </aside>
        </section>
      </section>
    </main>
  )
}

export default App