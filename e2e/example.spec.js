import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await expect(true).toBe(true);
});
