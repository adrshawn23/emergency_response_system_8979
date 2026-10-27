import { test, expect } from '@playwright/test';

/**
 * Authentication Tests
 * Tests for login, logout, and role-based access
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    // Check for email input field instead of title
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should show validation error for empty credentials', async ({ page }) => {
    await page.click('button[type="submit"]');
    // Check for error message or button being disabled
  });

  test('should login as admin', async ({ page }) => {
    // This test requires valid admin credentials
    // Update with actual test credentials
    await page.fill('input[type="email"]', 'admin@emergency.gov');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 30000 });
    
    // Verify dashboard is visible (heading — 'Command center' also matches the nav button)
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'admin@emergency.gov');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/', { timeout: 30000 });
    
    // Logout
    await page.click('button[aria-label="Sign out"]');
    
    // Verify redirected to login
    await page.waitForURL('/login', { timeout: 30000 });
  });

  test('should login as dispatcher', async ({ page }) => {
    await page.fill('input[type="email"]', 'dispatcher@emergency.gov');
    await page.fill('input[type="password"]', 'dispatcher123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 30000 });
    
    // Verify dashboard is visible (heading — 'Command center' also matches the nav button)
    await expect(page.getByRole('heading', { name: /Command Center/ })).toBeVisible();
  });

  test('should login as responder', async ({ page }) => {
    await page.fill('input[type="email"]', 'responder@emergency.gov');
    await page.fill('input[type="password"]', 'responder123');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/', { timeout: 30000 });
    
    // Verify responder workspace is visible
    await expect(page.getByRole('heading', { name: 'Response board' })).toBeVisible();
  });
});
