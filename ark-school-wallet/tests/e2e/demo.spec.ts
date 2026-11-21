import { expect, test } from '@playwright/test';

// The core product journey, in Demo mode: open → receive → see VTXOs → send →
// see the diff → learn Refresh/Exit. Demo never touches the network.

test.beforeEach(async ({ page }) => {
  // Fail the test if Demo mode ever contacts the Ark server or Esplora.
  await page.route(/2nd\.dev/, (route) => {
    throw new Error(`Demo mode made a network request: ${route.request().url()}`);
  });
});

test('demo journey: receive, X-Ray, send, diff', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('network-badge')).toHaveText(/SIGNET/);
  await page.getByTestId('start-demo').click();

  await expect(page.getByTestId('mode-badge')).toHaveText(/DEMO/);
  await expect(page.getByTestId('demo-banner')).toBeVisible();
  await expect(page.getByTestId('spendable')).toContainText('0');

  await page.getByTestId('demo-receive').click();
  await expect(page.getByTestId('spendable')).toContainText('10,000');
  await expect(page.getByTestId('vtxo-count')).toContainText('1');

  // X-Ray shows the VTXO with a block-based expiry.
  await page.goto('/#/xray');
  await expect(page.getByTestId('vtxo-card')).toHaveCount(1);
  await expect(page.getByTestId('blocks-remaining').first()).toContainText('1,500');

  // Send 1,000 sats to the demo friend.
  await page.goto('/#/send');
  await page.getByTestId('use-friend').click();
  await page.getByLabel(/金額|Amount/).fill('1000');
  await page.getByTestId('review-send').click();
  const confirm = page.getByTestId('confirm-send');
  await expect(confirm).toBeVisible();
  await confirm.click();

  const diff = page.getByTestId('snapshot-diff');
  await expect(diff).toBeVisible();
  await expect(page.getByTestId('diff-consumed').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('diff-created').locator('li')).toHaveCount(1); // change
  await expect(diff).toContainText('-1,011'); // 1,000 + DEMO fee (10 + 1)
});

test('demo refuses non-demo addresses', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-demo').click();
  await page.getByTestId('demo-receive').click();
  await page.goto('/#/send');
  await page.getByLabel(/送金先|Recipient/).fill('tark1qexampleexampleexample');
  await page.getByLabel(/金額|Amount/).fill('100');
  await page.getByTestId('review-send').click();
  await expect(page.getByRole('alert').first()).toContainText(/DEMO-/);
  await expect(page.getByTestId('confirm-send')).toBeHidden();
});

test('lab works without a wallet and labels itself as demo', async ({ page }) => {
  await page.goto('/#/lab/4');
  await expect(page.getByTestId('lab-banner')).toContainText('NO REAL PAYMENT');
  const slider = page.getByTestId('lesson4-slider');
  await slider.fill('4416');
  await expect(page.getByTestId('lesson4-norefresh')).toContainText(/期限切れ|Expired/);
  await page.goto('/#/lab/5');
  await expect(page.getByTestId('route-offboard')).toBeVisible();
  await expect(page.getByTestId('route-exit')).toBeVisible();
});

test('language switch', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Ark School');
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-demo').click();
  for (const path of ['/#/', '/#/xray', '/#/lab/2', '/#/learn', '/#/settings']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
