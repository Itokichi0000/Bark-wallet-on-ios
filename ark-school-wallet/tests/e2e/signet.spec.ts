import { expect, test } from '@playwright/test';

// Opt-in, needs network access to Second's Signet Ark server and Esplora.
//   LIVE_SIGNET=1 npm run test:e2e -- --project=desktop signet
// Creates a fresh Signet wallet through the real UI. It never sends funds.
test.skip(!process.env.LIVE_SIGNET, 'set LIVE_SIGNET=1 to run against the real Signet server');
test.setTimeout(240_000);

test('create a real Signet wallet, read address, balance, VTXOs and server info', async ({ page }) => {
  const consoleSecrets: string[] = [];
  page.on('console', (m) => consoleSecrets.push(m.text()));

  await page.goto('/');
  await page.getByTestId('create-signet').click();
  await page.getByRole('button', { name: /理解しました|I understand/ }).click();
  await page.getByRole('button', { name: /フレーズを表示する|Reveal phrase/ }).click();
  const words = (await page.getByTestId('mnemonic-words').locator('li').allInnerTexts()).map((s) => s.replace(/^\d+\.\s*/, '').trim());
  expect(words).toHaveLength(12);
  await page.getByRole('button', { name: /書き写しました|I wrote it down/ }).click();

  for (const input of await page.locator('input[id^="quiz-"]').all()) {
    const idx = Number((await input.getAttribute('id'))!.replace('quiz-', ''));
    await input.fill(words[idx]!);
  }
  await page.getByRole('button', { name: /次へ|Next/ }).click();
  await page.locator('#pass1').fill('correct horse 1');
  await page.locator('#pass2').fill('correct horse 1');
  await page.getByRole('button', { name: /確認|Confirm/ }).click();

  await expect(page.getByTestId('mode-badge')).toHaveText(/LIVE/, { timeout: 180_000 });
  await expect(page.getByTestId('spendable')).toContainText(/\d/, { timeout: 60_000 });

  await page.goto('/#/receive');
  const address = page.getByTestId('receive-address');
  await expect(address).toHaveText(/\S{20,}/, { timeout: 60_000 });
  console.log(`Signet Ark address prefix: ${(await address.innerText()).slice(0, 6)}…`);

  await page.goto('/#/xray?tab=safety');
  await expect(page.getByText(/ブロック|blocks/).first()).toBeVisible({ timeout: 60_000 });

  await page.goto('/#/settings');
  await page.getByText(/サーバー情報|Server info/).click();
  await expect(page.getByText('Signet', { exact: true })).toBeVisible();

  // The mnemonic must never appear in the console.
  const joined = words.join(' ');
  expect(consoleSecrets.some((l) => l.includes(joined) || words.slice(0, 4).every((w) => l.includes(w)))).toBe(false);

  // Reload: wallet must reopen from the encrypted vault with the passphrase.
  await page.reload();
  await page.goto('/');
  await page.getByRole('link', { name: /開く|Open/ }).first().click();
  await page.locator('#unlock-pass').fill('wrong pass 123');
  await page.getByRole('button', { name: /^(開く|Open)$/ }).click();
  await expect(page.getByRole('alert')).toContainText(/パスフレーズが違います|Wrong passphrase/);
  await page.locator('#unlock-pass').fill('correct horse 1');
  await page.getByRole('button', { name: /^(開く|Open)$/ }).click();
  await expect(page.getByTestId('mode-badge')).toHaveText(/LIVE/, { timeout: 120_000 });
});
