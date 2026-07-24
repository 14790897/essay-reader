import { device, element, by, expect } from "detox";

const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || "";
const DOUBAO_RESOURCE_ID = process.env.DOUBAO_RESOURCE_ID || "seed-tts-2.0";

describe("Essay Reader", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("shows header with title", async () => {
    await expect(element(by.id("header-title"))).toBeVisible();
    await expect(element(by.id("header-title"))).toHaveText("Essay Reader");
  });

  it("shows provider badge as System TTS", async () => {
    await expect(element(by.id("provider-badge"))).toBeVisible();
    await expect(element(by.id("provider-badge"))).toHaveText("System TTS");
  });

  it("opens article list and creates a new article", async () => {
    await element(by.id("menu-btn")).tap();
    await expect(element(by.text("My Articles"))).toBeVisible();
    await element(by.id("new-article-btn")).tap();

    await expect(element(by.id("editor-content-input"))).toBeVisible();
    await element(by.id("editor-content-input")).typeText(
      "The quick brown fox jumps over the lazy dog. This is a test article for E2E."
    );
    await element(by.id("editor-title-input")).typeText("E2E Test");
    await element(by.id("editor-save-btn")).tap();
    await expect(element(by.id("header-title"))).toHaveText("E2E Test");
  });

  it("plays and stops system TTS", async () => {
    await element(by.id("player-play")).tap();
    await expect(element(by.id("player-status"))).toHaveText("Reading...");
    await element(by.id("player-stop")).tap();
    await expect(element(by.id("player-status"))).toHaveText("Ready");
  });

  it("switches to Doubao TTS and configures API key", async () => {
    await element(by.id("settings-btn")).tap();
    await expect(element(by.text("Settings"))).toBeVisible();

    // Tap Doubao TTS chip
    await element(by.text("Doubao TTS")).tap();

    // Enter API key
    await element(by.id("doubao-api-key-input")).replaceText(DOUBAO_API_KEY);
    await element(by.id("doubao-resource-id-input")).replaceText(DOUBAO_RESOURCE_ID);

    // Close settings
    await element(by.text("Done")).tap();

    // Verify badge updated
    await expect(element(by.id("provider-badge"))).toHaveText("Doubao TTS \u2022 WebSocket");
  });

  it("plays Doubao TTS", async () => {
    await element(by.id("player-play")).tap();
    // Doubao connects via WebSocket — status goes through "Synthesizing..." then "Reading..."
    // Wait for reading state (WebSocket handshake + first audio chunk)
    await waitFor(element(by.id("player-status")))
      .toHaveText("Reading...")
      .withTimeout(15000);
  });

  it("stops Doubao TTS", async () => {
    await element(by.id("player-stop")).tap();
    await expect(element(by.id("player-status"))).toHaveText("Ready");
  });

  it("switches back to System TTS", async () => {
    await element(by.id("settings-btn")).tap();
    await element(by.text("System")).tap();
    await element(by.text("Done")).tap();
    await expect(element(by.id("provider-badge"))).toHaveText("System TTS");
  });

  it("cleans up — deletes test article", async () => {
    await element(by.id("menu-btn")).tap();
    await expect(element(by.text("E2E Test"))).toBeVisible();
    await element(by.text("\uD83D\uDDD1")).atIndex(0).tap();
    await element(by.text("Delete")).tap();
    await expect(element(by.text("No articles yet"))).toBeVisible();
  });
});
