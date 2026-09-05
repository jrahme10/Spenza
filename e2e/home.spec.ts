import { expect, test } from '@playwright/test'

test('shows the home screen and recent transactions section', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Recent transactions' })).toBeVisible()
})
