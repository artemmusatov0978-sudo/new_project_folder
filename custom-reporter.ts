// custom-reporter.ts — WebdriverIO Enterprise Reporter v2
// Compatible with WebdriverIO v8/v9 + @wdio/reporter

import WDIOReporter, {
  SuiteStats,
  TestStats,
  HookStats,
  RunnerStats,
} from '@wdio/reporter';
import * as fs from 'fs';
import * as path from 'path';

// ─── Public config interface ────────────────────────────────────────────────

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

interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
}

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
  logs: LogEntry[];
  retries: number;
  browser?: string;
  browserVersion?: string;
  mobile?: MobileInfo;       // populated for Appium tests
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

// 'android' | 'ios' | 'web' — resolved from Appium caps
type PlatformType = 'android' | 'ios' | 'web' | 'unknown';

interface MobileInfo {
  platform: PlatformType;
  platformVersion: string;   // e.g. "17.2", "14"
  deviceName: string;        // e.g. "iPhone 15 Pro", "Pixel 8"
  isRealDevice: boolean;
}

interface EnvironmentInfo {
  os: string;
  nodeVersion: string;
  wdioVersion: string;
  timestamp: string;
  duration: number;
  browser?: string;
  mobile?: MobileInfo;
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

  // Per-test state: logs and screenshots accumulate between onTestStart / onTestEnd
  private currentTestLogs: LogEntry[] = [];
  private currentTestScreenshots: AttachmentData[] = [];
  private currentTestStartTime = 0;

  // Runner-level capabilities (populated in onRunnerStart)
  private runnerCaps: Record<string, any> = {};
  private detectedBrowser = 'unknown';
  private runnerMobile: MobileInfo | undefined = undefined;

  constructor(options: ReporterConfig) {
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

    const banner = (s: string) => s.padEnd(54);
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  🚀 ${banner(this.cfg.reportTitle)}║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  📦 Project : ${banner(this.cfg.projectName)}║`);
    console.log(`║  🌐 WDIO    : Enterprise Reporter v2                 ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');
  }

  // ── WDIO lifecycle hooks ──────────────────────────────────────────────────

  /**
   * Called once per worker process start — gives us real capabilities so we
   * can resolve the browser name instead of showing "unknown driver".
   */
  onRunnerStart(runner: RunnerStats) {
    const caps: any =
      (runner as any).capabilities ??
      (runner as any).desiredCapabilities ??
      {};

    this.runnerCaps = caps;

    // ── Detect mobile platform via Appium caps ──────────────────────────────
    const platform = (
      caps.platformName ??
      caps['appium:platformName'] ??
      ''
    ).toString().toLowerCase();

    if (platform === 'android' || platform === 'ios') {
      this.runnerMobile = this.parseMobileCaps(caps);
      this.detectedBrowser = platform; // 'android' | 'ios'
    } else {
      // Web browser fallback
      this.runnerMobile = undefined;
      this.detectedBrowser =
        caps.browserName ??
        (caps['goog:chromeOptions']?.binary?.toLowerCase().includes('chrome') ? 'chrome' :
        caps['moz:firefoxOptions'] ? 'firefox' :
        caps['ms:edgeOptions'] ? 'edge' :
        caps.app ? 'mobile-app' :
        'unknown');
    }

    // Console banner with platform info
    if (this.runnerMobile) {
      const m = this.runnerMobile;
      const icon = m.platform === 'ios' ? '🍎' : '🤖';
      console.log(`  ${icon} Platform  : ${m.platform.toUpperCase()} ${m.platformVersion}`);
      console.log(`  📱 Device    : ${m.deviceName} (${m.isRealDevice ? 'real device' : 'emulator/simulator'})`);
    }
  }

  /**
   * Parse Appium capabilities into a typed MobileInfo object.
   * Supports both legacy (appium:xxx) and plain key formats.
   */
  private parseMobileCaps(caps: any): MobileInfo {
    const get = (key: string): string =>
      (caps[`appium:${key}`] ?? caps[key] ?? '').toString().trim();

    const platform = (get('platformName')).toLowerCase() as PlatformType;
    const platformVersion = get('platformVersion') ?? get('osVersion') ?? '';
    const deviceName = get('deviceName') ?? get('avd') ?? '';

    // isRealDevice: explicit flag → UDID present → not emulator/simulator name
    const udid = get('udid');
    const explicitFlag = caps['appium:isRealDevice'] ?? caps.isRealDevice;
    const isRealDevice: boolean =
      explicitFlag !== undefined
        ? Boolean(explicitFlag)
        : udid.length > 0
          ? !udid.toLowerCase().includes('emulator')
          : (!deviceName.toLowerCase().includes('emulator') &&
             !deviceName.toLowerCase().includes('simulator'));

    return { platform, platformVersion, deviceName, isRealDevice };
  }

  /** Called when a suite starts – capture file path */
  onSuiteStart(suite: SuiteStats) {
    if (suite.file) this.currentSuiteFile = suite.file;
  }

  /** Called when a single test starts */
  onTestStart(test: TestStats) {
    this.currentTestLogs = [];
    this.currentTestScreenshots = [];
    this.currentTestStartTime = Date.now();
  }

  onBeforeCommand(_command: any) {
    // Reserved for future command-level instrumentation
  }

  onAfterCommand(command: any) {
    // Capture base64 screenshots from takeScreenshot commands
    if (command?.command === 'takeScreenshot' && command?.result) {
      const b64: string = command.result as string;
      if (b64 && typeof b64 === 'string' && b64.length > 100) {
        this.currentTestScreenshots.push({
          name: `screenshot-${Date.now()}.png`,
          contentType: 'image/png',
          base64: b64,
        });
      }
    }

    // Capture browser console logs from getLogs / getLog commands
    if (command?.command === 'getLog' || command?.command === 'getLogs') {
      const entries: any[] = command?.result ?? [];
      entries.forEach((entry: any) => {
        if (!entry?.message) return;
        const level = (entry.level ?? 'log').toLowerCase();
        this.currentTestLogs.push({
          level: level as LogEntry['level'],
          message: this.stripAnsi(String(entry.message)),
          timestamp: entry.timestamp ?? Date.now(),
        });
      });
    }
  }

  /** Called when a test passes */
  onTestPass(test: TestStats) {
    if (!this.cfg.showPassedTests) return;
    this.collectTest(test, 'passed');
    console.log(`  ✅ ${test.fullTitle} (${this.formatMs(test.duration ?? 0)})`);
    if (this.cfg.includeLogs && this.currentTestLogs.length > 0) {
      console.log(`     📋 Console logs (${this.currentTestLogs.length}):`);
      this.currentTestLogs
        .filter(l => l.level !== 'error')
        .slice(0, 5)
        .forEach(l =>
          console.log(`        [${l.level.toUpperCase()}] ${l.message.split('\n')[0].substring(0, 120)}`),
        );
    }
  }

  /** Called when a test fails */
  onTestFail(test: TestStats) {
    this.collectTest(test, 'failed');
    console.log(`  ❌ ${test.fullTitle} (${this.formatMs(test.duration ?? 0)})`);
    if (test.errors?.[0]?.message) {
      console.log(`     ↳ ${this.stripAnsi(test.errors[0].message).split('\n')[0].substring(0, 120)}`);
    }
    // Print all console logs collected during this test
    if (this.cfg.includeLogs && this.currentTestLogs.length > 0) {
      console.log(`     📋 Console logs (${this.currentTestLogs.length}):`);
      this.currentTestLogs
        .slice(0, 10)
        .forEach(l =>
          console.log(`        [${l.level.toUpperCase()}] ${l.message.split('\n')[0].substring(0, 120)}`),
        );
    }
    if (this.currentTestScreenshots.length > 0) {
      console.log(`     📸 Screenshots captured: ${this.currentTestScreenshots.length}`);
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
    const start = this.currentTestStartTime || now - dur;

    const steps: StepData[] = ((test as any).steps ?? []).map((s: any) => ({
      title: s.title ?? s.text ?? '',
      duration: s.duration ?? 0,
      error: s.error?.message,
      startTime: s.start ?? start,
      endTime: (s.start ?? start) + (s.duration ?? 0),
    }));

    // ── Screenshots ──
    // Combine screenshots captured via onAfterCommand with files from disk
    const attachments: AttachmentData[] = [...this.currentTestScreenshots];
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
              attachments.push({ name: f, contentType: 'image/png', path: imgPath, base64: b64 });
            } catch { /* ignore unreadable files */ }
          });
      }
    }

    // ── Logs ──
    // Merge logs gathered via onAfterCommand with any exposed via test.output
    const logs: LogEntry[] = [...this.currentTestLogs];
    const rawOutput: string[] = (test as any).output ?? [];
    rawOutput.forEach(line => {
      if (typeof line === 'string' && line.trim()) {
        logs.push({ level: 'log', message: this.stripAnsi(line), timestamp: now });
      }
    });

    // ── Browser / Mobile detection ──
    // Priority: per-test session caps → runner-level caps → runner start detection
    const testCaps: any = (test as any).capabilities ?? this.runnerCaps;
    const capPlatform = (
      testCaps?.platformName ??
      testCaps?.['appium:platformName'] ??
      ''
    ).toString().toLowerCase();

    let mobile: MobileInfo | undefined;
    let browserName: string;
    let browserVersion: string;

    if (capPlatform === 'android' || capPlatform === 'ios') {
      mobile = this.parseMobileCaps(testCaps);
      browserName = capPlatform;
      browserVersion = mobile.platformVersion;
    } else if (this.runnerMobile) {
      // Fall back to runner-level mobile info if per-test caps don't have platform
      mobile = this.runnerMobile;
      browserName = mobile.platform;
      browserVersion = mobile.platformVersion;
    } else {
      mobile = undefined;
      browserName = testCaps?.browserName ?? this.detectedBrowser;
      browserVersion = testCaps?.browserVersion ?? testCaps?.version ?? '';
    }

    // ── Tags / category from title brackets like [smoke] or @regression ──
    const tagMatch = test.title.match(/[@#\[]([a-z0-9_-]+)[\])]?/gi) ?? [];
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
      logs,
      retries: (test as any).retries ?? 0,
      browser: browserName,
      browserVersion,
      mobile,
      project: (test as any).sessionId,
      tags,
      category,
    };

    this.allTests.push(data);

    const fileName = path.basename(data.file) || 'unknown';
    if (!this.testsByFile.has(fileName)) this.testsByFile.set(fileName, []);
    this.testsByFile.get(fileName)!.push(data);

    // Reset per-test buffers
    this.currentTestLogs = [];
    this.currentTestScreenshots = [];
    this.currentTestStartTime = 0;
  }

  private buildStats(duration: number) {
    const total = this.allTests.length;
    const passed = this.allTests.filter(t => t.status === 'passed').length;
    const failed = this.allTests.filter(t => t.status === 'failed').length;
    const skipped = this.allTests.filter(t => t.status === 'skipped').length;
    const passRate = total > 0 ? (passed / total) * 100 : 0;
    const avgDuration =
      total > 0 ? this.allTests.reduce((s, t) => s + t.duration, 0) / total : 0;
    return { total, passed, failed, skipped, duration, passRate, avgDuration };
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    let wdioVersion = 'unknown';
    try { wdioVersion = require('@wdio/reporter/package.json').version; } catch {
      try { wdioVersion = require('@wdio/cli/package.json').version; } catch { /* ignore */ }
    }
    return {
      os: process.platform,
      nodeVersion: process.version,
      wdioVersion,
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime,
      browser: this.detectedBrowser,
      mobile: this.runnerMobile,
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

    const envRows: [string, string][] = [
      [t.timestamp, env.timestamp],
      [t.duration, `${(env.duration / 1000).toFixed(2)}s`],
      [t.nodeVersion, env.nodeVersion],
      ['WebdriverIO', env.wdioVersion],
      [t.platform, env.os],
    ];

    if (env.mobile) {
      const icon = env.mobile.platform === 'ios' ? '🍎' : '🤖';
      envRows.push([`${icon} Platform`, `${env.mobile.platform.toUpperCase()} ${env.mobile.platformVersion}`]);
      envRows.push(['📱 Device', `${env.mobile.deviceName} (${env.mobile.isRealDevice ? t.realDevice : t.simulator})`]);
    } else {
      envRows.push(['Browser', env.browser ?? 'unknown']);
    }

    const envSection = cfg.showEnvironmentInfo
      ? `<div class="env-info">
          <div class="env-grid">
            ${envRows.map(([label, value]) =>
              `<div class="env-item"><div class="env-label">${label}</div><div class="env-value">${value}</div></div>`,
            ).join('')}
          </div>
        </div>`
      : '';

    const allCategories = [...new Set(this.allTests.map(t => t.category))];

    const testItemsHTML = this.allTests.map(test => this.renderTestItem(test)).join('');
    const failedItemsHTML = this.allTests.filter(t => t.status === 'failed').map(test => this.renderTestItem(test)).join('');

    const timelineHTML = [...this.allTests]
      .sort((a, b) => b.duration - a.duration)
      .map(test => {
        const max = Math.max(...this.allTests.map(t => t.duration), 1);
        const pct = ((test.duration / max) * 100).toFixed(1);
        return `<div class="timeline-item ${test.status}" data-duration="${test.duration}" data-status="${test.status}">
          <div class="timeline-label" title="${this.escHtml(test.fullTitle)}">${this.escHtml(this.truncate(test.fullTitle, 55))}</div>
          <div class="timeline-bar-container">
            <div class="timeline-bar ${test.status}" style="width:${pct}%">${(test.duration / 1000).toFixed(2)}s</div>
          </div>
          <div class="timeline-duration">${(test.duration / 1000).toFixed(2)}s</div>
        </div>`;
      }).join('');

    const slowestListHTML = this.getSlowestTests(5)
      .map(t => `<li><span class="summary-list-label">${this.escHtml(this.truncate(t.title, 32))}</span><span class="summary-list-value">${(t.duration / 1000).toFixed(2)}s</span></li>`)
      .join('');

    const topFilesHTML = this.getTopFiles(5)
      .map(f => `<li><span class="summary-list-label">${this.escHtml(f.file)}</span><span class="summary-list-value">${f.count}</span></li>`)
      .join('');

    // Collect unique platforms for platform filter (only if mixed)
    const allPlatforms = [...new Set(this.allTests.map(t => t.mobile?.platform ?? t.browser ?? 'web'))];
    const showPlatformFilter = allPlatforms.length > 1;
    const platformFilterBtns = allPlatforms
      .map(p => {
        const icon = p === 'ios' ? '🍎' : p === 'android' ? '🤖' : '🌐';
        return `<button class="filter-btn" data-filter-platform="${p}">${icon} ${p}</button>`;
      })
      .join('');

    const maxDuration = Math.max(...this.allTests.map(t => t.duration), 1000);

    const categoryFilterBtns = allCategories
      .map(cat => `<button class="filter-btn" data-filter-cat="${cat}">${cat}</button>`)
      .join('');

    const html = `<!DOCTYPE html>
<html lang="${cfg.language}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${cfg.reportTitle} — ${cfg.companyName}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<style>
:root{--primary:${cfg.primaryColor};--success:#22c55e;--error:#ef4444;--warning:#f59e0b;--info:#3b82f6;--purple:#8b5cf6;--bg:#f8fafc;--surface:#fff;--text:#1e293b;--text2:#64748b;--border:#e2e8f0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,var(--primary) 0%,#0369a1 100%);min-height:100vh;padding:20px;color:var(--text)}
.wrap{max-width:1560px;margin:0 auto}
.report-header{background:var(--surface);border-radius:16px;padding:36px 40px;margin-bottom:20px;box-shadow:0 16px 48px rgba(0,0,0,.15);display:flex;justify-content:space-between;align-items:center;gap:24px}
.company-name{color:var(--primary);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px}
.report-title{font-size:34px;font-weight:800;margin-bottom:4px}
.project-name{font-size:17px;color:var(--text2);font-weight:500}
.pass-circle{width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,var(--success),#16a34a);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;flex-shrink:0}
.env-info{background:var(--surface);border-radius:14px;padding:24px;margin-bottom:20px;box-shadow:0 8px 24px rgba(0,0,0,.08)}
.env-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:18px}
.env-item{display:flex;flex-direction:column;gap:4px}
.env-label{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
.env-value{font-size:15px;font-weight:600}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:20px}
.stat-card{background:var(--surface);border-radius:14px;padding:26px;box-shadow:0 8px 24px rgba(0,0,0,.08);position:relative;overflow:hidden;transition:transform .25s,box-shadow .25s}
.stat-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.13)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--c)}
.stat-icon{font-size:28px;margin-bottom:12px}
.stat-value{font-size:38px;font-weight:800;color:var(--c);margin-bottom:6px}
.stat-label{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;color:var(--text2)}
.stat-card.total{--c:var(--primary)}.stat-card.passed{--c:var(--success)}.stat-card.failed{--c:var(--error)}.stat-card.skipped{--c:var(--warning)}.stat-card.dur{--c:var(--info)}
.tabs-wrap{background:var(--surface);border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.08);margin-bottom:20px}
.tabs{display:flex;border-bottom:2px solid var(--border);background:#f8fafc;overflow-x:auto}
.tab{padding:18px 26px;cursor:pointer;font-weight:600;color:var(--text2);border-bottom:3px solid transparent;transition:all .25s;white-space:nowrap;font-size:14px}
.tab:hover{background:var(--surface);color:var(--primary)}
.tab.active{background:var(--surface);color:var(--primary);border-bottom-color:var(--primary)}
.badge{display:inline-block;background:var(--primary);color:#fff;border-radius:10px;padding:2px 8px;font-size:11px;margin-left:6px;font-weight:700}
.tab-content{display:none;padding:28px}
.tab-content.active{display:block}
.charts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px;margin-bottom:28px}
.chart-card{background:var(--surface);border-radius:14px;padding:26px;box-shadow:0 6px 20px rgba(0,0,0,.07)}
.chart-title{font-size:16px;font-weight:700;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.summary-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.summary-card{background:var(--surface);border-radius:14px;padding:22px;box-shadow:0 6px 20px rgba(0,0,0,.07)}
.summary-card-title{font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
.summary-list{list-style:none}
.summary-list li{padding:11px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.summary-list li:last-child{border-bottom:none}
.summary-list-label{font-weight:500}
.summary-list-value{font-weight:700;color:var(--primary)}
/* Timeline */
.timeline-filters{display:flex;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap;padding:18px;background:#f8fafc;border-radius:12px;border:2px solid var(--border)}
.timeline-filters label{font-weight:700;font-size:13px;color:var(--text2);white-space:nowrap}
.timeline-range{flex:1;min-width:200px;accent-color:var(--primary)}
.timeline-range-val{font-weight:700;color:var(--primary);min-width:70px;text-align:right}
.timeline-status-filters{display:flex;gap:8px;flex-wrap:wrap}
.tl-count{font-size:12px;color:var(--text2);margin-left:auto;font-weight:600}
.timeline-item{background:#f8fafc;border-radius:10px;padding:16px 18px;margin-bottom:12px;display:flex;align-items:center;gap:16px;border-left:4px solid var(--border);transition:transform .2s}
.timeline-item:hover{transform:translateX(4px)}
.timeline-item.passed{border-left-color:var(--success)}.timeline-item.failed{border-left-color:var(--error)}.timeline-item.skipped{border-left-color:var(--warning)}
.timeline-label{flex:0 0 340px;font-weight:600;font-size:14px}
.timeline-bar-container{flex:1;height:36px;background:#e2e8f0;border-radius:6px;overflow:hidden}
.timeline-bar{height:100%;display:flex;align-items:center;padding:0 12px;color:#fff;font-weight:700;font-size:12px;min-width:40px}
.timeline-bar.passed{background:linear-gradient(90deg,var(--success),#16a34a)}.timeline-bar.failed{background:linear-gradient(90deg,var(--error),#dc2626)}.timeline-bar.skipped{background:linear-gradient(90deg,var(--warning),#d97706)}
.timeline-duration{flex:0 0 80px;text-align:right;font-weight:700;font-size:13px;color:var(--text2)}
/* Test filters */
.test-filters{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap;align-items:center}
.filter-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;width:100%}
.filter-row-label{font-size:12px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-right:4px;white-space:nowrap}
.search-box{flex:1;min-width:240px;padding:11px 18px;border:2px solid var(--border);border-radius:10px;font-size:14px;transition:border .2s;font-family:inherit}
.search-box:focus{outline:none;border-color:var(--primary)}
.filter-btn{padding:9px 18px;border:2px solid var(--border);background:var(--surface);border-radius:10px;cursor:pointer;font-weight:600;font-size:12px;transition:all .2s;font-family:inherit}
.filter-btn:hover{border-color:var(--primary);color:var(--primary)}
.filter-btn.active{background:var(--primary);color:#fff;border-color:var(--primary)}
.results-count{font-size:13px;color:var(--text2);font-weight:600}
/* Test item */
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
/* Console Logs */
.test-logs{margin-top:16px;padding-top:16px;border-top:2px solid var(--border)}
.logs-title{font-weight:700;margin-bottom:10px;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none}
.logs-title::after{content:'▼';font-size:10px;color:var(--text2);margin-left:4px}
.logs-title.collapsed::after{content:'▶'}
.logs-body{overflow:hidden}
.log-item{font-family:'Courier New',monospace;font-size:12px;padding:7px 12px;border-radius:6px;margin-bottom:5px;line-height:1.5;word-break:break-all}
.log-item.log,.log-item.info{background:#f0f9ff;color:#0369a1;border-left:3px solid #3b82f6}
.log-item.warn{background:#fffbeb;color:#92400e;border-left:3px solid #f59e0b}
.log-item.error{background:#fef2f2;color:#991b1b;border-left:3px solid #ef4444}
.log-item.debug{background:#f5f3ff;color:#4c1d95;border-left:3px solid #8b5cf6}
.log-level{font-weight:700;text-transform:uppercase;font-size:10px;margin-right:8px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.08)}
.log-time{font-size:10px;color:var(--text2);margin-right:8px}
/* Steps */
.test-steps{margin-top:16px;padding-top:16px;border-top:2px solid var(--border)}
.steps-title{font-weight:700;margin-bottom:12px;font-size:14px}
.step-item{background:#f8fafc;padding:12px;border-radius:7px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-size:13px}
.step-duration{color:var(--text2);font-weight:600;font-size:12px}
/* Screenshots */
.screenshots{margin-top:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.ss-item{border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1);cursor:pointer;transition:transform .25s}
.ss-item:hover{transform:scale(1.04)}
.ss-item img{width:100%;display:block}
.ss-label{padding:8px 12px;background:#f8fafc;font-size:11px;font-weight:600;text-align:center}
.no-results{text-align:center;color:var(--text2);padding:48px;font-size:18px}
/* Platform badges */
.platform-badge{padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px;display:inline-flex;align-items:center;gap:4px}
.platform-badge.ios{background:#f0f5ff;color:#1d4ed8;border:1.5px solid #bfdbfe}
.platform-badge.android{background:#f0fdf4;color:#166534;border:1.5px solid #bbf7d0}
.platform-badge.web{background:#faf5ff;color:#6d28d9;border:1.5px solid #ddd6fe}
</style>
</head>
<body>
<div class="wrap">

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

  <div class="stats-grid">
    <div class="stat-card total"><div class="stat-icon">🧪</div><div class="stat-value">${stats.total}</div><div class="stat-label">${t.totalTests}</div></div>
    <div class="stat-card passed"><div class="stat-icon">✅</div><div class="stat-value">${stats.passed}</div><div class="stat-label">${t.passed}</div></div>
    <div class="stat-card failed"><div class="stat-icon">❌</div><div class="stat-value">${stats.failed}</div><div class="stat-label">${t.failed}</div></div>
    <div class="stat-card skipped"><div class="stat-icon">⏭️</div><div class="stat-value">${stats.skipped}</div><div class="stat-label">${t.skipped}</div></div>
    <div class="stat-card dur"><div class="stat-icon">⏱️</div><div class="stat-value">${(stats.avgDuration / 1000).toFixed(1)}s</div><div class="stat-label">${t.duration} avg</div></div>
  </div>

  <div class="tabs-wrap">
    <div class="tabs">
      <div class="tab active" data-tab="overview">📊 ${t.overview}</div>
      <div class="tab" data-tab="tests">📝 ${t.allTests}<span class="badge">${stats.total}</span></div>
      <div class="tab" data-tab="failed">❌ ${t.failedTests}<span class="badge">${stats.failed}</span></div>
      <div class="tab" data-tab="timeline">⏱️ ${t.timeline}</div>
    </div>

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

    <div class="tab-content" id="tests">
      <div class="test-filters">
        <div class="filter-row">
          <input class="search-box" id="searchBox" type="text" placeholder="🔍 ${t.search}">
          <span class="results-count" id="resultsCount"></span>
        </div>
        <div class="filter-row">
          <span class="filter-row-label">📌 ${t.status}:</span>
          <button class="filter-btn active" data-filter="all">${t.all}</button>
          <button class="filter-btn" data-filter="passed">✅ ${t.passed}</button>
          <button class="filter-btn" data-filter="failed">❌ ${t.failed}</button>
          <button class="filter-btn" data-filter="skipped">⏭️ ${t.skipped}</button>
        </div>
        ${allCategories.length > 1 ? `<div class="filter-row">
          <span class="filter-row-label">🏷️ ${t.category}:</span>
          <button class="filter-btn active" data-filter-cat="all">${t.all}</button>
          ${categoryFilterBtns}
        </div>` : ''}
        ${showPlatformFilter ? `<div class="filter-row">
          <span class="filter-row-label">📱 ${t.platformLabel}:</span>
          <button class="filter-btn active" data-filter-platform="all">${t.all}</button>
          ${platformFilterBtns}
        </div>` : ''}
      </div>
      <div id="testsContainer">${testItemsHTML}</div>
      <div id="noResults" class="no-results" style="display:none">🔍 ${t.noResults}</div>
    </div>

    <div class="tab-content" id="failed">
      ${stats.failed > 0
        ? `<div>${failedItemsHTML}</div>`
        : `<p style="text-align:center;color:var(--text2);padding:48px;font-size:18px">${t.noFailedTests}</p>`}
    </div>

    <div class="tab-content" id="timeline">
      <div class="timeline-filters">
        <label for="tlThreshold">⏱️ ${t.minDuration}:</label>
        <input type="range" id="tlThreshold" class="timeline-range"
          min="0" max="${maxDuration}" step="100" value="0">
        <span class="timeline-range-val" id="tlThresholdVal">0ms</span>
        <div class="timeline-status-filters">
          <button class="filter-btn active" data-tl-filter="all">${t.all}</button>
          <button class="filter-btn" data-tl-filter="passed">✅ ${t.passed}</button>
          <button class="filter-btn" data-tl-filter="failed">❌ ${t.failed}</button>
          <button class="filter-btn" data-tl-filter="skipped">⏭️ ${t.skipped}</button>
        </div>
        <span class="tl-count" id="tlCount"></span>
      </div>
      <div id="timelineContainer">${timelineHTML}</div>
      <div id="tlNoResults" class="no-results" style="display:none">🔍 ${t.noResults}</div>
    </div>
  </div>

</div>
<script>
const testsData=${JSON.stringify(this.allTests)};
const stats=${JSON.stringify(stats)};
const tr=${JSON.stringify(t)};

// Tab switching
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// Charts
Chart.defaults.font.family='-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
new Chart(document.getElementById('statusChart'),{type:'doughnut',data:{labels:[tr.passed,tr.failed,tr.skipped],datasets:[{data:[stats.passed,stats.failed,stats.skipped],backgroundColor:['#22c55e','#ef4444','#f59e0b'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:ctx=>{const tot=ctx.dataset.data.reduce((a,b)=>a+b,0);return ctx.label+': '+ctx.parsed+' ('+(ctx.parsed/tot*100).toFixed(1)+'%)';}}}}}});
const sorted=[...testsData].sort((a,b)=>b.duration-a.duration).slice(0,10);
new Chart(document.getElementById('durationChart'),{type:'bar',data:{labels:sorted.map(t=>t.title.substring(0,22)),datasets:[{label:tr.duration+' (s)',data:sorted.map(t=>(t.duration/1000).toFixed(2)),backgroundColor:sorted.map(t=>t.status==='passed'?'#22c55e':t.status==='failed'?'#ef4444':'#f59e0b')}]},options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true}}}});
const cats={};testsData.forEach(t=>{cats[t.category]=(cats[t.category]||0)+1;});
new Chart(document.getElementById('categoryChart'),{type:'pie',data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#3b82f6','#ec4899','#8b5cf6','#22c55e','#f59e0b']}]},options:{responsive:true,plugins:{legend:{position:'bottom'}}}});
new Chart(document.getElementById('trendChart'),{type:'line',data:{labels:['Run 1','Run 2','Run 3','Run 4','Current'],datasets:[{label:tr.passRate+' %',data:[82,86,88,85,stats.passRate],borderColor:'${cfg.primaryColor}',backgroundColor:'${cfg.primaryColor}22',tension:0.4,fill:true}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,max:100}}}});

// Test filters
let activeStatus='all',activeCat='all',activePlatform='all';
function applyTestFilters(){
  const q=(document.getElementById('searchBox')?.value??'').toLowerCase();
  const items=document.querySelectorAll('#testsContainer .test-item');
  let visible=0;
  items.forEach(el=>{
    const statusOk=activeStatus==='all'||el.dataset.status===activeStatus;
    const catOk=activeCat==='all'||el.dataset.category===activeCat;
    const platformOk=activePlatform==='all'||el.dataset.platform===activePlatform;
    const titleText=(el.querySelector('.test-title')?.textContent??'').toLowerCase();
    const pathText=(el.querySelector('.test-path')?.textContent??'').toLowerCase();
    const searchOk=!q||titleText.includes(q)||pathText.includes(q);
    const show=statusOk&&catOk&&platformOk&&searchOk;
    el.style.display=show?'block':'none';
    if(show)visible++;
  });
  const ce=document.getElementById('resultsCount');
  if(ce)ce.textContent=visible+' / '+items.length;
  const nr=document.getElementById('noResults');
  if(nr)nr.style.display=visible===0?'block':'none';
}
document.querySelectorAll('[data-filter]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');activeStatus=btn.dataset.filter;applyTestFilters();
  });
});
document.querySelectorAll('[data-filter-cat]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter-cat]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');activeCat=btn.dataset.filterCat;applyTestFilters();
  });
});
document.querySelectorAll('[data-filter-platform]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-filter-platform]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');activePlatform=btn.dataset.filterPlatform;applyTestFilters();
  });
});
document.getElementById('searchBox')?.addEventListener('input',applyTestFilters);
applyTestFilters();

// Timeline filters
let tlStatusFilter='all';
function applyTimelineFilters(){
  const threshold=parseInt(document.getElementById('tlThreshold')?.value??'0',10);
  const ve=document.getElementById('tlThresholdVal');
  if(ve)ve.textContent=threshold>=1000?(threshold/1000).toFixed(1)+'s':threshold+'ms';
  const items=document.querySelectorAll('#timelineContainer .timeline-item');
  let visible=0;
  items.forEach(el=>{
    const dur=parseInt(el.dataset.duration??'0',10);
    const durOk=dur>=threshold;
    const statusOk=tlStatusFilter==='all'||el.dataset.status===tlStatusFilter;
    const show=durOk&&statusOk;
    el.style.display=show?'flex':'none';
    if(show)visible++;
  });
  const ce=document.getElementById('tlCount');
  if(ce)ce.textContent=visible+' '+(tr.tests||'tests');
  const nr=document.getElementById('tlNoResults');
  if(nr)nr.style.display=visible===0?'block':'none';
}
document.getElementById('tlThreshold')?.addEventListener('input',applyTimelineFilters);
document.querySelectorAll('[data-tl-filter]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-tl-filter]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');tlStatusFilter=btn.dataset.tlFilter;applyTimelineFilters();
  });
});
applyTimelineFilters();

// Collapsible logs
document.querySelectorAll('.logs-title').forEach(title=>{
  title.addEventListener('click',()=>{
    title.classList.toggle('collapsed');
    const body=title.nextElementSibling;
    if(body)body.style.display=title.classList.contains('collapsed')?'none':'block';
  });
});
</script>
</body>
</html>`;

    fs.writeFileSync(path.join(cfg.outputDir, 'index.html'), html, 'utf-8');
  }

  private renderTestItem(test: TestData): string {
    const t = this.t;
    const screenshots = test.attachments.filter(a => a.contentType.startsWith('image/'));

    const stepsHTML = test.steps.length > 0
      ? `<div class="test-steps"><div class="steps-title">📋 ${t.testSteps}</div>${test.steps.map(s =>
          `<div class="step-item"><span>${this.escHtml(s.title)}</span><span class="step-duration">${this.formatMs(s.duration)}</span></div>`
        ).join('')}</div>`
      : '';

    const logsHTML = test.logs.length > 0 && this.cfg.includeLogs
      ? `<div class="test-logs">
          <div class="logs-title">📋 ${t.consoleLogs} (${test.logs.length})</div>
          <div class="logs-body">${test.logs.map(log =>
            `<div class="log-item ${log.level}"><span class="log-level">${log.level}</span><span class="log-time">${new Date(log.timestamp).toISOString().substring(11,23)}</span>${this.escHtml(log.message)}</div>`
          ).join('')}</div>
         </div>`
      : '';

    const screenshotsHTML = screenshots.length > 0 && this.cfg.includeScreenshots
      ? `<div class="screenshots">${screenshots.map(ss =>
          `<div class="ss-item"><img src="data:${ss.contentType};base64,${ss.base64}" alt="${this.escHtml(ss.name)}"><div class="ss-label">${this.escHtml(ss.name)}</div></div>`
        ).join('')}</div>`
      : '';

    const errorHTML = test.error
      ? `<div class="test-error"><div class="error-title">❌ ${t.error}</div><div class="error-msg">${this.escHtml(test.error.message)}${test.error.stack
          ? `<details><summary>Stack Trace</summary><pre>${this.escHtml(test.error.stack)}</pre></details>`
          : ''}</div></div>`
      : '';

    // ── Platform badge ──
    const platform = test.mobile?.platform ?? (test.browser && test.browser !== 'unknown' ? 'web' : 'unknown');

    let platformBadgeHTML = '';
    let platformMetaHTML = '';
    if (test.mobile) {
      const icon = test.mobile.platform === 'ios' ? '🍎' : '🤖';
      const deviceTypeIcon = test.mobile.isRealDevice ? '📱' : '🖥️';
      const platformLabel = `${test.mobile.platform.toUpperCase()} ${test.mobile.platformVersion}`;
      platformBadgeHTML = `<span class="platform-badge ${test.mobile.platform}">${icon} ${platformLabel}</span>`;
      platformMetaHTML = `
        <span>${icon} ${platformLabel}</span>
        <span>${deviceTypeIcon} ${this.escHtml(test.mobile.deviceName)}</span>`;
    } else if (test.browser && test.browser !== 'unknown') {
      platformBadgeHTML = `<span class="platform-badge web">🌐 ${this.escHtml(test.browser)}${test.browserVersion ? ` ${test.browserVersion}` : ''}</span>`;
      platformMetaHTML = `<span>🌐 ${this.escHtml(test.browser)}${test.browserVersion ? ` ${this.escHtml(test.browserVersion)}` : ''}</span>`;
    }

    return `<div class="test-item ${test.status}" data-status="${test.status}" data-category="${test.category}" data-platform="${platform}">
      <div class="test-header">
        <div>
          <div class="test-title">${this.escHtml(test.title)}</div>
          <div class="test-path">${this.escHtml(test.fullTitle)}</div>
        </div>
        <div class="test-badges">
          <span class="test-status ${test.status}">${test.status}</span>
          ${platformBadgeHTML}
        </div>
      </div>
      <div class="test-meta">
        <span>📁 ${this.escHtml(path.basename(test.file) || 'unknown')}</span>
        <span>⏱️ ${this.formatMs(test.duration)}</span>
        ${platformMetaHTML}
        ${test.retries > 0 ? `<span>🔄 Retries: ${test.retries}</span>` : ''}
        ${test.category !== 'other' ? `<span>🏷️ ${this.escHtml(test.category)}</span>` : ''}
        ${test.logs.length > 0 ? `<span>📋 ${test.logs.length} logs</span>` : ''}
        ${screenshots.length > 0 ? `<span>📸 ${screenshots.length} screenshots</span>` : ''}
      </div>
      ${errorHTML}${stepsHTML}${logsHTML}${screenshotsHTML}
    </div>`;
  }

  private generateJSONReport(stats: ReturnType<typeof this.buildStats>) {
    const data = { config: this.cfg, stats, environment: this.getEnvironmentInfo(), tests: this.allTests, generatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(this.cfg.outputDir, 'report.json'), JSON.stringify(data, null, 2), 'utf-8');
  }

  private generateMarkdownReport(stats: ReturnType<typeof this.buildStats>) {
    const failedMd = this.allTests.filter(t => t.status === 'failed').map(t => {
      const platformLine = t.mobile
        ? `- **Platform**: ${t.mobile.platform.toUpperCase()} ${t.mobile.platformVersion} · ${t.mobile.deviceName} (${t.mobile.isRealDevice ? 'real device' : 'simulator'})`
        : `- **Browser**: ${t.browser ?? 'unknown'}`;
      return `### ❌ ${t.title}\n- **File**: ${t.file}\n- **Duration**: ${this.formatMs(t.duration)}\n${platformLine}\n- **Error**: ${t.error?.message ?? 'N/A'}\n${
        t.logs.filter(l => l.level === 'error').length > 0
          ? `- **Console errors**:\n${t.logs.filter(l => l.level === 'error').map(l => `  - \`${l.message.split('\n')[0]}\``).join('\n')}`
          : ''
      }\n`;
    }).join('\n');

    const slowMd = this.getSlowestTests(10).map((t, i) => `${i + 1}. ${t.title} — ${this.formatMs(t.duration)}`).join('\n');

    const platformSummary = this.runnerMobile
      ? `| Platform | ${this.runnerMobile.platform.toUpperCase()} ${this.runnerMobile.platformVersion} |\n| Device | ${this.runnerMobile.deviceName} (${this.runnerMobile.isRealDevice ? 'real device' : 'simulator'}) |`
      : `| Browser | ${this.detectedBrowser} |`;

    const md = `# ${this.cfg.reportTitle}\n**${this.cfg.companyName}** · ${this.cfg.projectName}\n\n## 📊 Summary\n\n| | |\n|---|---|\n| Total | ${stats.total} |\n| Passed ✅ | ${stats.passed} (${stats.passRate.toFixed(1)}%) |\n| Failed ❌ | ${stats.failed} |\n| Skipped ⏭️ | ${stats.skipped} |\n| Duration | ${(stats.duration / 1000).toFixed(2)}s |\n${platformSummary}\n| Generated | ${new Date().toISOString()} |\n\n## ❌ Failed Tests\n\n${failedMd || '_No failed tests_'}\n\n## ⏱️ Slowest Tests\n\n${slowMd}\n`;
    fs.writeFileSync(path.join(this.cfg.outputDir, 'report.md'), md, 'utf-8');
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
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]!));
  }

  private stripAnsi(s: string): string {
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
        summary:'ПІДСУМКИ ВИКОНАННЯ ТЕСТІВ',totalTests:'Всього тестів',passed:'Пройдено',failed:'Провалено',skipped:'Пропущено',duration:'Тривалість',passRate:'Успішність',overview:'Огляд',allTests:'Всі тести',failedTests:'Провалені',timeline:'Хронологія',statusDistribution:'Розподіл статусів',durationAnalysis:'Аналіз тривалості',testsByCategory:'Тести за категоріями',passRateTrend:'Тренд успішності',topFilesByTests:'Топ файлів',slowestTests:'Найповільніші тести',testSteps:'Кроки тесту',error:'Помилка',noFailedTests:'🎉 Немає провалених тестів!',timestamp:'Час',nodeVersion:'Версія Node',platform:'Платформа',all:'Всі',search:'Пошук тестів (назва, номер, ID)...',status:'Статус',category:'Категорія',consoleLogs:'Консольні логи',minDuration:'Мін. тривалість',noResults:'Нічого не знайдено',tests:'тестів',platformLabel:'Платформа',realDevice:'реальний пристрій',simulator:'симулятор/емулятор',
      },
      en: {
        summary:'TEST EXECUTION SUMMARY',totalTests:'Total Tests',passed:'Passed',failed:'Failed',skipped:'Skipped',duration:'Duration',passRate:'Pass Rate',overview:'Overview',allTests:'All Tests',failedTests:'Failed',timeline:'Timeline',statusDistribution:'Status Distribution',durationAnalysis:'Duration Analysis',testsByCategory:'Tests by Category',passRateTrend:'Pass Rate Trend',topFilesByTests:'Top Files by Tests',slowestTests:'Slowest Tests',testSteps:'Test Steps',error:'Error',noFailedTests:'🎉 No failed tests!',timestamp:'Timestamp',nodeVersion:'Node Version',platform:'Platform',all:'All',search:'Search tests (name, number, ID)...',status:'Status',category:'Category',consoleLogs:'Console Logs',minDuration:'Min Duration',noResults:'No results found',tests:'tests',platformLabel:'Platform',realDevice:'real device',simulator:'simulator/emulator',
      },
      pl: {
        summary:'PODSUMOWANIE TESTÓW',totalTests:'Wszystkie testy',passed:'Zaliczone',failed:'Nieudane',skipped:'Pominięte',duration:'Czas',passRate:'Wskaźnik sukcesu',overview:'Przegląd',allTests:'Wszystkie',failedTests:'Nieudane',timeline:'Oś czasu',statusDistribution:'Rozkład statusu',durationAnalysis:'Analiza czasu',testsByCategory:'Testy wg kategorii',passRateTrend:'Trend sukcesu',topFilesByTests:'Najważniejsze pliki',slowestTests:'Najwolniejsze testy',testSteps:'Kroki testu',error:'Błąd',noFailedTests:'🎉 Brak nieudanych testów!',timestamp:'Czas',nodeVersion:'Wersja Node',platform:'Platforma',all:'Wszystkie',search:'Szukaj testów (nazwa, numer, ID)...',status:'Status',category:'Kategoria',consoleLogs:'Logi konsoli',minDuration:'Min. czas',noResults:'Brak wyników',tests:'testów',platformLabel:'Platforma',realDevice:'prawdziwe urządzenie',simulator:'symulator/emulator',
      },
    };
    return all[lang] ?? all['uk'];
  }
}

export default EnterpriseReporter;
