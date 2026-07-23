import { device, element, by, expect } from "detox";

describe("Essay Reader", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  it("shows header with title", async () => {
    await expect(element(by.id("header-title"))).toBeVisible();
    await expect(element(by.id("header-title"))).toHaveText("Essay Reader");
  });

  it("shows provider badge", async () => {
    await expect(element(by.id("provider-badge"))).toBeVisible();
    await expect(element(by.id("provider-badge"))).toHaveText("System TTS");
  });

  it("opens article list via hamburger menu", async () => {
    await element(by.id("menu-btn")).tap();
    await expect(element(by.text("My Articles"))).toBeVisible();
  });

  it("creates a new article", async () => {
    await element(by.id("new-article-btn")).tap();
    await expect(element(by.id("editor-title-input"))).toBeVisible();
    await expect(element(by.id("editor-content-input"))).toBeVisible();

    await element(by.id("editor-content-input")).typeText(
      "The quick brown fox jumps over the lazy dog. This is a test article."
    );
    await element(by.id("editor-title-input")).typeText("E2E Test Article");

    await element(by.id("editor-save-btn")).tap();
  });

  it("shows the new article title in header", async () => {
    await expect(element(by.id("header-title"))).toHaveText("E2E Test Article");
  });

  it("starts system TTS playback", async () => {
    await element(by.id("player-play")).tap();
    await expect(element(by.id("player-status"))).toHaveText("Reading...");
  });

  it("stops TTS playback", async () => {
    await element(by.id("player-stop")).tap();
    await expect(element(by.id("player-status"))).toHaveText("Ready");
  });

  it("opens settings panel", async () => {
    await element(by.id("settings-btn")).tap();
    await expect(element(by.text("Settings"))).toBeVisible();
    await expect(element(by.text("Engine"))).toBeVisible();
  });

  it("closes settings panel", async () => {
    await element(by.text("Done")).tap();
    await expect(element(by.id("header-title"))).toBeVisible();
  });

  it("deletes article via article list", async () => {
    await element(by.id("menu-btn")).tap();
    await expect(element(by.text("E2E Test Article"))).toBeVisible();
    await element(by.text("\uD83D\uDDD1")).atIndex(0).tap();
    await element(by.text("Delete")).tap();
    await expect(element(by.text("No articles yet"))).toBeVisible();
  });
});
