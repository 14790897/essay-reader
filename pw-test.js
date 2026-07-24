const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Take initial screenshot
  await page.screenshot({ path: 'pw-test-initial.png', fullPage: true });
  console.log('Page loaded OK');

  // Check the app title is visible
  const title = await page.textContent('[data-testid=app-title]');
  console.log('Title:', title);

  // Look for the header title
  const headerTitle = await page.locator('text=Essay Reader').first().textContent().catch(() => 'not found');
  console.log('Header found:', headerTitle);

  // Check if hamburger / settings buttons exist
  const buttons = await page.locator('button, [role=button], div[onclick]').count();
  console.log('Interactive elements:', buttons);

  // Try to click the hamburger (first button in header)
  const headerBtns = await page.locator('header button, header [role=button]').count();
  console.log('Header buttons:', headerBtns);

  // Click hamburger (first button)
  const hamburger = page.locator('header button, header [role=button]').first();
  if (await hamburger.isVisible()) {
    await hamburger.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'pw-test-menu.png', fullPage: true });
    console.log('Menu opened');
    // Close it
    await page.locator('text=Close, text=Cancel, [aria-label=close]').first().click().catch(() => {});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Click settings (last button in header)
  const settingsBtn = page.locator('header button, header [role=button]').last();
  if (await settingsBtn.isVisible()) {
    await settingsBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'pw-test-settings.png', fullPage: true });
    console.log('Settings opened');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  console.log('Tests completed successfully');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
