import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Reporter } from './index.js';
import type { StepResult, SuiteResult, RunResult } from '../types.js';

/** 한 런의 스텝 상세 (로그/실패 사유 표시용). */
export interface DashboardStepSummary {
  label: string;
  status: string;
  duration: number;
  error?: string;
  screenshotBasename?: string;
  /** 실행한 스텝 payload (JSON). 펼침 상세에서 표시용 */
  stepPayload?: string;
}

/** 한 런의 요약. runs.json 배열 요소. */
export interface DashboardRunSummary {
  runId: string;
  timestamp: number;
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
  platform?: string;
  suites: { name: string; status: string; steps: DashboardStepSummary[] }[];
}

const RUN_HISTORY_MAX = 100;
const DASHBOARD_DIR = 'dashboard';

function stepLabel(step: StepResult['step']): string {
  const key = Object.keys(step)[0]!;
  const val = (step as Record<string, unknown>)[key];
  if (typeof val === 'string' || typeof val === 'number') {
    return `${key} ${val}`;
  }
  if (typeof val === 'object' && val !== null) {
    const inner = val as Record<string, unknown>;
    const parts = Object.entries(inner)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(' ');
    return `${key} ${parts}`;
  }
  return key;
}

/** RunResult → DashboardRunSummary 변환 (상세 로그·실패 사유 포함). */
export function runResultToSummary(
  result: RunResult,
  runId: string,
  platform?: string
): DashboardRunSummary {
  return {
    runId,
    timestamp: Date.now(),
    duration: result.duration,
    passed: result.passed,
    failed: result.failed,
    skipped: result.skipped,
    platform,
    suites: result.suites.map((s: SuiteResult) => ({
      name: s.name,
      status: s.status ?? (s.steps.some((st) => st.status === 'failed') ? 'failed' : 'passed'),
      steps: s.steps.map((st: StepResult) => ({
        label: stepLabel(st.step),
        status: st.status,
        duration: st.duration,
        ...(st.error && { error: st.error }),
        ...(st.screenshotPath && { screenshotBasename: st.screenshotPath.split(/[/\\]/).pop() }),
        stepPayload: JSON.stringify(st.step, null, 2),
      })),
    })),
  };
}

/** 최근 K회 안에서 (suiteName, stepLabel)이 pass 1회 이상 + fail 1회 이상이면 flaky. */
export function computeFlaky(
  runs: DashboardRunSummary[],
  windowSize: number = 20
): { suite: string; step: string; passCount: number; failCount: number }[] {
  const recent = runs.slice(-windowSize);
  const byKey = new Map<string, { passCount: number; failCount: number }>();
  for (const run of recent) {
    for (const suite of run.suites) {
      for (const step of suite.steps) {
        const key = `${suite.name}\0${step.label}`;
        const cur = byKey.get(key) ?? { passCount: 0, failCount: 0 };
        if (step.status === 'passed') cur.passCount += 1;
        if (step.status === 'failed') cur.failCount += 1;
        byKey.set(key, cur);
      }
    }
  }
  const flaky: { suite: string; step: string; passCount: number; failCount: number }[] = [];
  for (const [key, counts] of byKey) {
    if (counts.passCount >= 1 && counts.failCount >= 1) {
      const [suite, step] = key.split('\0');
      flaky.push({
        suite: suite!,
        step: step!,
        passCount: counts.passCount,
        failCount: counts.failCount,
      });
    }
  }
  return flaky;
}

/** 대시보드 정적 HTML. 서버에서 메모리로 서빙할 때 사용. */
export function buildIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>E2E Dashboard</title>
  <style>
    :root {
      --pass: #059669;
      --fail: #dc2626;
      --skip: #64748b;
      --flaky: #d97706;
      --bg: #f8fafc;
      --card: #fff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 1.5rem; background: var(--bg); color: var(--text); line-height: 1.5; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 1rem; }
    h2 { font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 1.5rem 0 0.75rem; }
    .card { background: var(--card); border-radius: 10px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 1rem; }
    .last-run { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; }
    .last-run .time { color: var(--muted); font-size: 0.9rem; }
    .last-run .badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; }
    .last-run .badge.pass { background: #d1fae5; color: var(--pass); }
    .last-run .badge.fail { background: #fee2e2; color: var(--fail); }
    .last-run .badge.skip { background: #f1f5f9; color: var(--skip); }
    .last-run .duration, .last-run .muted { color: var(--muted); font-size: 0.9rem; }
    .runs-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .runs-table th, .runs-table td { padding: 0.65rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    .runs-table th { font-weight: 500; color: var(--muted); }
    .runs-table tr.run-row { cursor: pointer; }
    .runs-table tr.run-row:hover { background: #f1f5f9; }
    .run-expand-icon { font-size: 0.65rem; color: var(--muted); margin-right: 0.25rem; }
    .runs-table .num.pass { color: var(--pass); font-weight: 500; }
    .runs-table .num.fail { color: var(--fail); font-weight: 500; }
    .run-detail { display: none; background: #f8fafc; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
    .run-detail.open { display: block; }
    .suite-block { margin-bottom: 1.25rem; }
    .suite-block:last-child { margin-bottom: 0; }
    .suite-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; }
    .suite-name.failed { color: var(--fail); }
    .suite-name.passed { color: var(--pass); }
    .steps-table { width: 100%; font-size: 0.85rem; border-collapse: collapse; }
    .steps-table th, .steps-table td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
    .steps-table .step-status { font-weight: 500; }
    .steps-table .step-status.passed { color: var(--pass); }
    .steps-table .step-status.failed { color: var(--fail); }
    .steps-table .step-status.skipped { color: var(--skip); }
    .steps-table .step-label { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    .steps-table .step-error { font-family: ui-monospace, monospace; font-size: 0.75rem; background: #fef2f2; color: #991b1b; padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; white-space: pre-wrap; word-break: break-all; }
    .steps-table .step-meta { font-size: 0.75rem; color: var(--muted); margin-top: 0.2rem; }
    .step-detail-toggle { cursor: pointer; color: var(--muted); font-size: 0.8rem; margin-left: 0.5rem; text-decoration: underline; }
    .step-detail-toggle:hover { color: #475569; }
    tr.step-detail { display: none; }
    tr.step-detail.open { display: table-row; }
    tr.step-detail td { background: #f1f5f9; padding: 0.6rem 0.75rem; vertical-align: top; border-bottom: 1px solid var(--border); }
    .step-detail-body pre { margin: 0; font-size: 0.75rem; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; }
    .step-detail-body .step-detail-screenshot { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }
    .flaky-list { list-style: none; padding: 0; margin: 0; }
    .flaky-list li { padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
    .flaky-list .suite { font-weight: 600; color: var(--muted); }
    .empty { color: var(--muted); font-style: italic; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>E2E Dashboard</h1>
    <div class="card" id="summary-card">Loading...</div>
    <h2>Recent runs</h2>
    <div class="card">
      <div id="runs"></div>
    </div>
    <h2>Flaky (pass + fail in last 20 runs)</h2>
    <div class="card" id="flaky-card">
      <div id="flaky"></div>
    </div>
  </div>
  <script>
    (function() {
      function esc(s) { if (s == null) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
      function showErr(msg) {
        var card = document.getElementById('summary-card');
        if (card) card.innerHTML = '<p class="empty" style="color:var(--fail)">' + esc(msg) + '</p>';
      }
      function toggleStepDetail(id) {
        var el = document.getElementById('step-detail-' + id);
        if (el) el.classList.toggle('open');
      }
      window.toggleStepDetail = toggleStepDetail;
      fetch('./runs.json')
        .then(function(r) {
          if (!r.ok) throw new Error('runs.json: ' + r.status + ' ' + r.statusText);
          return r.json();
        })
        .then(function(runs) {
          if (!Array.isArray(runs)) {
            showErr('runs.json is not an array.');
            document.getElementById('runs').innerHTML = '<p class="empty">Invalid data</p>';
            document.getElementById('flaky').innerHTML = '<p class="empty">—</p>';
            return;
          }
          if (runs.length === 0) {
            document.getElementById('summary-card').innerHTML = '<p class="empty">No runs yet. Run tests with <code>-r dashboard -o &lt;dir&gt;</code>.</p>';
            document.getElementById('runs').innerHTML = '<p class="empty">No runs</p>';
            document.getElementById('flaky').innerHTML = '<p class="empty">No flaky steps</p>';
            return;
          }
          var last = runs[runs.length - 1];
          var timeStr = last.timestamp != null ? new Date(last.timestamp).toLocaleString('ko-KR') : '';
          var durSec = (last.duration != null && !isNaN(last.duration)) ? (last.duration/1000).toFixed(1) + 's' : '';
          document.getElementById('summary-card').innerHTML =
            '<div class="last-run">' +
            '<span class="time">' + esc(timeStr) + '</span>' +
            '<span class="badge pass">' + (last.passed ?? 0) + ' passed</span>' +
            '<span class="badge fail">' + (last.failed ?? 0) + ' failed</span>' +
            ((last.skipped || 0) > 0 ? '<span class="badge skip">' + (last.skipped ?? 0) + ' skipped</span>' : '') +
            '<span class="duration">' + durSec + '</span>' +
            (last.platform ? '<span class="muted">' + esc(last.platform) + '</span>' : '') +
            '</div>';
          var runsHtml = '<table class="runs-table"><thead><tr><th>Time</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Duration</th></tr></thead><tbody>';
          for (var i = runs.length - 1; i >= 0 && i >= runs.length - 30; i--) {
            var r = runs[i];
            var idx = runs.length - 1 - i;
            var cls = (r.failed || 0) > 0 ? 'fail' : 'pass';
            var ts = r.timestamp != null ? new Date(r.timestamp).toLocaleString('ko-KR') : '';
            var dur = (r.duration != null && !isNaN(r.duration)) ? (r.duration/1000).toFixed(1) + 's' : '';
            runsHtml += '<tr class="run-row" onclick="var n=this.nextElementSibling; var d=n&&n.querySelector(\\'.run-detail\\'); if(d) d.classList.toggle(\\'open\\');"><td><span class="run-expand-icon" aria-hidden="true">\u25b6</span> ' + esc(ts) + '</td><td class="num ' + cls + '">' + (r.passed ?? 0) + '</td><td class="num">' + (r.failed ?? 0) + '</td><td>' + (r.skipped ?? 0) + '</td><td>' + dur + '</td></tr>';
            var detail = '<tr><td colspan="5" style="padding:0"><div class="run-detail" id="detail-' + idx + '">';
            var suitesList = r.suites || [];
            for (var si = 0; si < suitesList.length; si++) {
              var su = suitesList[si] || {};
              var suStatus = (su.status === 'failed') ? 'failed' : 'passed';
              detail += '<div class="suite-block"><div class="suite-name ' + suStatus + '">' + esc(su.name || '') + '</div>';
              detail += '<table class="steps-table"><thead><tr><th>Step</th><th>Status</th><th>Duration</th><th>Detail</th></tr></thead><tbody>';
              var stepsList = su.steps || [];
              for (var ti = 0; ti < stepsList.length; ti++) {
                var st = stepsList[ti] || {};
                var stepDetailId = idx + '-' + si + '-' + ti;
                var errHtml = st.error ? '<div class="step-error">' + esc(st.error) + '</div>' : '';
                var meta = (st.duration !== undefined && st.duration !== null ? (st.duration + 'ms') : '') + (st.screenshotBasename ? ' \u00b7 Screenshot: ' + esc(st.screenshotBasename) : '');
                if (meta) meta = '<div class="step-meta">' + meta + '</div>';
                var toggleHtml = ' <span class="step-detail-toggle" onclick="toggleStepDetail(\\'' + stepDetailId + '\\')">Detail</span>';
                detail += '<tr><td class="step-label">' + esc(st.label || '') + '</td><td class="step-status ' + esc(st.status || '') + '">' + esc(st.status || '') + '</td><td>' + (st.duration != null ? st.duration + 'ms' : '') + '</td><td>' + errHtml + meta + toggleHtml + '</td></tr>';
                var payloadContent = (st.stepPayload != null && st.stepPayload !== '') ? esc(st.stepPayload) : esc(st.label || '');
                var payloadHtml = '<div class="step-detail-body"><pre>' + payloadContent + '</pre>' + (st.screenshotBasename ? '<div class="step-detail-screenshot">Screenshot: ' + esc(st.screenshotBasename) + '</div>' : '') + '</div>';
                detail += '<tr class="step-detail" id="step-detail-' + stepDetailId + '"><td colspan="4">' + payloadHtml + '</td></tr>';
              }
              detail += '</tbody></table></div>';
            }
            detail += '</div></td></tr>';
            runsHtml += detail;
          }
          runsHtml += '</tbody></table>';
          document.getElementById('runs').innerHTML = runsHtml;
          var byKey = {};
          var windowSize = Math.min(20, runs.length);
          var recent = runs.slice(-windowSize);
          for (var j = 0; j < recent.length; j++) {
            var run = recent[j];
            for (var s = 0; s < (run.suites || []).length; s++) {
              var su = run.suites[s];
              for (var t = 0; t < (su.steps || []).length; t++) {
                var st = su.steps[t];
                var key = su.name + '::' + st.label;
                if (!byKey[key]) byKey[key] = { pass: 0, fail: 0 };
                if (st.status === 'passed') byKey[key].pass++;
                if (st.status === 'failed') byKey[key].fail++;
              }
            }
          }
          var flakyHtml = '';
          for (var k in byKey) {
            if (byKey[k].pass >= 1 && byKey[k].fail >= 1) {
              var parts = k.split('::');
              flakyHtml += '<li><span class="suite">' + esc(parts[0]) + '</span> — ' + esc(parts[1]) + ' (pass: ' + byKey[k].pass + ', fail: ' + byKey[k].fail + ')</li>';
            }
          }
          document.getElementById('flaky').innerHTML = flakyHtml ? '<ul class="flaky-list">' + flakyHtml + '</ul>' : '<p class="empty">No flaky steps</p>';
        })
        .catch(function(e) {
          showErr('Failed to load runs.json: ' + (e && e.message ? e.message : String(e)));
        });
    })();
  </script>
</body>
</html>`;
}

export class DashboardReporter implements Reporter {
  private outputDir: string;
  private platform?: string;

  constructor(outputDir: string, platform?: string) {
    this.outputDir = outputDir;
    this.platform = platform;
  }

  onSuiteStart(_name: string): void {}
  onStepResult(_result: StepResult): void {}
  onSuiteEnd(_result: SuiteResult): void {}

  onRunEnd(result: RunResult): void {
    const dir = join(this.outputDir, DASHBOARD_DIR);
    mkdirSync(dir, { recursive: true });
    const runsPath = join(dir, 'runs.json');

    let runs: DashboardRunSummary[] = [];
    if (existsSync(runsPath)) {
      try {
        const raw = readFileSync(runsPath, 'utf-8');
        runs = JSON.parse(raw) as DashboardRunSummary[];
        if (!Array.isArray(runs)) runs = [];
      } catch {
        runs = [];
      }
    }

    const runId = randomUUID();
    const summary = runResultToSummary(result, runId, this.platform);
    runs.push(summary);
    runs = runs.slice(-RUN_HISTORY_MAX);
    writeFileSync(runsPath, JSON.stringify(runs, null, 2), 'utf-8');
    writeFileSync(join(dir, 'index.html'), buildIndexHtml(), 'utf-8');
  }
}
