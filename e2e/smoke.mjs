/**
 * Lightweight UI smoke test.
 *
 * Start the app first:  npm run dev
 * Then run:             npm run test:e2e
 *
 * Uses the locally installed Google Chrome through playwright-core, so no
 * browser download is required. Override the binary with CHROME_PATH if needed.
 */
import { chromium } from 'playwright-core';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH;
const launchOptions = {
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
};
if (chromePath) launchOptions.executablePath = chromePath;
else launchOptions.channel = 'chrome';

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.home-page');

  // Add a record using the calculator keypad: 60 + 6.6 = 66.60.
  await page.goto(new URL('#/record', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.record-page');
  assert((await page.locator('.keypad-key').count()) === 16, 'Calculator keypad should have 16 keys');
  assert(await page.locator('.keypad-note').isVisible(), 'Keypad note shortcut is missing');
  assert(await page.locator('.keypad-account').isVisible(), 'Keypad account shortcut is missing');
  for (const label of ['6', '0', '加', '6', '小数点', '6']) {
    await page.locator(`.keypad-key[aria-label="${label}"]`).click();
  }
  assert((await page.locator('.amount-result').innerText()).includes('¥66.60'), 'Calculator expression did not evaluate to 66.60');
  assert((await page.locator('.action-key').innerText()).trim() === '=', 'Expression action should be =');
  await page.locator('.action-key').click();
  assert((await page.locator('.action-key').innerText()).trim() === '完成', 'Action should switch to 完成 after =');
  await page.locator('.action-key').click();
  await page.waitForSelector('.home-page');
  await page.waitForTimeout(700);
  const firstRow = await page.locator('.tx-row').first().innerText();
  assert(firstRow.includes('66.60'), `Expected a saved 66.60 record, got: ${firstRow}`);

  // Persistence survives a reload.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.home-page');
  assert((await page.locator('.tx-row').first().innerText()).includes('66.60'), 'Record did not persist after reload');

  // Import is no longer promoted on the home page.
  assert(
    (await page.locator('.home-page').getByRole('button', { name: /导入/ }).count()) === 0,
    'A low-frequency import entry is still visible on the home page',
  );

  // Quick category shortcuts pre-fill the record form.
  const quickChip = page.locator('.quick-entry-chip').first();
  assert(await quickChip.isVisible(), 'Quick category shortcuts did not render');
  await quickChip.click();
  await page.waitForSelector('.record-page');
  assert(await page.locator('.selected-category').isVisible(), 'Quick category did not pre-select a category');

  // Monthly and annual statistics.
  await page.goto(new URL('#/stats', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.stats-page');
  await page.locator('.stats-mode-switch button').filter({ hasText: '年度' }).click();
  await page.waitForTimeout(250);
  assert((await page.locator('.year-bar').count()) === 12, 'Annual chart did not render 12 months');
  await page.locator('.stats-mode-switch button').filter({ hasText: '全部' }).click();
  await page.waitForTimeout(250);
  assert(await page.locator('.all-time-trend-panel').isVisible(), 'All-time statistics panel did not render');
  assert((await page.locator('.all-year-chart .year-bar').count()) >= 1, 'All-time yearly chart did not render');
  await page.locator('.stats-mode-switch button').filter({ hasText: '月度' }).click();

  // Calendar day drill-down and add-for-day entry.
  await page.goto(new URL('#/calendar', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.calendar-page');
  assert((await page.locator('.calendar-day').count()) >= 28, 'Calendar grid did not render');
  await page.locator('.calendar-day').filter({ hasText: /^15$/ }).click();
  await page.waitForTimeout(200);
  assert((await page.locator('.calendar-day-head').innerText()).includes('15日'), 'Calendar day selection did not update');
  await page.locator('.add-day-button').click();
  await page.waitForSelector('.record-page');
  assert((await page.locator('.amount-under').innerText()).includes('15日'), 'Calendar quick-add did not carry the selected date');

  // Search.
  await page.goto(new URL('#/search', baseURL).href, { waitUntil: 'networkidle' });
  await page.locator('.search-field input').fill('餐');
  await page.waitForTimeout(300);
  assert(await page.locator('.search-page').isVisible(), 'Search page did not render');

  // Import landing, Suishouji detection, and settings entry.
  await page.goto(new URL('#/import', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.dropzone');
  const suishoujiCsv = [
    '日期,收支,分类,子分类,金额,备注,账户,成员,项目',
    '2026-10-01,支出,餐饮,午餐,35.50,牛肉面,微信,我,日常',
    '2026-10-02,收入,工资,月薪,9500,10月工资,银行卡,我,工作',
  ].join('\r\n');
  await page.locator('input[type=file]').setInputFiles({
    name: '随手记账单.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`\uFEFF${suishoujiCsv}`, 'utf8'),
  });
  await page.waitForSelector('.import-file-card');
  assert((await page.locator('.source-tag').innerText()).includes('随手记'), 'Suishouji source was not detected');
  await page.goto(new URL('#/settings', baseURL).href, { waitUntil: 'networkidle' });
  await page.waitForSelector('.settings-page');
  assert(await page.locator('.import-banner').isVisible(), 'Import entry point missing from settings');

  if (errors.length) throw new Error(`Console errors: ${errors.join(' | ')}`);
  console.log('E2E smoke passed: calculator, persist, quick entry, monthly/annual/all-time stats, Suishouji import, calendar, search, settings.');
} finally {
  await browser.close();
}
