import { test, expect } from '@playwright/test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchShell, closeAndSaveVideo, screenshotPath } from './helpers'

test.describe('settings: AI provider', () => {
  test('picking OpenRouter reveals key/model fields and survives a reopen', async () => {
    const launched = await launchShell({ onboardingSeen: true, videoDir: 'ai-settings' })
    const { page } = launched
    try {
      await page.locator('.account-btn').click()
      await page.locator('.set-nav-item', { hasText: 'AI Provider' }).click()

      // the built-in provider authenticates through the account, so it offers no key field
      await expect(page.locator('#set-ai-provider')).toHaveValue('genspark')
      await expect(page.locator('#set-ai-key')).toHaveCount(0)

      // the list names vendors; "Aide" is the assistant, never a provider
      const options = await page.locator('#set-ai-provider option').allTextContents()
      expect(options).not.toContain('Aide')
      expect(options).toContain('Built-in')
      expect(options).toContain('OpenRouter')

      await page.locator('#set-ai-provider').selectOption('openrouter')
      await expect(page.locator('#set-ai-key')).toBeVisible()
      // OpenRouter's catalog is open-ended, so the model is a text box, not a dropdown
      await expect(page.locator('input#set-ai-model')).toHaveValue('anthropic/claude-sonnet-4.5')
      // a fixed endpoint: no base-URL field (that belongs to the custom provider)
      await expect(page.locator('#set-ai-base-url')).toHaveCount(0)

      await page.locator('#set-ai-key').fill('sk-or-v1-e2e')
      await page.locator('input#set-ai-model').fill('openai/gpt-4.1-mini')
      await page.locator('input#set-ai-model').blur()
      await page.screenshot({ path: screenshotPath('ai-settings-openrouter') })

      // reopening reads back from ai-settings.json, proving the write landed
      await page.locator('.set-close').click()
      await page.locator('.account-btn').click()
      await page.locator('.set-nav-item', { hasText: 'AI Provider' }).click()
      await expect(page.locator('#set-ai-provider')).toHaveValue('openrouter')
      await expect(page.locator('#set-ai-key')).toHaveValue('sk-or-v1-e2e')
      await expect(page.locator('input#set-ai-model')).toHaveValue('openai/gpt-4.1-mini')
    } finally {
      await closeAndSaveVideo(launched, 'ai-settings')
    }
  })

  test('a settings file naming an unknown provider still renders the pane', async () => {
    // real-world case: ai-settings.json written by a build that shipped a
    // provider this one does not have. Keeping the id would leave the pane blank.
    const userDataDir = await mkdtemp(join(tmpdir(), 'genoffice-e2e-unknown-'))
    await writeFile(
      join(userDataDir, 'ai-settings.json'),
      JSON.stringify({
        provider: 'claude-cli',
        providers: { genspark: { apiKey: '', model: 'x' } },
      }),
    )
    const launched = await launchShell({
      onboardingSeen: true,
      userDataDir,
      videoDir: 'ai-settings-unknown',
    })
    const { page } = launched
    try {
      await page.locator('.account-btn').click()
      await page.locator('.set-nav-item', { hasText: 'AI Provider' }).click()
      await expect(page.locator('.set-pane-title')).toHaveText('AI Provider')
      await expect(page.locator('#set-ai-provider')).toHaveValue('genspark')
    } finally {
      await closeAndSaveVideo(launched, 'ai-settings-unknown')
    }
  })
})
