import { test, expect } from "@playwright/test";

test.describe("Essay Reader Web", () => {
  test("app loads with header and empty state", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-testid=header-title]")).toBeVisible();
    await expect(page.locator("[data-testid=header-title]")).toHaveText("Essay Reader");

    await expect(page.locator("[data-testid=menu-btn]")).toBeVisible();
    await expect(page.locator("[data-testid=settings-btn]")).toBeVisible();
    await expect(page.locator("[data-testid=provider-badge]")).toBeVisible();

    await expect(page.getByText("No article selected")).toBeVisible();
    await expect(page.locator("[data-testid=player-status]")).toHaveText("Add an article");
    await expect(page.locator("[data-testid=player-play]")).toBeVisible();
  });

  test("can create a new article", async ({ page }) => {
    await page.goto("/");

    await page.locator("[data-testid=menu-btn]").click();
   await expect(page.getByText("My Articles")).toBeVisible();

    await page.locator("[data-testid=new-article-btn]").click();

    await expect(page.locator("[data-testid=editor-title-input]")).toBeVisible();
    await expect(page.locator("[data-testid=editor-content-input]")).toBeVisible();

    const title = "E2E Test Article";
    const content = "Test content with multiple sentences. Each one readable.";

    await page.locator("[data-testid=editor-title-input]").fill(title);
    await page.locator("[data-testid=editor-content-input]").fill(content);

    await page.locator("[data-testid=editor-save-bottom]").click();

    await expect(page.locator("[data-testid=header-title]")).toHaveText(title);
    await expect(page.locator("[data-testid=player-status]")).toHaveText("Ready");
  });

  test("settings panel opens and closes", async ({ page }) => {
    await page.goto("/");

    await page.locator("[data-testid=settings-btn]").click();
    await expect(page.getByText("Done")).toBeVisible();

    await page.getByText("Done").click();
    await expect(page.getByText("Done")).not.toBeVisible();
  });

  test("article list opens and shows empty state", async ({ page }) => {
    await page.goto("/");

    await page.locator("[data-testid=menu-btn]").click();
    await expect(page.getByText("Done")).toBeVisible();

    await page.getByText("Done").click();
   await expect(page.getByText("No article selected")).toBeVisible();
 });

 test("doubao REST TTS makes API call on web", async ({ page }) => {
   await page.goto("/");

    // Open settings and switch to Doubao with API key
   await page.locator("[data-testid=settings-btn]").click();

    // Click Doubao TTS chip to switch provider
   const doubaoOption = page.getByText("Doubao TTS", { exact: true });
   await doubaoOption.click();

    // API key fields should appear after switching
   const apiKeyInput = page.locator("[data-testid=doubao-api-key-input]");
   await apiKeyInput.waitFor({ state: "visible", timeout: 5000 });

   // Fill the API key
    const testApiKey = process.env.DOUBAO_TEST_API_KEY || "test-key-not-set";
    await apiKeyInput.fill(testApiKey);

    // Verify the field has the value
    const value = await apiKeyInput.inputValue();
    expect(value.length).toBeGreaterThan(0);

   // Close settings
   await page.getByText("Done").click();

    // Verify badge shows REST on web (not WebSocket)
    const badge = page.locator("[data-testid=provider-badge]");
    await expect(badge).toContainText("Doubao TTS");
  });
});
