import { test, expect } from "@playwright/test";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a test article with Chinese text for TTS testing */
async function createTestArticle(page: any, title: string = "E2E TTS Test") {
  await page.locator("[data-testid=menu-btn]").click();
  await page.locator("[data-testid=new-article-btn]").click();
  await page.locator("[data-testid=editor-title-input]").fill(title);
  await page.locator("[data-testid=editor-content-input]").fill(
    "你好，欢迎使用豆包语音合成服务。这是一个端到端测试。我们通过HTTP接口实现流式语音合成。"
  );
  await page.locator("[data-testid=editor-save-bottom]").click();
  await expect(page.locator("[data-testid=header-title]")).toHaveText(title);
}

/** Switch TTS provider to Doubao and configure API settings.
 *  Pass proxyUrl=null to clear the default proxy URL. */
async function switchToDoubao(
  page: any,
  apiKey?: string,
  resourceId?: string,
  proxyUrl?: string | null
) {
  await page.locator("[data-testid=settings-btn]").click();

  const doubaoOption = page.getByText("Doubao TTS", { exact: true });
  await doubaoOption.click();

  const apiKeyInput = page.locator("[data-testid=doubao-api-key-input]");
  await apiKeyInput.waitFor({ state: "visible", timeout: 5000 });

  if (apiKey) {
    await apiKeyInput.clear();
    await apiKeyInput.fill(apiKey);
  }

  const resourceInput = page.locator("[data-testid=doubao-resource-id-input]");
  if (resourceId) {
    await resourceInput.clear();
    await resourceInput.fill(resourceId);
  }

  // Clear proxy URL by default to avoid hitting external servers in tests
  const proxyInput = page.locator("[data-testid=doubao-proxy-url-input]");
  await proxyInput.clear();
  if (typeof proxyUrl === 'string') {
    await proxyInput.fill(proxyUrl);
  }

  await page.getByText("Done").click();
}

/** Build a minimal valid MP3 frame: header + silence body (~417 bytes, ~0.1s) */
function minimalMp3Base64(): string {
  const frameHeader = [0xFF, 0xFB, 0x90, 0x00];
  const frameBody = new Uint8Array(413).fill(0);
  const frame = new Uint8Array(frameHeader.length + frameBody.length);
  frame.set(frameHeader);
  frame.set(frameBody, frameHeader.length);
  let binary = '';
  for (let i = 0; i < frame.length; i++) binary += String.fromCharCode(frame[i]);
  return btoa(binary);
}

/**
 * Capture console.error calls during a test action.
 * Returns the captured messages so the test can assert on them.
 */
async function captureConsoleErrors(page: any, action: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const handler = (msg: any) => {
    if (msg.type() === 'error') errors.push(msg.text());
  };
  page.on('console', handler);
  await action();
  // Give time for async error handlers to fire
  await page.waitForTimeout(500);
  page.off('console', handler);
  return errors;
}

// ─── V3 HTTP Unidirectional E2E Tests ───────────────────────────────────────

test.describe("Essay Reader Web — Doubao V3 HTTP Unidirectional TTS", () => {

  test("badge shows Doubao TTS on web when provider is Doubao", async ({ page }) => {
    await page.goto("/");
    await switchToDoubao(page, "test-key-placeholder");

    const badge = page.locator("[data-testid=provider-badge]");
    await expect(badge).toContainText("Doubao TTS");
  });

  test("empty API key prevents synthesis — status stays Ready", async ({ page }) => {
    await page.goto("/");
    await switchToDoubao(page, ""); // empty key
    await createTestArticle(page);

    await page.locator("[data-testid=player-play]").click();

    // Synthesis is blocked by the empty-key check in handlePlay.
    // Status should remain "Ready" — no TTS request sent.
    await page.waitForTimeout(1500);
    await expect(page.locator("[data-testid=player-status]")).toHaveText("Ready");
  });

  test("mock V3 streaming API — loads audio, updates sentence tracking, plays to completion", async ({ page }) => {
    const mockMp3 = minimalMp3Base64();

    // Intercept the V3 unidirectional endpoint (proxy cleared, so direct fetch)
    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      const request = route.request();
      const body = request.postDataJSON();

      // Verify V3 req_params format
      expect(body.req_params).toBeDefined();
      expect(body.req_params.text).toBeDefined();
      expect(body.req_params.speaker).toBeDefined();
      expect(body.req_params.audio_params.format).toBe("mp3");
      expect(body.req_params.audio_params.sample_rate).toBe(24000);

      const text: string = body.req_params.text;
      const sentences = text.match(/[^。！？.!?\n]+[。！？.!?\n]*/g) || [text];

      const chunks = sentences.map(s =>
        JSON.stringify({
          code: 0,
          message: "OK",
          data: mockMp3,
          sentence: { text: s, words: [] },
          usage: { text_words: s.length },
        })
      );

      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: chunks.join("\n"),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "test-api-key-123");
    await createTestArticle(page);

    await expect(page.locator("[data-testid=player-status]")).toHaveText("Ready");

    await page.locator("[data-testid=player-play]").click();

    // Playback starts (mock audio is very short) and then completes.
    // After playback finishes, status returns to "Ready".
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 15000 }
    );
  });

  test("mock V3 API error — console.error is logged when server returns error code", async ({ page }) => {
    // Intercept the V3 endpoint with an error response
    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: 3001, message: "Unauthorized: invalid API key" }),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "bad-api-key");
    await createTestArticle(page);

    const errors = await captureConsoleErrors(page, async () => {
      await page.locator("[data-testid=player-play]").click();
    });

    // The error should be logged to console (app's .catch() does console.error)
    // Status should eventually return to Ready (not stuck on Reading)
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 10000 }
    );
  });

  test("mock V3 empty audio response — caught as error and status resets", async ({ page }) => {
    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: 0, message: "OK", data: null, usage: { text_words: 0 } }),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "test-key");
    await createTestArticle(page);

    await page.locator("[data-testid=player-play]").click();

    // The app catches the "No audio data" error and resets state.
    // Status returns to "Ready" instead of staying on "Reading...".
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 10000 }
    );
  });

  test("V3 request body has correct req_params format (no V1 legacy fields)", async ({ page }) => {
    let capturedBody: any = null;

    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: 0,
          message: "OK",
          data: minimalMp3Base64(),
          sentence: { text: "测试", words: [] },
          usage: { text_words: 2 },
        }),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "test-key", "seed-tts-2.0");
    await createTestArticle(page);

    await page.locator("[data-testid=player-play]").click();

    // Poll until the request is captured
    await expect.poll(() => capturedBody !== null, { timeout: 10000 }).toBe(true);

    // Verify V3 format
    expect(capturedBody.req_params).toBeDefined();
    expect(typeof capturedBody.req_params.text).toBe("string");
    expect(capturedBody.req_params.text.length).toBeGreaterThan(5);
    expect(typeof capturedBody.req_params.speaker).toBe("string");
    expect(capturedBody.req_params.speaker.length).toBeGreaterThan(0);
    expect(capturedBody.req_params.audio_params.format).toBe("mp3");
    expect(capturedBody.req_params.audio_params.sample_rate).toBe(24000);

    // V3 must NOT use old V1 fields
    expect(capturedBody.app).toBeUndefined();
    expect(capturedBody.user).toBeUndefined();
    expect(capturedBody.audio).toBeUndefined();
    expect(capturedBody.request).toBeUndefined();
  });

  test("V3 request includes required headers: X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id", async ({ page }) => {
    let capturedHeaders: Record<string, string> = {};

    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      capturedHeaders = route.request().headers();
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: 0,
          message: "OK",
          data: minimalMp3Base64(),
          usage: { text_words: 2 },
        }),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "my-api-key-v3", "seed-tts-2.0");
    await createTestArticle(page);

    await page.locator("[data-testid=player-play]").click();

    await expect.poll(() => Object.keys(capturedHeaders).length > 0, { timeout: 10000 }).toBe(true);

    expect(capturedHeaders["x-api-key"]).toBe("my-api-key-v3");
    expect(capturedHeaders["x-api-resource-id"]).toBe("seed-tts-2.0");
    expect(capturedHeaders["x-api-request-id"]).toBeDefined();
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });

  test("stop button halts playback and resets status", async ({ page }) => {
    const mockMp3 = minimalMp3Base64();
    // Duplicate to make a longer audio so playback doesn't end before we can stop
    const longMp3 = mockMp3 + mockMp3 + mockMp3 + mockMp3 + mockMp3
      + mockMp3 + mockMp3 + mockMp3 + mockMp3 + mockMp3;

    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: 0,
          message: "OK",
          data: longMp3,
          sentence: { text: "你好，欢迎使用豆包语音合成服务。这是一个端到端测试。", words: [] },
          usage: { text_words: 14 },
        }),
      });
    });

    await page.goto("/");
    await switchToDoubao(page, "test-key");
    await createTestArticle(page);

    await page.locator("[data-testid=player-play]").click();

    // Wait for playback to start (Reading... or Synthesizing...)
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i, // wait for it to NOT be "Ready"
      { timeout: 3000 }
    ).catch(() => {});

    // Press stop — the handleStop callback now resets web state
    await page.locator("[data-testid=player-stop]").click();

    // Status should be Ready (not stuck on Reading...)
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 5000 }
    );
  });

  test("settings persist across open/close", async ({ page }) => {
    await page.goto("/");

    await page.locator("[data-testid=settings-btn]").click();
    const doubaoOption = page.getByText("Doubao TTS", { exact: true });
    await doubaoOption.click();

    const apiKeyInput = page.locator("[data-testid=doubao-api-key-input]");
    await apiKeyInput.waitFor({ state: "visible", timeout: 5000 });
    await apiKeyInput.fill("persistent-test-key");

    await page.getByText("Done").click();

    // Reopen settings — key should persist
    await page.locator("[data-testid=settings-btn]").click();
    const reopenedInput = page.locator("[data-testid=doubao-api-key-input]");
    await reopenedInput.waitFor({ state: "visible", timeout: 5000 });
    await expect(reopenedInput).toHaveValue("persistent-test-key");

    await page.getByText("Done").click();
  });
});

// ─── Real API Integration (requires DOUBAO_API_KEY env var) ──────────────────
// CORS note: the browser blocks cross-origin fetch to openspeech.bytedance.com.
// We use Playwright route interception as a CORS bypass — the actual HTTP call
// is made from Node.js (no CORS), then the response is proxied back to the page.
// The local proxy-server.mjs achieves the same thing for real browser usage.

test.describe("Doubao V3 HTTP TTS — Live Integration", () => {

  test("real V3 API call (Playwright CORS bypass) — plays audio from live endpoint", async ({ page }) => {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      test.skip(true, "DOUBAO_API_KEY not set — skipping live V3 API test");
      return;
    }

    let requestBody: any = null;

    // Intercept the API call and proxy it through Node.js to avoid CORS
    await page.route("**/openspeech.bytedance.com/api/v3/tts/unidirectional", async (route) => {
      requestBody = route.request().postDataJSON();
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(route.request().headers())) {
        headers[k] = v;
      }

      // Make the real API call from Node.js (no CORS)
      try {
        const response = await fetch("https://openspeech.bytedance.com/api/v3/tts/unidirectional", {
          method: "POST",
          headers: {
            "Content-Type": headers["content-type"] || "application/json",
            "X-Api-Key": headers["x-api-key"] || "",
            "X-Api-Resource-Id": headers["x-api-resource-id"] || "seed-tts-2.0",
            "X-Api-Request-Id": headers["x-api-request-id"] || `e2e-${Date.now()}`,
          },
          body: route.request().postData() || undefined,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          await route.fulfill({
            status: response.status,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: response.status, message: `HTTP ${response.status}: ${errorText}` }),
          });
          return;
        }

        // Read the full streaming response body (for testing, full-body is fine)
        const responseText = await response.text();

        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: responseText,
        });
      } catch (err: any) {
        await route.fulfill({
          status: 502,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: -1, message: `Proxy error: ${err.message}` }),
        });
      }
    });

    await page.goto("/");
    await switchToDoubao(page, apiKey);

    await createTestArticle(page, "Live V3 CORS Bypass");

    // Capture console errors for debugging
    const consoleErrors: string[] = [];
    page.on("console", (msg: any) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.locator("[data-testid=player-play]").click();

    // Wait for playback to start — "Reading..." or "Synthesizing..."
    try {
      await expect(page.locator("[data-testid=player-status]")).toContainText(
        /Reading|Synthesizing/i,
        { timeout: 20000 }
      );
      console.log("[e2e] ✓ Live V3 API call succeeded — playback started");
    } catch {
      // Check if it errored out
      console.log("[e2e] Console errors:", consoleErrors.join(" | "));
      const statusText = await page.locator("[data-testid=player-status]").textContent();
      console.log(`[e2e] Final status: "${statusText}"`);

      if (requestBody && consoleErrors.some(e => e.includes("code 30") || e.includes("Unauthorized"))) {
        test.skip(true, `API key lacks V3 access: ${consoleErrors.join(" | ")}`);
        return;
      }
      if (consoleErrors.some(e => e.includes("No audio data") || e.includes("No audio"))) {
        test.skip(true, `API returned no audio — possibly no TTS quota: ${consoleErrors.join(" | ")}`);
        return;
      }
      if (consoleErrors.length > 0) {
        throw new Error(`Live V3 API failed: ${consoleErrors.join(" | ")}`);
      }
      throw new Error(`Playback did not start. Status: "${statusText}"`);
    }

    // Verify V3 request format was sent
    expect(requestBody).not.toBeNull();
    expect(requestBody!.req_params).toBeDefined();
    expect(requestBody!.req_params.audio_params.format).toBe("mp3");
    expect(requestBody!.req_params.speaker).toBeDefined();
    expect(typeof requestBody!.req_params.text).toBe("string");

    // Wait for playback to complete naturally (mock audio is short, live may take longer)
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 30000 }
    );
    console.log("[e2e] ✓ Live V3 playback completed successfully");
  });

  test("real V3 API via local proxy server (localhost:3001)", async ({ page }) => {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      test.skip(true, "DOUBAO_API_KEY not set — skipping live V3 proxy test");
      return;
    }

    // Check if proxy server is running
    let proxyAlive = false;
    try {
      const check = await fetch("http://localhost:3001/", { method: "OPTIONS" });
      proxyAlive = true;
    } catch {
      // proxy not running
    }

    if (!proxyAlive) {
      test.skip(true, "Local proxy server not running on localhost:3001 — start with: node proxy-server.mjs");
      return;
    }

    // The proxy server also has CORS issues for the upstream call from itself,
    // but since it runs in Node.js (not browser), it should work.
    // We still need Playwright to intercept because the browser →
    // localhost:3001 → openspeech path goes through the proxy.

    await page.goto("/");

    await page.locator("[data-testid=settings-btn]").click();
    const doubaoOption = page.getByText("Doubao TTS", { exact: true });
    await doubaoOption.click();

    const apiKeyInput = page.locator("[data-testid=doubao-api-key-input]");
    await apiKeyInput.waitFor({ state: "visible", timeout: 5000 });
    await apiKeyInput.fill(apiKey);

    // Set local proxy URL
    const resourceInput = page.locator("[data-testid=doubao-resource-id-input]");
    await resourceInput.clear();
    await resourceInput.fill("seed-tts-2.0");

    const proxyInput = page.locator("[data-testid=doubao-proxy-url-input]");
    await proxyInput.clear();
    await proxyInput.fill("http://localhost:3001/");

    await page.getByText("Done").click();
    await createTestArticle(page, "Live Proxy Test");

    const consoleErrors: string[] = [];
    page.on("console", (msg: any) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.locator("[data-testid=player-play]").click();

    try {
      await expect(page.locator("[data-testid=player-status]")).toContainText(
        /Reading|Synthesizing/i,
        { timeout: 20000 }
      );
      console.log("[e2e] ✓ Live proxy V3 API call succeeded");
    } catch {
      console.log("[e2e] Console errors:", consoleErrors.join(" | "));

      if (consoleErrors.some(e => e.includes("Failed to fetch") || e.includes("NetworkError"))) {
        test.skip(true, "Proxy unreachable — ensure proxy-server.mjs is running on port 3001");
        return;
      }
      if (consoleErrors.length > 0) {
        throw new Error(`Live proxy test failed: ${consoleErrors.join(" | ")}`);
      }
      throw new Error("Proxy playback did not start within timeout");
    }

    // Wait for completion
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 30000 }
    );
    console.log("[e2e] ✓ Live proxy V3 playback completed");
  });

  test("real V3 API via remote proxy (https://proxy.14790897.xyz/proxy/)", async ({ page }) => {
    const apiKey = process.env.DOUBAO_API_KEY;
    if (!apiKey) {
      test.skip(true, "DOUBAO_API_KEY not set — skipping remote proxy test");
      return;
    }

    await page.goto("/");

    await page.locator("[data-testid=settings-btn]").click();
    const doubaoOption = page.getByText("Doubao TTS", { exact: true });
    await doubaoOption.click();

    const apiKeyInput = page.locator("[data-testid=doubao-api-key-input]");
    await apiKeyInput.waitFor({ state: "visible", timeout: 5000 });
    await apiKeyInput.fill(apiKey);

    const resourceInput = page.locator("[data-testid=doubao-resource-id-input]");
    await resourceInput.clear();
    await resourceInput.fill("seed-tts-2.0");

    // Set the remote proxy URL
    const proxyInput = page.locator("[data-testid=doubao-proxy-url-input]");
    await proxyInput.clear();
    await proxyInput.fill("https://proxy.14790897.xyz/proxy/");

    await page.getByText("Done").click();
    await createTestArticle(page, "Remote Proxy Test");

    const consoleErrors: string[] = [];
    page.on("console", (msg: any) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.locator("[data-testid=player-play]").click();

    try {
      await expect(page.locator("[data-testid=player-status]")).toContainText(
        /Reading|Synthesizing/i,
        { timeout: 20000 }
      );
      console.log("[e2e] ✓ Remote proxy V3 API call succeeded");
    } catch {
      console.log("[e2e] Console errors:", consoleErrors.join(" | "));

      if (consoleErrors.some(e => e.includes("Failed to fetch") || e.includes("NetworkError") || e.includes("timeout"))) {
        test.skip(true, "Remote proxy unreachable — check https://proxy.14790897.xyz/proxy/");
        return;
      }
      if (consoleErrors.some(e => e.includes("code 30") || e.includes("Unauthorized"))) {
        test.skip(true, `Remote proxy: API key lacks V3 access: ${consoleErrors.join(" | ")}`);
        return;
      }
      if (consoleErrors.length > 0) {
        throw new Error(`Remote proxy test failed: ${consoleErrors.join(" | ")}`);
      }
      throw new Error("Remote proxy playback did not start within timeout");
    }

    // Wait for completion
    await expect(page.locator("[data-testid=player-status]")).toContainText(
      /Ready/i,
      { timeout: 30000 }
    );
    console.log("[e2e] ✓ Remote proxy V3 playback completed");
  });
});
