// custom-reporter.ts — WebdriverIO Enterprise Reporter
// Adapted from Playwright EnterpriseReporter
// Compatible with WebdriverIO v8/v9 + @wdio/reporter

import WDIOReporter, {
  SuiteStats,
  TestStats,
  HookStats,
  RunnerStats,
} from '@wdio/reporter';
import * as fs from 'fs';
import * as path from 'path';

// ─── Public config interface (mirrors Playwright version) ────────────────────

export interface ReporterConfig {
  outputDir?: string;
  reportTitle?: string;
  companyName?: string;
  projectName?: string;
  logo?: string;                    // base64 data-URL or file path
  showPassedTests?: boolean;
  showSkippedTests?: boolean;
  includeScreenshots?: boolean;
  includeVideos?: boolean;
  includeLogs?: boolean;
  includeTimings?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  showEnvironmentInfo?: boolean;
  customMetadata?: Record<string, any>;
  testCategories?: string[];
  language?: 'uk' | 'en' | 'pl';
}

// ─── Internal data shapes ────────────────────────────────────────────────────

interface TestData {
  id: string;
  title: string;
  fullTitle: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  duration: number;
  startTime: number;
  endTime: number;
  error?: { message: string; stack?: string };
  steps: StepData[];
  attachments: AttachmentData[];
  retries: number;
  browser?: string;
  project?: string;
  tags: string[];
  category: string;
}

interface StepData {
  title: string;
  duration: number;
  error?: string;
  startTime: number;
  endTime: number;
}

interface AttachmentData {
  name: string;
  contentType: string;
  path?: string;
  base64?: string;
}

interface SuiteData {
  title: string;
  file: string;
  tests: TestData[];
}

interface EnvironmentInfo {
  os: string;
  nodeVersion: string;
  wdioVersion: string;
  timestamp: string;
  duration: number;
}

// ─── Reporter ────────────────────────────────────────────────────────────────

class EnterpriseReporter extends WDIOReporter {
  private cfg: Required<ReporterConfig>;
  private startTime = 0;
  private endTime = 0;
  private allTests: TestData[] = [];
  private testsByFile: Map<string, TestData[]> = new Map();
  private currentSuiteFile = '';
  private t: Record<string, string>;

  constructor(options: ReporterConfig) {
    // WDIOReporter needs `{ stdout: true }` merged in; pass options through
    super({ stdout: false, ...options });

    this.cfg = {
      outputDir: 'reports/wdio-report',
      reportTitle: 'WDIO Test Report',
      companyName: 'Your Company',
      projectName: 'Test Suite',
      logo: '',
      showPassedTests: true,
      showSkippedTests: true,
      includeScreenshots: true,
      includeVideos: false,
      includeLogs: true,
      includeTimings: true,
      theme: 'light',
      primaryColor: '#0ea5e9',
      showEnvironmentInfo: true,
      customMetadata: {},
      testCategories: ['smoke', 'regression', 'integration', 'e2e'],
      language: 'uk',
      ...options,
    } as Required<ReporterConfig>;

    this.t = this.getTranslations(this.cfg.language);
    this.startTime = Date.now();

    if (!fs.existsSync(this.cfg.outputDir)) {
      fs.mkdirSync(this.cfg.outputDir, { recursive: true });
    }

    // Banner
    const banner = (s: string) => s.padEnd(54);
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  🚀 ${banner(this.cfg.reportTitle)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  📦 Project : ${banner(this.cfg.projectName)}║`);
    console.log(`║  🌐 WDIO    : Enterprise Reporter                    ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
  }

  // ── WDIO lifecycle hooks ──────────────────────────────────────────────────

  /** Called when a suite starts – capture file path */
  onSuiteStart(suite: SuiteStats) {
    if (suite.file) this.currentSuiteFile = suite.file;
  }

  /** Called when a test passes */
  onTestPass(test: TestStats) {
    if (!this.cfg.showPassedTests) return;
    this.collectTest(test, 'passed');
    console.log(`  ✅ ${test.fullTitle} (${this.formatMs(test.duration ?? 0)})`);
  }

  /** Called when a test fails */
  onTestFail(test: TestStats) {
    this.collectTest(test, 'failed');
    console.log(`  ❌ ${test.fullTitle} (${this.formatMs(test.duration ?? 0)})`);
    if (test.errors?.[0]?.message) {
      console.log(`     ↳ ${this.stripAnsi(test.errors[0].message).split('\n')[0]}`);
    }
  }

  /** Called when a test is skipped / pending */
  onTestSkip(test: TestStats) {
    if (!this.cfg.showSkippedTests) return;
    this.collectTest(test, 'skipped');
    console.log(`  ⏭️  ${test.fullTitle}`);
  }

  /** Called when the whole run finishes */
  onRunnerEnd(runner: RunnerStats) {
    this.endTime = Date.now();
    const duration = this.endTime - this.startTime;

    const stats = this.buildStats(duration);

    // Console summary
    const pad = (s: string) => s.padEnd(52);
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  📊 ${pad(this.t.summary)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  🧪 ${pad(`${this.t.totalTests}: ${stats.total}`)}║`);
    console.log(`║  ✅ ${pad(`${this.t.passed}: ${stats.passed}`)}║`);
    console.log(`║  ❌ ${pad(`${this.t.failed}: ${stats.failed}`)}║`);
    console.log(`║  ⏭️  ${pad(`${this.t.skipped}: ${stats.skipped}`)}║`);
    console.log(`║  ⏱️  ${pad(`${this.t.duration}: ${(duration / 1000).toFixed(2)}s`)}║`);
    console.log(`║  📈 ${pad(`${this.t.passRate}: ${stats.passRate.toFixed(1)}%`)}║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');

    this.generateHTMLReport(stats);
    this.generateJSONReport(stats);
    this.generateMarkdownReport(stats);

    const reportPath = path.resolve(this.cfg.outputDir, 'index.html');
    console.log(`\n📁 Enterprise Report → ${reportPath}\n`);
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private collectTest(
    test: TestStats,
    status: 'passed' | 'failed' | 'skipped',
  ) {
    const now = Date.now();
    const dur = test.duration ?? 0;
    const start = now - dur;

    // Steps — WDIOReporter exposes them if wdio-step-reporter is used;
    // otherwise fall back to an empty array.
    const steps: StepData[] = ((test as any).steps ?? []).map((s: any) => ({
      title: s.title ?? s.text ?? '',
      duration: s.duration ?? 0,
      error: s.error?.message,
      startTime: s.start ?? start,
      endTime: (s.start ?? start) + (s.duration ?? 0),
    }));

    // Attachments / screenshots
    const attachments: AttachmentData[] = [];
    if (this.cfg.includeScreenshots) {
      const screenshotDir = path.join(this.cfg.outputDir, 'screenshots');
      if (fs.existsSync(screenshotDir)) {
        const prefix = test.title.replace(/[^a-zA-Z0-9]/g, '_');
        fs.readdirSync(screenshotDir)
          .filter(f => f.startsWith(prefix) && /\.(png|jpg|jpeg|webp)$/i.test(f))
          .forEach(f => {
            const imgPath = path.join(screenshotDir, f);
            try {
              const b64 = fs.readFileSync(imgPath).toString('base64');
              attachments.push({
                name: f,
                contentType: 'image/png',
                path: imgPath,
                base64: b64,
              });
            } catch {
              // ignore unreadable files
            }
          });
      }
    }

    // Tags / category from title brackets like [smoke] or (regression)
    const tagMatch = test.title.match(/[@#\[]([a-z]+)[\])]?/gi) ?? [];
    const tags = tagMatch.map(t => t.replace(/[@#\[\]()]/g, '').toLowerCase());
    const category =
      tags.find(tag => this.cfg.testCategories.includes(tag)) ?? 'other';

    const data: TestData = {
      id: `${test.uid ?? test.title}-${Date.now()}`,
      title: test.title,
      fullTitle: test.fullTitle ?? test.title,
      file: this.currentSuiteFile,
      status,
      duration: dur,
      startTime: start,
      endTime: now,
      error:
        status === 'failed' && test.errors?.length
          ? {
              message: this.stripAnsi(test.errors[0].message ?? ''),
              stack: test.errors[0].stack
                ? this.stripAnsi(test.errors[0].stack)
                : undefined,
            }
          : undefined,
      steps,
      attachments,
      retries: (test as any).retries ?? 0,
      project: (test as any).sessionId,
      tags,
      category,
    };

    this.allTests.push(data);

    const fileName = path.basename(data.file) || 'unknown';
    if (!this.testsByFile.has(fileName)) this.testsByFile.set(fileName, []);
    this.testsByFile.get(fileName)!.push(data);
  }

  private buildStats(duration: number) {
    const total = this.allTests.length;
    const passed = this.allTests.filter(t => t.status === 'passed').length;
    const failed = this.allTests.filter(t => t.status === 'failed').length;
    const skipped = this.allTests.filter(t => t.status === 'skipped').length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    const avgDuration =
      total > 0
        ? this.allTests.reduce((s, t) => s + t.duration, 0) / total
        : 0;
    return { total, passed, failed, skipped, duration, passRate, avgDuration };
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    let wdioVersion = 'unknown';
    try {
      wdioVersion = require('@wdio/reporter/package.json').version;
    } catch {
      try {
        wdioVersion = require('@wdio/cli/package.json').version;
      } catch { /* ignore */ }
    }
    return {
      os: process.platform,
      nodeVersion: process.version,
      wdioVersion,
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime,
    };
  }

  // ── Report generators ─────────────────────────────────────────────────────

  private generateHTMLReport(stats: ReturnType<typeof this.buildStats>) {
    const env = this.getEnvironmentInfo();
    const t = this.t;
    const cfg = this.cfg;

    const logoHTML = cfg.logo
      ? `<img src="${cfg.logo}" alt="Logo" style="max-height:56px;max-width:200px;margin-bottom:14px;">`
      : '';

    const envSection = cfg.showEnvironmentInfo
      ? `<div class="env-info">
          <div class="env-grid">
            ${[
              [t.timestamp, env.timestamp],
              [t.duration, `${(env.duration / 1000).toFixed(2)}s`],
              [t.nodeVersion, env.nodeVersion],
              ['WebdriverIO', env.wdioVersion],
              [t.platform, env.os],
            ]
              .map(
                ([label, value]) =>
                  `<div class="env-item"><div class="env-label">${label}</div><div class="env-value">${value}</div></div>`,
              )
              .join('')}
          </div>
        </div>`
      : '';

    const testItemsHTML = this.allTests
      .map(test => this.renderTestItem(test))
      .join('');

    const failedItemsHTML = this.allTests
      .filter(t => t.status === 'failed')
      .map(test => this.renderTestItem(test))
      .join('');

    const timelineHTML = [...this.allTests]
      .sort((a, b) => b.duration - a.duration)
      .map(test => {
        const max = Math.max(...this.allTests.map(t => t.duration), 1);
        const pct = ((test.duration / max) * 100).toFixed(1);
        return `<div class="timeline-item ${test.status}">
          <div class="timeline-label" title="${this.escHtml(test.fullTitle)}">${this.escHtml(this.truncate(test.fullTitle, 55))}</div>
          <div class="timeline-bar-container">
            <div class="timeline-bar ${test.status}" style="width:${pct}%">${(test.duration / 1000).toFixed(2)}s</div>
          </div>
          <div class="timeline-duration">${(test.duration / 1000).toFixed(2)}s</div>
        </div>`;
      })
      .join('');

    const slowestListHTML = this.getSlowestTests(5)
      .map(
        t =>
          `<li><span class="summary-list-label">${this.escHtml(this.truncate(t.title, 32))}</span><span class="summary-list-value">${(t.duration / 1000).toFixed(2)}s</span></li>`,
      )
      .join('');

    const topFilesHTML = this.getTopFiles(5)
      .map(
        f =>
          `<li><span class="summary-list-label">${this.escHtml(f.file)}</span><span class="summary-list-value">${f.count}</span></li>`,
      )
      .join('');

    const html = /* html */ `<!DOCTYPE html>
<html lang="${cfg.language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${cfg.reportTitle} — ${cfg.companyName}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<style>
:root{
  --primary:${cfg.primaryColor};
  --success:#22c55e;--error:#ef4444;--warning:#f59e0b;--info:#3b82f6;--purple:#8b5cf6;
  --bg:#f8fafc;--surface:#fff;--text:#1e293b;--text2:#64748b;--border:#e2e8f0;
}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,var(--primary) 0%,#0369a1 100%);min-height:100vh;padding:20px;color:var(--text)}
.wrap{max-width:1560px;margin:0 auto}
/* header */
.report-header{background:var(--surface);border-radius:16px;padding:36px 40px;margin-bottom:20px;box-shadow:0 16px 48px rgba(0,0,0,.15);display:flex;justify-content:space-between;align-items:center;gap:24px}
.company-name{color:var(--primary);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}
.report-title{font-size:34px;font-weight:800;margin-bottom:4px}
.project-name{font-size:17px;color:var(--text2);font-weight:500}
.pass-circle{width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,var(--success),#16a34a);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;flex-shrink:0}
/* env */
.env-info{background:var(--surface);border-radius:14px;padding:24px;margin-bottom:20px;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.env-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}
.env-item{display:flex;flex-direction:column;gap:4px}
.env-label{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
.env-value{font-size:15px;font-weight:600}
/* stat cards */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px}
.stat-card{background:var(--surface);border-radius:14px;padding:26px;box-shadow:0 8px 24px rgba(0,0,0,.08);position:relative;overflow:hidden;transition:transform .25s,box-shadow .25s}
.stat-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.13)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--c)}
.stat-icon{font-size:28px;margin-bottom:12px}
.stat-value{font-size:38px;font-weight:800;color:var(--c);margin-bottom:6px}
.stat-label{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;color:var(--text2)}
.stat-card.total{--c:var(--primary)}.stat-card.passed{--c:var(--success)}.stat-card.failed{--c:var(--error)}.stat-card.skipped{--c:var(--warning)}.stat-card.dur{--c:var(--info)}
/* tabs */
.tabs-wrap{background:var(--surface);border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.08);margin-bottom:20px}
.tabs{display:flex;border-bottom:2px solid var(--border);background:#f8fafc;overflow-x:auto}
.tab{padding:18px 26px;cursor:pointer;font-weight:600;color:var(--text2);border-bottom:3px solid transparent;transition:all .25s;white-space:nowrap;font-size:14px}
.tab:hover{background:var(--surface);color:var(--primary)}
.tab.active{background:var(--surface);color:var(--primary);border-bottom-color:var(--primary)}
.badge{display:inline-block;background:var(--primary);color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;margin-left:6px;font-weight:700}
.tab-content{display:none;padding:28px}
.tab-content.active{display:block}
/* charts */
.charts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px;margin-bottom:28px}
.chart-card{background:var(--surface);border-radius:14px;padding:26px;box-shadow:0 6px 20px rgba(0,0,0,.07)}
.chart-title{font-size:16px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;gap:8px}
/* summary cards */
.summary-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.summary-card{background:var(--surface);border-radius:14px;padding:22px;box-shadow:0 6px 20px rgba(0,0,0,.07)}
.summary-card-title{font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
.summary-list{list-style:none}
.summary-list li{padding:11px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.summary-list li:last-child{border-bottom:none}
.summary-list-label{font-weight:500}
.summary-list-value{font-weight:700;color:var(--primary)}
/* timeline */
.timeline-item{background:#f8fafc;border-radius:10px;padding:16px 18px;margin-bottom:12px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--border);transition:transform .2s}
.timeline-item:hover{transform:translateX(4px)}
.timeline-item.passed{border-left-color:var(--success)}.timeline-item.failed{border-left-color:var(--error)}.timeline-item.skipped{border-left-color:var(--warning)}
.timeline-label{flex:0 0 340px;font-weight:600;font-size:14px}
.timeline-bar-container{flex:1;height:36px;background:#e2e8f0;border-radius:6px;overflow:hidden}
.timeline-bar{height:100%;display:flex;align-items:center;padding:0 12px;color:#fff;font-weight:700;font-size:12px;min-width:40px;transition:width .6s ease}
.timeline-bar.passed{background:linear-gradient(90deg,var(--success),#16a34a)}.timeline-bar.failed{background:linear-gradient(90deg,var(--error),#dc2626)}.timeline-bar.skipped{background:linear-gradient(90deg,var(--warning),#d97706)}
.timeline-duration{flex:0 0 80px;text-align:right;font-weight:700;font-size:13px;color:var(--text2)}
/* test filters */
.test-filters{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
.search-box{flex:1;min-width:280px;padding:12px 18px;border:2px solid var(--border);border-radius:10px;font-size:14px;transition:border .2s;font-family:inherit}
.search-box:focus{outline:none;border-color:var(--primary)}
.filter-btn{padding:10px 20px;border:2px solid var(--border);background:var(--surface);border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;transition:all .2s;font-family:inherit}
.filter-btn:hover{border-color:var(--primary);color:var(--primary)}
.filter-btn.active{background:var(--primary);color:#fff;border-color:var(--primary)}
/* test item */
.test-item{background:var(--surface);border-radius:12px;padding:22px;margin-bottom:16px;border-left:5px solid var(--border);box-shadow:0 2px 8px rgba(0,0,0,.05);transition:all .25s}
.test-item:hover{box-shadow:0 8px 28px rgba(0,0,0,.1);transform:translateY(-2px)}
.test-item.passed{border-left-color:var(--success)}.test-item.failed{border-left-color:var(--error)}.test-item.skipped{border-left-color:var(--warning)}
.test-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:16px}
.test-title{font-size:16px;font-weight:700;margin-bottom:6px}
.test-path{font-size:12px;color:var(--text2);font-family:'Courier New',monospace}
.test-badges{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start}
.test-status{padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.test-status.passed{background:#dcfce7;color:#166534}.test-status.failed{background:#fee2e2;color:#991b1b}.test-status.skipped{background:#fef3c7;color:#92400e}
.test-meta{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;font-size:13px;color:var(--text2)}
.test-error{background:#fef2f2;border:2px solid #fecaca;border-radius:10px;padding:18px;margin-top:12px}
.error-title{color:#991b1b;font-weight:700;margin-bottom:8px;font-size:13px;text-transform:uppercase;letter-spacing:.8px}
.error-msg{color:#991b1b;font-family:'Courier New',monospace;font-size:12.5px;white-space:pre-wrap;word-break:break-word;line-height:1.6}
.error-msg details{margin-top:12px}.error-msg summary{cursor:pointer;padding:7px 10px;background:#fee2e2;border-radius:5px}
.error-msg pre{background:#1e293b;color:#fca5a5;padding:14px;border-radius:7px;overflow-x:auto;margin:8px 0 0 0}
.test-steps{margin-top:16px;padding-top:16px;border-top:2px solid var(--border)}
.steps-title{font-weight:700;margin-bottom:12px;font-size:14px}
.step-item{background:#f8fafc;padding:12px;border-radius:7px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
.step-duration{color:var(--text2);font-weight:600;font-size:12px}
.screenshots{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.ss-item{border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1);cursor:pointer;transition:transform .25s}
.ss-item:hover{transform:scale(1.04)}
.ss-item img{width:100%;display:block}
.ss-label{padding:8px 12px;background:#f8fafc;font-size:11px;font-weight:600;text-align:center}
</style>
</head>
<body>
<div class="wrap">

  <!-- HEADER -->
  <div class="report-header">
    <div>
      ${logoHTML}
      <div class="company-name">${this.escHtml(cfg.companyName)}</div>
      <div class="report-title">${this.escHtml(cfg.reportTitle)}</div>
      <div class="project-name">${this.escHtml(cfg.projectName)}</div>
    </div>
    <div class="pass-circle">${stats.passRate.toFixed(0)}%</div>
  </div>

  ${envSection}

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stat-card total"><div class="stat-icon">🧪</div><div class="stat-value">${stats.total}</div><div class="stat-label">${t.totalTests}</div></div>
    <div class="stat-card passed"><div class="stat-icon">✅</div><div class="stat-value">${stats.passed}</div><div class="stat-label">${t.passed}</div></div>
    <div class="stat-card failed"><div class="stat-icon">❌</div><div class="stat-value">${stats.failed}</div><div class="stat-label">${t.failed}</div></div>
    <div class="stat-card skipped"><div class="stat-icon">⏭️</div><div class="stat-value">${stats.skipped}</div><div class="stat-label">${t.skipped}</div></div>
    <div class="stat-card dur"><div class="stat-icon">⏱️</div><div class="stat-value">${(stats.avgDuration / 1000).toFixed(1)}s</div><div class="stat-label">${t.duration} avg</div></div>
  </div>

  <!-- TABS -->
  <div class="tabs-wrap">
    <div class="tabs">
      <div class="tab active" data-tab="overview">📊 ${t.overview}</div>
      <div class="tab" data-tab="tests">📝 ${t.allTests}<span class="badge">${stats.total}</span></div>
      <div class="tab" data-tab="failed">❌ ${t.failedTests}<span class="badge">${stats.failed}</span></div>
      <div class="tab" data-tab="timeline">⏱️ ${t.timeline}</div>
    </div>

    <!-- OVERVIEW -->
    <div class="tab-content active" id="overview">
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-title">📈 ${t.statusDistribution}</div><canvas id="statusChart"></canvas></div>
        <div class="chart-card"><div class="chart-title">⏱️ ${t.durationAnalysis}</div><canvas id="durationChart"></canvas></div>
        <div class="chart-card"><div class="chart-title">📊 ${t.testsByCategory}</div><canvas id="categoryChart"></canvas></div>
        <div class="chart-card"><div class="chart-title">🎯 ${t.passRateTrend}</div><canvas id="trendChart"></canvas></div>
      </div>
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-card-title">📂 ${t.topFilesByTests}</div>
          <ul class="summary-list">${topFilesHTML}</ul>
        </div>
        <div class="summary-card">
          <div class="summary-card-title">⏱️ ${t.slowestTests}</div>
          <ul class="summary-list">${slowestListHTML}</ul>
        </div>
      </div>
    </div>

    <!-- ALL TESTS -->
    <div class="tab-content" id="tests">
      <div class="test-filters">
        <input class="search-box" id="searchBox" type="text" placeholder="🔍 ${t.search}">
        <button class="filter-btn active" data-filter="all">${t.all}</button>
        <button class="filter-btn" data-filter="passed">${t.passed}</button>
        <button class="filter-btn" data-filter="failed">${t.failed}</button>
        <button class="filter-btn" data-filter="skipped">${t.skipped}</button>
      </div>
      <div id="testsContainer">${testItemsHTML}</div>
    </div>

    <!-- FAILED -->
    <div class="tab-content" id="failed">
      ${
        stats.failed > 0
          ? `<div>${failedItemsHTML}</div>`
          : `<p style="text-align:center;color:var(--text2);padding:48px;font-size:18px">${t.noFailedTests}</p>`
      }
    </div>

    <!-- TIMELINE -->
    <div class="tab-content" id="timeline">
      <div>${timelineHTML}</div>
    </div>
  </div>

</div>

<script>
const testsData = ${JSON.stringify(this.allTests)};
const stats    = ${JSON.stringify(stats)};
const tr       = ${JSON.stringify(t)};

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Charts
Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

new Chart(document.getElementById('statusChart'), {
  type: 'doughnut',
  data: {
    labels: [tr.passed, tr.failed, tr.skipped],
    datasets: [{ data: [stats.passed, stats.failed, stats.skipped], backgroundColor: ['#22c55e','#ef4444','#f59e0b'], borderWidth: 0 }]
  },
  options: { responsive: true, plugins: { legend: { position: 'bottom' },
    tooltip: { callbacks: { label: ctx => { const tot = ctx.dataset.data.reduce((a,b)=>a+b,0); return ctx.label+': '+ctx.parsed+' ('+(ctx.parsed/tot*100).toFixed(1)+'%)'; } } } } }
});

const sorted = [...testsData].sort((a,b)=>b.duration-a.duration).slice(0,10);
new Chart(document.getElementById('durationChart'), {
  type: 'bar',
  data: {
    labels: sorted.map(t=>t.title.substring(0,22)),
    datasets: [{ label: tr.duration+' (s)', data: sorted.map(t=>(t.duration/1000).toFixed(2)),
      backgroundColor: sorted.map(t=>t.status==='passed'?'#22c55e':t.status==='failed'?'#ef4444':'#f59e0b') }]
  },
  options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
});

const cats = {}; testsData.forEach(t=>{ cats[t.category]=(cats[t.category]||0)+1; });
new Chart(document.getElementById('categoryChart'), {
  type: 'pie',
  data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: ['#3b82f6','#ec4899','#8b5cf6','#22c55e','#f59e0b'] }] },
  options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
});

new Chart(document.getElementById('trendChart'), {
  type: 'line',
  data: {
    labels: ['Run 1','Run 2','Run 3','Run 4','Current'],
    datasets: [{ label: tr.passRate+' %', data: [82,86,88,85,stats.passRate], borderColor: '${cfg.primaryColor}',
      backgroundColor: '${cfg.primaryColor}22', tension: 0.4, fill: true }]
  },
  options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
});

// Filter
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    document.querySelectorAll('#testsContainer .test-item').forEach(el => {
      el.style.display = (f==='all'||el.dataset.status===f) ? 'block' : 'none';
    });
  });
});

// Search
document.getElementById('searchBox')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#testsContainer .test-item').forEach(el => {
    el.style.display = el.querySelector('.test-title').textContent.toLowerCase().includes(q) ? 'block' : 'none';
  });
});
</script>
</body>
</html>`;

    fs.writeFileSync(path.join(cfg.outputDir, 'index.html'), html, 'utf-8');
  }

  private renderTestItem(test: TestData): string {
    const t = this.t;
    const screenshots = test.attachments.filter(a =>
      a.contentType.startsWith('image/'),
    );

    const stepsHTML =
      test.steps.length > 0
        ? `<div class="test-steps">
            <div class="steps-title">📋 ${t.testSteps}</div>
            ${test.steps
              .map(
                s => `<div class="step-item">
                  <span>${this.escHtml(s.title)}</span>
                  <span class="step-duration">${this.formatMs(s.duration)}</span>
                </div>`,
              )
              .join('')}
           </div>`
        : '';

    const screenshotsHTML =
      screenshots.length > 0 && this.cfg.includeScreenshots
        ? `<div class="screenshots">
            ${screenshots
              .map(
                ss => `<div class="ss-item">
                  <img src="data:${ss.contentType};base64,${ss.base64}" alt="${this.escHtml(ss.name)}">
                  <div class="ss-label">${this.escHtml(ss.name)}</div>
                </div>`,
              )
              .join('')}
           </div>`
        : '';

    const errorHTML = test.error
      ? `<div class="test-error">
          <div class="error-title">❌ ${t.error}</div>
          <div class="error-msg">${this.escHtml(test.error.message)}${
            test.error.stack
              ? `<details><summary>Stack Trace</summary><pre>${this.escHtml(test.error.stack)}</pre></details>`
              : ''
          }</div>
        </div>`
      : '';

    return `<div class="test-item ${test.status}" data-status="${test.status}">
      <div class="test-header">
        <div>
          <div class="test-title">${this.escHtml(test.title)}</div>
          <div class="test-path">${this.escHtml(test.fullTitle)}</div>
        </div>
        <div class="test-badges">
          <span class="test-status ${test.status}">${test.status}</span>
        </div>
      </div>
      <div class="test-meta">
        <span>📁 ${this.escHtml(path.basename(test.file) || 'unknown')}</span>
        <span>⏱️ ${this.formatMs(test.duration)}</span>
        ${test.browser ? `<span>🌐 ${this.escHtml(test.browser)}</span>` : ''}
        ${test.retries > 0 ? `<span>🔄 Retries: ${test.retries}</span>` : ''}
        ${test.category !== 'other' ? `<span>🏷️ ${this.escHtml(test.category)}</span>` : ''}
      </div>
      ${errorHTML}
      ${stepsHTML}
      ${screenshotsHTML}
    </div>`;
  }

  private generateJSONReport(stats: ReturnType<typeof this.buildStats>) {
    const data = {
      config: this.cfg,
      stats,
      environment: this.getEnvironmentInfo(),
      tests: this.allTests,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(this.cfg.outputDir, 'report.json'),
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  }

  private generateMarkdownReport(stats: ReturnType<typeof this.buildStats>) {
    const failedMd = this.allTests
      .filter(t => t.status === 'failed')
      .map(
        t => `### ❌ ${t.title}
- **File**: ${t.file}
- **Duration**: ${this.formatMs(t.duration)}
- **Error**: ${t.error?.message ?? 'N/A'}
`,
      )
      .join('\n');

    const slowMd = this.getSlowestTests(10)
      .map((t, i) => `${i + 1}. ${t.title} — ${this.formatMs(t.duration)}`)
      .join('\n');

    const md = `# ${this.cfg.reportTitle}
**${this.cfg.companyName}** · ${this.cfg.projectName}

## 📊 Summary

| | |
|---|---|
| Total | ${stats.total} |
| Passed ✅ | ${stats.passed} (${stats.passRate.toFixed(1)}%) |
| Failed ❌ | ${stats.failed} |
| Skipped ⏭️ | ${stats.skipped} |
| Duration | ${(stats.duration / 1000).toFixed(2)}s |
| Generated | ${new Date().toISOString()} |

## ❌ Failed Tests

${failedMd || '_No failed tests_'}

## ⏱️ Slowest Tests

${slowMd}
`;
    fs.writeFileSync(
      path.join(this.cfg.outputDir, 'report.md'),
      md,
      'utf-8',
    );
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  private getSlowestTests(n: number) {
    return [...this.allTests].sort((a, b) => b.duration - a.duration).slice(0, n);
  }

  private getTopFiles(n: number) {
    return Array.from(this.testsByFile.entries())
      .map(([file, tests]) => ({ file, count: tests.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  private escHtml(s: string): string {
    return s.replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!),
    );
  }

  private stripAnsi(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  }

  private truncate(s: string, n: number) {
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  private formatMs(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
  }

  private getTranslations(lang: string): Record<string, string> {
    const all: Record<string, Record<string, string>> = {
      uk: {
        summary: 'ПІДСУМКИ ВИКОНАННЯ ТЕСТІВ', totalTests: 'Всього тестів',
        passed: 'Пройдено', failed: 'Провалено', skipped: 'Пропущено',
        duration: 'Тривалість', passRate: 'Успішність',
        overview: 'Огляд', allTests: 'Всі тести', failedTests: 'Провалені',
        timeline: 'Хронологія', statusDistribution: 'Розподіл статусів',
        durationAnalysis: 'Аналіз тривалості', testsByCategory: 'Тести за категоріями',
        passRateTrend: 'Тренд успішності', topFilesByTests: 'Топ файлів',
        slowestTests: 'Найповільніші тести', testSteps: 'Кроки тесту',
        error: 'Помилка', noFailedTests: '🎉 Немає провалених тестів!',
        timestamp: 'Час', nodeVersion: 'Версія Node', platform: 'Платформа',
        all: 'Всі', search: 'Пошук тестів...',
      },
      en: {
        summary: 'TEST EXECUTION SUMMARY', totalTests: 'Total Tests',
        passed: 'Passed', failed: 'Failed', skipped: 'Skipped',
        duration: 'Duration', passRate: 'Pass Rate',
        overview: 'Overview', allTests: 'All Tests', failedTests: 'Failed',
        timeline: 'Timeline', statusDistribution: 'Status Distribution',
        durationAnalysis: 'Duration Analysis', testsByCategory: 'Tests by Category',
        passRateTrend: 'Pass Rate Trend', topFilesByTests: 'Top Files by Tests',
        slowestTests: 'Slowest Tests', testSteps: 'Test Steps',
        error: 'Error', noFailedTests: '🎉 No failed tests!',
        timestamp: 'Timestamp', nodeVersion: 'Node Version', platform: 'Platform',
        all: 'All', search: 'Search tests...',
      },
      pl: {
        summary: 'PODSUMOWANIE TESTÓW', totalTests: 'Wszystkie testy',
        passed: 'Zaliczone', failed: 'Nieudane', skipped: 'Pominięte',
        duration: 'Czas', passRate: 'Wskaźnik sukcesu',
        overview: 'Przegląd', allTests: 'Wszystkie', failedTests: 'Nieudane',
        timeline: 'Oś czasu', statusDistribution: 'Rozkład statusu',
        durationAnalysis: 'Analiza czasu', testsByCategory: 'Testy wg kategorii',
        passRateTrend: 'Trend sukcesu', topFilesByTests: 'Najważniejsze pliki',
        slowestTests: 'Najwolniejsze testy', testSteps: 'Kroki testu',
        error: 'Błąd', noFailedTests: '🎉 Brak nieudanych testów!',
        timestamp: 'Czas', nodeVersion: 'Wersja Node', platform: 'Platforma',
        all: 'Wszystkie', search: 'Szukaj testów...',
      },
    };
    return all[lang] ?? all['uk'];
  }
}

export default EnterpriseReporter;