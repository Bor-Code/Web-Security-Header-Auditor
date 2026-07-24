Web Security Header Auditor

Web Security Header Auditor is a passive security review tool for inspecting HTTP security headers, cookie flags, score posture, and remediation notes. It can be used from the command line, through a FastAPI API, or from a React GUI.

The tool does not exploit, fuzz, brute force, or send attack payloads. It only reviews HTTP response data returned by the target server.

Features

Passive HTTP response security header review

HTTPS usage detection

Security header scoring with grade and review priority

Header value warnings for risky or uncommon configurations

Cookie flag checks for Secure, HttpOnly, and SameSite

Review notes for missing or risky headers

Single URL and batch URL audits

Text, JSON, and CSV report output

Optional fail-below score threshold for CI-style usage

FastAPI API with /health and /audit

React GUI with single scan, batch scan, scan history, report actions, and TR/EN language support

Reviewed Security Controls

Control

Purpose

Content-Security-Policy

Helps reduce cross-site scripting and content injection risk.

Strict-Transport-Security

Helps enforce HTTPS usage after the first trusted visit.

X-Frame-Options

Helps reduce clickjacking risk.

X-Content-Type-Options

Helps prevent MIME type sniffing.

Referrer-Policy

Controls how much referrer information is shared.

Permissions-Policy

Restricts browser features available to the page.

Screenshots

GUI Batch Scan and Report Actions

The GUI supports single URL scans, batch target scanning, local scan history, JSON export, CSV export, and copyable summaries.



Score, Pipeline, and Scan History

Audit results include a posture score, grade, status code, HTTPS status, checked control count, review notes count, and locally stored scan history.



Header Matrix and Analyst Notes

The header matrix shows present and missing controls with status badges. The review queue provides analyst-friendly remediation notes.



Project Structure

.
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── i18n.ts
│   │   └── main.tsx
│   └── package.json
├── sample-inputs/
│   └── urls.txt
├── src/
│   ├── web_security_header_auditor.py
│   └── web_security_header_auditor_api.py
├── requirements.txt
└── README.md

Requirements

Python 3.11+

Node.js 20+

npm

Install Python dependencies:

python -m pip install -r .\requirements.txt

Install frontend dependencies:

npm --prefix .\frontend install

CLI Usage

Run a single URL audit:

python .\src\web_security_header_auditor.py --url https://example.com

Write JSON output:

python .\src\web_security_header_auditor.py --url https://example.com --json-out .\reports\example.json

Write CSV output:

python .\src\web_security_header_auditor.py --url https://example.com --csv-out .\reports\example.csv

Run batch audits from a file:

python .\src\web_security_header_auditor.py --urls-file .\sample-inputs\urls.txt --json-out .\reports\batch.json --csv-out .\reports\batch.csv

Fail the process when the score is below a threshold:

python .\src\web_security_header_auditor.py --url https://example.com --fail-below 80

API Usage

Start the API:

$env:PYTHONPATH = ".\src"
python -m uvicorn web_security_header_auditor_api:app --reload

Health check:

Invoke-RestMethod -Method Get -Uri http://127.0.0.1:8000/health

Run an audit:

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/audit `
  -ContentType "application/json" `
  -Body '{"url":"https://example.com"}'

OpenAPI documentation is available while the API is running:

http://127.0.0.1:8000/docs

GUI Usage

Start the backend API in one terminal:

$env:PYTHONPATH = ".\src"
python -m uvicorn web_security_header_auditor_api:app --reload

Start the frontend in a second terminal:

npm --prefix .\frontend run dev

Open the GUI:

http://localhost:5173/

The GUI supports:

Single URL audit

Batch URL audit

Batch summary metrics

Weakest target highlight

Clickable batch results

Scan history

Copy Summary

Download JSON

Download CSV

English and Turkish UI mode

Localized GUI audit output

Report Outputs

Text Report

The text report is intended for terminal review and human-readable summaries.

JSON Report

The JSON report preserves structured audit data for automation, APIs, or future tooling.

CSV Report

The CSV report is useful for spreadsheet review, simple batch comparison, and sharing summary data.

Scoring

The score is a review aid, not a vulnerability verdict. Lower scores indicate that more security headers are missing or that risky values may need review.

Score Range

Grade

Priority

80-100

A

Strong header posture

50-79

B/C

Needs review

0-49

D/F

High review priority

Safety Note

This tool performs passive HTTP response review only. It does not exploit, fuzz, brute force, bypass authentication, or send attack payloads.

Use the results as a security review starting point. Header findings should be validated against the application context before making production changes.

Validation

Compile the Python files:

python -m py_compile .\src\web_security_header_auditor.py
python -m py_compile .\src\web_security_header_auditor_api.py

Build the frontend:

npm --prefix .\frontend run build

Check API paths:

python -c "import sys; sys.path.insert(0, 'src'); from web_security_header_auditor_api import app; print(app.openapi()['paths'].keys())"

License

This project is intended for defensive security learning and passive review wokflows.