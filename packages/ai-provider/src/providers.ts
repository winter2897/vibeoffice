import type { AiProviderId, AiProviderMeta, AiSettings, LegacyAiSettings } from './types'

/**
 * Aide server-side LLM proxy endpoints. All three protocols share the
 * api_key from the gsk login; model ids follow the proxy's own naming scheme,
 * which differs from the official vendor ids.
 */
export const GENSPARK_LLM_BASE_URLS = {
  anthropic: 'https://www.genspark.ai/api/anthropic',
  gemini: 'https://www.genspark.ai/api/llm_proxy/gemini/v1beta',
  openai: 'https://www.genspark.ai/api/llm_proxy/v1',
} as const

/**
 * Splits VibeOffice usage out of the proxy's default "Claw" billing bucket
 * (the backend attributes gsk-key traffic by X-Agent-Type). Only sent to the
 * Aide proxy — never to direct vendor APIs.
 */
export const GENSPARK_AGENT_TYPE = 'genoffice'

export function gensparkAttributionHeaders(baseUrl?: string): Record<string, string> {
  return baseUrl?.startsWith('https://www.genspark.ai')
    ? { 'X-Agent-Type': GENSPARK_AGENT_TYPE }
    : {}
}

/**
 * Providers that speak the OpenAI /chat/completions protocol at a fixed
 * endpoint. `custom` is absent on purpose — it carries its own baseUrl.
 * Shared by both the streaming and one-shot routers so the two cannot drift.
 */
export const OPENAI_COMPATIBLE_BASE_URLS: Partial<Record<AiProviderId, string>> = {
  deepseek: 'https://api.deepseek.com/v1',
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'genspark',
    // the bundled provider, billed through the signed-in account. Named for what
    // it is, not for the assistant (Aide) or the backend vendor behind it — the
    // settings dialog localizes this one label.
    label: 'Built-in',
    models: [
      'claude-opus-4-7',
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
      'gpt-5.2',
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
    ],
    defaultModel: 'claude-opus-4-7',
    keyPlaceholder: 'Not required - sign in from the Account tab',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    models: [
      'claude-sonnet-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'claude-opus-4-5-20251101',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
    ],
    defaultModel: 'claude-opus-4-7',
    keyPlaceholder: 'sk-ant-api03-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4.1-mini',
    keyPlaceholder: 'sk-...',
  },
  {
    // OpenRouter fronts every vendor behind one OpenAI-compatible endpoint, so
    // the model list is open-ended: ids are `vendor/model` and change weekly.
    // The settings UI takes a free-text model instead of a fixed dropdown.
    id: 'openrouter',
    label: 'OpenRouter',
    models: [],
    defaultModel: 'anthropic/claude-sonnet-4.5',
    keyPlaceholder: 'sk-or-v1-...',
  },
  {
    id: 'custom',
    label: 'Custom',
    models: [],
    defaultModel: '',
    keyPlaceholder: 'API Key',
    needsBaseUrl: true,
  },
]

/**
 * Fresh settings with every provider's default model and an empty key,
 * except providers listed in `defaultApiKeys` (e.g. an app-specific
 * preconfigured Anthropic key). Callers own that policy; this package
 * has no hardcoded keys.
 */
export function defaultAiSettings(
  defaultApiKeys?: Partial<Record<AiProviderId, string>>,
): AiSettings {
  const providers = {} as AiSettings['providers']
  for (const meta of AI_PROVIDERS) {
    providers[meta.id] = {
      apiKey: defaultApiKeys?.[meta.id] ?? '',
      model: meta.defaultModel,
      baseUrl: meta.needsBaseUrl ? '' : undefined,
    }
  }
  return { provider: 'genspark', providers }
}

export function isAiProviderId(value: unknown): value is AiProviderId {
  return AI_PROVIDERS.some((meta) => meta.id === value)
}

/**
 * Merge on-disk settings over freshly computed defaults, migrating the
 * pre-provider shape (a single OpenAI-compatible endpoint) into the
 * "custom" provider slot. `stored` is whatever the caller read from its
 * settings file (already JSON-parsed); this function does no file I/O.
 *
 * A stored `provider` naming an id this build does not ship (an older or
 * newer release, e.g. "claude-cli") falls back to the default: keeping it
 * would leave `providers[provider]` undefined, which blanks the settings
 * pane and makes streaming throw "Unknown provider".
 */
export function resolveAiSettings(
  stored: Partial<AiSettings> & LegacyAiSettings,
  defaults: AiSettings,
): AiSettings {
  if (!stored.providers) {
    if (stored.apiKey) {
      defaults.providers.custom = {
        apiKey: stored.apiKey,
        model: stored.model ?? '',
        baseUrl: stored.baseUrl ?? 'https://api.openai.com/v1',
      }
    }
    return defaults
  }
  return {
    provider: isAiProviderId(stored.provider) ? stored.provider : defaults.provider,
    providers: { ...defaults.providers, ...stored.providers },
  }
}
