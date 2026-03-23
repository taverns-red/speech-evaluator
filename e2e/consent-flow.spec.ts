// E2E: Consent Flow — verify consent form, localStorage persistence, and button gating
import { test, expect } from "@playwright/test";

// Skip the setup wizard by pre-setting the completion flag
const SKIP_WIZARD = () => localStorage.setItem("speechEval_setupComplete", "1");

test.describe("Consent Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("speechEval_setupComplete", "1");
    });
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("start button is disabled without consent", async ({ page }) => {
    const startBtn = page.locator("#btn-start");
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toBeDisabled();
  });

  test("filling consent enables start button", async ({ page }) => {
    const speakerInput = page.locator("#speaker-name-input");
    await expect(speakerInput).toBeVisible();
    await speakerInput.fill("Test Speaker");

    const consentCheckbox = page.locator("#consent-checkbox");
    await expect(consentCheckbox).toBeVisible();
    await consentCheckbox.check();

    const startBtn = page.locator("#btn-start");
    await expect(startBtn).toBeEnabled({ timeout: 2000 });
  });

  test("consent persists across page refresh", async ({ page }) => {
    await page.locator("#speaker-name-input").fill("Persistent Speaker");
    await page.locator("#consent-checkbox").check();
    await expect(page.locator("#btn-start")).toBeEnabled({ timeout: 2000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for restoreFormState() to complete — checkbox checked confirms it ran
    await expect(page.locator("#consent-checkbox")).toBeChecked({ timeout: 5000 });

    const speakerValue = await page.locator("#speaker-name-input").inputValue();
    expect(speakerValue).toBe("Persistent Speaker");

    const isChecked = await page.locator("#consent-checkbox").isChecked();
    expect(isChecked).toBe(true);

    await expect(page.locator("#btn-start")).toBeEnabled({ timeout: 5000 });
  });
});
