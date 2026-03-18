import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { marked } from 'marked';
import { chromium } from '@playwright/test';

type Chapter = { title: string; path: string };

const repoRoot = process.cwd();
const manualDir = join(repoRoot, 'docs', 'manual');
const distDir = join(manualDir, 'dist');
const outPdfPath = join(distDir, 'manual.pdf');

const chapters: Chapter[] = [
  { title: '封面與導覽', path: join(manualDir, 'README.md') },
  { title: '01 登入與權限', path: join(manualDir, '01-login-and-permissions.md') },
  { title: '02 商家與門市設定', path: join(manualDir, '02-merchant-and-stores.md') },
  { title: '03 商品與條碼/標籤', path: join(manualDir, '03-products.md') },
  { title: '04 會員與 CRM', path: join(manualDir, '04-customers-crm.md') },
  { title: '05 促銷', path: join(manualDir, '05-promotions.md') },
  { title: '06 庫存', path: join(manualDir, '06-inventory.md') },
  { title: '07 採購與驗收', path: join(manualDir, '07-purchase-and-receiving.md') },
  { title: '08 POS 訂單', path: join(manualDir, '08-pos-orders.md') },
  { title: '09 報表與稽核', path: join(manualDir, '09-reports-and-audit.md') },
  { title: '10 常見問題與排錯', path: join(manualDir, '10-troubleshooting.md') },
  { title: '附錄', path: join(manualDir, 'appendix', 'README.md') },
  { title: '附錄：匯入模板', path: join(manualDir, 'appendix', 'import-templates.md') },
  { title: '附錄：名詞對照', path: join(manualDir, 'appendix', 'glossary.md') },
  { title: '附錄：指令與環境', path: join(manualDir, 'appendix', 'commands-and-env.md') },
];

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
  } catch {
    return '';
  }
}

function isoNowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function applyTokens(md: string, tokens: Record<string, string>) {
  return md.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) => tokens[key] ?? `{{${key}}}`);
}

function wrapChapterHtml(title: string, md: string) {
  const html = marked.parse(md, { gfm: true, breaks: true }) as string;
  return `
    <section class="chapter">
      <h1 class="chapter-title">${escapeHtml(title)}</h1>
      <div class="chapter-body">${html}</div>
    </section>
  `;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readCss() {
  const cssPath = join(repoRoot, 'scripts', 'manual', 'manual.css');
  return readFileSync(cssPath, 'utf8');
}

async function main() {
  mkdirSync(distDir, { recursive: true });

  const gitSha = safeExec('git rev-parse --short HEAD') || 'unknown';
  const generatedAt = isoNowLocal();
  const tokens = {
    GENERATED_AT: generatedAt,
    GIT_SHA: gitSha,
  };

  const css = readCss();

  const chapterHtml = chapters
    .map((c, idx) => {
      const md = readFileSync(c.path, 'utf8');
      const withTokens = applyTokens(md, tokens);
      const html = wrapChapterHtml(c.title, withTokens);
      const pageBreak = idx === chapters.length - 1 ? '' : '<div class="page-break"></div>';
      return html + pageBreak;
    })
    .join('\n');

  const fullHtml = `<!doctype html>
  <html lang="zh-Hant">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>客戶端超級管理員使用手冊</title>
      <style>${css}</style>
    </head>
    <body>
      <header class="doc-header">
        <div class="doc-title">客戶端超級管理員使用手冊</div>
        <div class="doc-meta">產出時間：${escapeHtml(generatedAt)}｜版本：${escapeHtml(gitSha)}</div>
      </header>
      ${chapterHtml}
    </body>
  </html>`;

  const outHtmlPath = join(distDir, 'manual.html');
  writeFileSync(outHtmlPath, fullHtml, 'utf8');

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(String(e));
    // eslint-disable-next-line no-console
    console.error(
      [
        '',
        'Playwright 瀏覽器尚未安裝，請先執行：',
        '  pnpm exec playwright install chromium',
        '',
        '若你是在受限環境（例如沙盒）執行，可能需要在本機/CI 環境跑上述指令後再產 PDF。',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: outPdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', right: '14mm', bottom: '16mm', left: '14mm' },
  });
  await browser.close();

  // eslint-disable-next-line no-console
  console.log(`PDF generated: ${outPdfPath}`);
  // eslint-disable-next-line no-console
  console.log(`HTML generated: ${outHtmlPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

