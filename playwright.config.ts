import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_ORIGIN || "http://localhost:5173",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
