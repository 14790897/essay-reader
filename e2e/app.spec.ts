import { test, expect } from "@playwright/test";

test("app loads and shows header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Essay Reader")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("System TTS")).toBeVisible();
});

test("open article list and create new article", async ({ page }) => {
  await page.goto("/");

  // Click hamburger menu button
  await page.locator('[data-testid="menu-btn"]').click();
  await expect(page.getByText("My Articles")).toBeVisible();

  // Click "New Article" button (use testid to avoid strict mode)
  await page.locator('[data-testid="new-article-btn"]').click();

  // Fill in title
  await page.getByPlaceholder("Article Title").fill("E2E Test Article");

  // Fill in content
  await page.getByPlaceholder("Paste or type your article here").fill("Hello from Playwright E2E.");

  // Save
  await page.getByText("Save").click();

  // Verify article appears
  await expect(page.getByText("E2E Test Article")).toBeVisible();
});

test("open settings panel", async ({ page }) => {
  await page.goto("/");

  // Click settings button
  await page.locator('[data-testid="settings-btn"]').click();

  // Verify settings opened - look for Doubao or TTS related text
  await expect(page.getByText("Doubao")).toBeVisible({ timeout: 5000 });

  // Close settings
  await page.getByText("Done").click();
  await expect(page.getByText("Doubao")).not.toBeVisible();
});
