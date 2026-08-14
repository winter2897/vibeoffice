import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AI_PROVIDERS } from '@genoffice/ai-provider'
import type { AiProviderId, AiSettings } from '@genoffice/ai-provider'
import { useI18n } from './locale'
import type { StringKey } from './locale'
import type { AccountStatus, UiTheme } from '../../shared/home-api'
import './settings.css'

// ── Settings modal (opened from the account menu) ─────────
// Aide-style two-pane dialog: section nav on the left, fields on the right.
// All values go through the existing home IPC; nothing is stored locally.

// sorted by ISO 639 language code — native-script labels have no natural
// shared alphabet, so the code is the ordering key
const LANG_OPTIONS = [
  { value: 'ar', label: 'العربية' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'he', label: 'עברית' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'th', label: 'ไทย' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
] as const

// GenMail's option order: follow-system first, then the manual picks
const THEME_OPTIONS = [
  { value: 'system', labelKey: 'themeSystem' },
  { value: 'light', labelKey: 'themeLight' },
  { value: 'dark', labelKey: 'themeDark' },
] as const satisfies readonly { value: UiTheme; labelKey: StringKey }[]

const CHANNEL_OPTIONS = [
  { value: 'stable', labelKey: 'channelStable' },
  { value: 'beta', labelKey: 'channelBeta' },
] as const satisfies readonly { value: 'stable' | 'beta'; labelKey: StringKey }[]

type SectionId = 'account' | 'general' | 'ai' | 'about'

const SECTIONS: readonly { id: SectionId; labelKey: StringKey }[] = [
  { id: 'account', labelKey: 'setSecAccount' },
  { id: 'general', labelKey: 'setSecGeneral' },
  { id: 'ai', labelKey: 'setSecAi' },
  { id: 'about', labelKey: 'setSecAbout' },
]

function SectionIcon({ id }: { id: SectionId }) {
  if (id === 'account') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="5.2" r="2.9" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M2.7 13.6a5.5 5.5 0 0 1 10.6 0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (id === 'general') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2 5h8M13 5h1M2 11h1M6 11h8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <circle cx="11.5" cy="5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="4.5" cy="11" r="1.7" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    )
  }
  if (id === 'ai') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 2.2 7 5l2.8 1-2.8 1-1 2.8-1-2.8L2.2 6 5 5z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M11.6 8.4l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 7.4v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="5.1" r="0.8" fill="currentColor" />
    </svg>
  )
}

/** label + free-text/password input row; the first editable field in this dialog */
function InputField({
  id,
  label,
  value,
  placeholder,
  secret,
  onChange,
  onCommit,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  secret?: boolean
  onChange: (next: string) => void
  /** persist point — fires on blur, not on every keystroke */
  onCommit: () => void
}) {
  return (
    <div className="set-field">
      <div className="set-field-text">
        <label className="set-field-label" htmlFor={id}>
          {label}
        </label>
      </div>
      <input
        id={id}
        className="set-input"
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
      />
    </div>
  )
}

/**
 * Provider names are brands (Claude, Gemini, OpenRouter…) and stay as written.
 * The bundled one is the exception: "Built-in" is a plain word, so it follows
 * the UI language like the rest of the dialog.
 */
function aiProviderLabel(
  id: AiProviderId | undefined,
  fallback: string,
  t: (key: StringKey) => string,
): string {
  return id === 'genspark' ? t('setAiBuiltIn') : fallback
}

/** label-over-value field row with an optional right-aligned action */
function Field({
  label,
  value,
  valueTitle,
  action,
}: {
  label: string
  value: string
  valueTitle?: string
  action?: ReactNode
}) {
  return (
    <div className="set-field">
      <div className="set-field-text">
        <div className="set-field-label">{label}</div>
        <div className="set-field-value" data-tip={valueTitle}>
          {value}
        </div>
      </div>
      {action}
    </div>
  )
}

export interface SettingsModalProps {
  status: AccountStatus | null
  loggingOut: boolean
  /** browser sign-in in progress (spinner shows on the account entry) */
  loginWaiting: boolean
  /** device auth URL while waiting — rescue actions when the browser did not auto-open */
  loginUrl: string | null
  urlCopied: boolean
  onOpenLoginUrl: () => void
  onCopyLoginUrl: () => void
  onClose: () => void
  /** closes the modal and launches the Aide login flow (progress shows on the account entry) */
  onLogin: () => void
  onLogout: () => void
}

export function SettingsModal({
  status,
  loggingOut,
  loginWaiting,
  loginUrl,
  urlCopied,
  onOpenLoginUrl,
  onCopyLoginUrl,
  onClose,
  onLogin,
  onLogout,
}: SettingsModalProps) {
  const { lang, setLang, t } = useI18n()
  const [section, setSection] = useState<SectionId>('account')
  const [theme, setTheme] = useState<UiTheme>('system')
  const [saveDir, setSaveDir] = useState('')
  const [channel, setChannel] = useState<'stable' | 'beta'>('stable')
  const [appVersion, setAppVersion] = useState('')
  const [ai, setAi] = useState<AiSettings | null>(null)

  useEffect(() => {
    let alive = true
    void window.aiOffice.getAiSettings?.().then((s) => {
      if (alive && s) setAi(s)
    })
    void window.aiOffice.getTheme?.().then((th) => {
      if (alive) setTheme(th)
    })
    void window.aiOffice.getDefaultSaveDir?.().then((dir) => {
      if (alive && dir) setSaveDir(dir)
    })
    void window.aiOffice.getUpdateChannel?.().then((ch) => {
      if (alive) setChannel(ch)
    })
    void window.aiOffice.getAppVersion?.().then((v) => {
      if (alive && v) setAppVersion(v)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const applyTheme = (next: UiTheme) => {
    setTheme(next)
    void window.aiOffice.setTheme(next)
    if (next === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', next)
  }

  const changeSaveDir = () => {
    void window.aiOffice.pickDefaultSaveDir?.().then((dir) => {
      if (dir) setSaveDir(dir)
    })
  }

  // Typing writes local state only; the file write happens on blur (and at once
  // for the provider dropdown), so an API key is not persisted keystroke by keystroke.
  const persistAi = (next: AiSettings) => {
    setAi(next)
    void window.aiOffice.setAiSettings?.(next)
  }

  const editAiField = (key: 'apiKey' | 'model' | 'baseUrl', value: string) => {
    if (!ai) return
    setAi({
      ...ai,
      providers: {
        ...ai.providers,
        [ai.provider]: { ...ai.providers[ai.provider], [key]: value },
      },
    })
  }

  const aiMeta = ai ? AI_PROVIDERS.find((p) => p.id === ai.provider) : undefined
  const aiConfig = ai ? ai.providers[ai.provider] : undefined

  const loggedIn = status?.loggedIn ?? false
  const email = status?.email ?? ''

  return (
    <div
      className="set-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="set-dialog" role="dialog" aria-modal="true" aria-label={t('settings')}>
        <div className="set-header">
          <h2 className="set-title">{t('settings')}</h2>
          <button className="set-close" onClick={onClose} aria-label={t('cancel')}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="set-body">
          <nav className="set-nav" aria-label={t('settings')}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`set-nav-item${section === s.id ? ' active' : ''}`}
                aria-current={section === s.id}
                onClick={() => setSection(s.id)}
              >
                <SectionIcon id={s.id} />
                {t(s.labelKey)}
              </button>
            ))}
          </nav>
          <div className="set-pane">
            {section === 'account' && (
              <>
                <h3 className="set-pane-title">{t('setSecAccount')}</h3>
                <Field label={t('setEmail')} value={loggedIn ? email : t('setNotLoggedIn')} />
                {loggedIn && (
                  <Field
                    label={t('credits')}
                    value={
                      status?.creditBalance === undefined
                        ? '—'
                        : Math.floor(status.creditBalance).toLocaleString('en-US')
                    }
                    action={
                      <button
                        className="set-btn"
                        data-tip={t('creditsTip')}
                        onClick={() => void window.aiOffice.openCreditUsage?.()}
                      >
                        {t('setViewUsage')}
                      </button>
                    }
                  />
                )}
                <div className="set-pane-footer">
                  {loggedIn ? (
                    <button className="set-btn danger" disabled={loggingOut} onClick={onLogout}>
                      {loggingOut ? t('loggingOut') : t('logout')}
                    </button>
                  ) : (
                    <>
                      {loginWaiting && loginUrl && (
                        <>
                          <button className="set-btn" onClick={onOpenLoginUrl}>
                            {t('loginOpenManually')}
                          </button>
                          <button className="set-btn" onClick={onCopyLoginUrl}>
                            {urlCopied ? t('loginCopied') : t('loginCopyUrl')}
                          </button>
                        </>
                      )}
                      <button className="set-btn primary" onClick={onLogin}>
                        {loginWaiting ? t('waitingShort') : t('loginAide')}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {section === 'general' && (
              <>
                <h3 className="set-pane-title">{t('setSecGeneral')}</h3>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label" htmlFor="set-lang">
                      {t('language')}
                    </label>
                  </div>
                  <span className="set-select-wrap">
                    <span className="set-select-text" aria-hidden="true">
                      {LANG_OPTIONS.find((o) => o.value === lang)?.label ?? lang}
                    </span>
                    <select
                      id="set-lang"
                      className="set-select"
                      value={lang}
                      onChange={(e) => setLang(e.target.value as typeof lang)}
                    >
                      {LANG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label" htmlFor="set-theme">
                      {t('theme')}
                    </label>
                  </div>
                  <span className="set-select-wrap">
                    <span className="set-select-text" aria-hidden="true">
                      {t(THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? 'themeSystem')}
                    </span>
                    <select
                      id="set-theme"
                      className="set-select"
                      value={theme}
                      onChange={(e) => applyTheme(e.target.value as UiTheme)}
                    >
                      {THEME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                <Field
                  label={t('saveLocation')}
                  value={saveDir || '—'}
                  valueTitle={saveDir}
                  action={
                    <button className="set-btn" onClick={changeSaveDir}>
                      {t('setChange')}
                    </button>
                  }
                />
              </>
            )}
            {section === 'ai' && (
              <>
                <h3 className="set-pane-title">{t('setSecAi')}</h3>
                {!(ai && aiConfig) && <p className="set-note">{t('setAiUnavailable')}</p>}
              </>
            )}
            {section === 'ai' && ai && aiConfig && (
              <>
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label" htmlFor="set-ai-provider">
                      {t('setAiProvider')}
                    </label>
                  </div>
                  <span className="set-select-wrap">
                    <span className="set-select-text" aria-hidden="true">
                      {aiProviderLabel(aiMeta?.id, aiMeta?.label ?? ai.provider, t)}
                    </span>
                    <select
                      id="set-ai-provider"
                      className="set-select"
                      value={ai.provider}
                      onChange={(e) =>
                        persistAi({ ...ai, provider: e.target.value as AiProviderId })
                      }
                    >
                      {AI_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {aiProviderLabel(p.id, p.label, t)}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
                {/* the built-in Aide provider authenticates through the account
                    sign-in, so it exposes no key or model fields */}
                {ai.provider !== 'genspark' && (
                  <>
                    <InputField
                      id="set-ai-key"
                      label={t('setAiApiKey')}
                      value={aiConfig.apiKey}
                      placeholder={aiMeta?.keyPlaceholder}
                      secret
                      onChange={(v) => editAiField('apiKey', v)}
                      onCommit={() => persistAi(ai)}
                    />
                    {aiMeta?.needsBaseUrl && (
                      <InputField
                        id="set-ai-base-url"
                        label={t('setAiBaseUrl')}
                        value={aiConfig.baseUrl ?? ''}
                        placeholder="https://api.example.com/v1"
                        onChange={(v) => editAiField('baseUrl', v)}
                        onCommit={() => persistAi(ai)}
                      />
                    )}
                    {aiMeta && aiMeta.models.length > 0 ? (
                      <div className="set-field">
                        <div className="set-field-text">
                          <label className="set-field-label" htmlFor="set-ai-model">
                            {t('setAiModel')}
                          </label>
                        </div>
                        <span className="set-select-wrap">
                          <span className="set-select-text" aria-hidden="true">
                            {aiConfig.model || '—'}
                          </span>
                          <select
                            id="set-ai-model"
                            className="set-select"
                            value={aiConfig.model}
                            onChange={(e) =>
                              persistAi({
                                ...ai,
                                providers: {
                                  ...ai.providers,
                                  [ai.provider]: { ...aiConfig, model: e.target.value },
                                },
                              })
                            }
                          >
                            {aiMeta.models.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </span>
                      </div>
                    ) : (
                      // open-ended catalogs (OpenRouter, custom endpoints): ids
                      // change too often for a fixed list, so the model is typed
                      <InputField
                        id="set-ai-model"
                        label={t('setAiModel')}
                        value={aiConfig.model}
                        placeholder={aiMeta?.defaultModel}
                        onChange={(v) => editAiField('model', v)}
                        onCommit={() => persistAi(ai)}
                      />
                    )}
                    <p className="set-note">{t('setAiHint')}</p>
                  </>
                )}
              </>
            )}
            {section === 'about' && (
              <>
                <h3 className="set-pane-title">{t('setSecAbout')}</h3>
                <Field label={t('versionLabel')} value={appVersion || '—'} />
                <div className="set-field">
                  <div className="set-field-text">
                    <label className="set-field-label" htmlFor="set-channel">
                      {t('updateChannel')}
                    </label>
                  </div>
                  <span className="set-select-wrap">
                    <span className="set-select-text" aria-hidden="true">
                      {t(
                        CHANNEL_OPTIONS.find((o) => o.value === channel)?.labelKey ??
                          'channelStable',
                      )}
                    </span>
                    <select
                      id="set-channel"
                      className="set-select"
                      value={channel}
                      onChange={(e) => {
                        const next = e.target.value === 'beta' ? 'beta' : 'stable'
                        setChannel(next)
                        void window.aiOffice.setUpdateChannel(next)
                      }}
                    >
                      {CHANNEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {t(opt.labelKey)}
                        </option>
                      ))}
                    </select>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
