import { test, expect } from "@playwright/test";

test("app loads and shows header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Essay Reader")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("text=System TTS")).toBeVisible();
});

test("open article list and create new article", async ({ page }) => {
  await page.goto("/");

  // Click hamburger menu button
  await page.locator('[data-testid="menu-btn"]').click();
  await expect(page.locator("text=My Articles")).toBeVisible();

  // Click new article button
  await page.locator("text=+ New Article").click();

  // Fill in title
  await page.locator("text=Article Title").fill("E2E Test Article");

  // Fill in content
  await page.locator("text=Paste or type your article here").fill("Hello from Playwright E2E.");

  // Save
  await page.locator("text=Save").click();

  // Verify article appears
  await expect(page.locator("text=E2E Test Article")).toBeVisible();
});

test("open settings panel", async ({ page }) => {
  await page.goto("/");

  // Click settings button
  await page.locator('[data-testid="settings-btn"]').click();

  // Verify settings opened
  await expect(page.locator("text=TTS Engine")).toBeVisible({ timeout: 5000 });

  // Close settings
  await page.locator("text=Done").click();
  await expect(page.locator("text=TTS Engine")).not.toBeVisible();
});
