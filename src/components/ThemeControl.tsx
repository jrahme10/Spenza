import { useEffect, useState } from 'react'
import { Laptop, Moon, RotateCcw, Sun } from 'lucide-react'

type ThemePreference = 'auto' | 'dark' | 'light'
type ResolvedTheme = 'dark' | 'light'
type RadiusPreference = 'rounded' | 'soft' | 'square'
type DesignPreference = { accent: string; radius: RadiusPreference }

const defaultDesign: DesignPreference = { accent: '#18dfb1', radius: 'rounded' }

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
function initialPreference(): ThemePreference {
  const saved = localStorage.getItem('spenza-theme') as ThemePreference | null
  return saved === 'dark' || saved === 'light' || saved === 'auto' ? saved : 'auto'
}
function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'auto' ? getSystemTheme() : preference
}
function initialDesign(): DesignPreference {
  try {
    const saved = JSON.parse(localStorage.getItem('spenza-design') || '{}')
    return {
      accent: typeof saved.accent === 'string' ? saved.accent : defaultDesign.accent,
      radius: ['rounded', 'soft', 'square'].includes(saved.radius)
        ? saved.radius
        : defaultDesign.radius,
    }
  } catch {
    return defaultDesign
  }
}
export function applyDesign(design: DesignPreference) {
  const root = document.documentElement
  root.style.setProperty('--accent', design.accent)
  root.dataset.radius = design.radius
  delete root.dataset.density
  localStorage.setItem('spenza-design', JSON.stringify(design))
}
export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference)
  document.documentElement.dataset.theme = resolved
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = resolved
  localStorage.setItem('spenza-theme', preference)
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = resolved === 'dark' ? '#07101c' : '#f5f7fa'
}
export function initTheme() {
  applyTheme(initialPreference())
  applyDesign(initialDesign())
}

export default function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const [design, setDesign] = useState<DesignPreference>(initialDesign)
  useEffect(() => {
    applyTheme(preference)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      setSystemTheme(media.matches ? 'dark' : 'light')
      if (preference === 'auto') applyTheme('auto')
    }
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [preference])
  useEffect(() => {
    applyDesign(design)
  }, [design])
  const updateDesign = <K extends keyof DesignPreference>(key: K, value: DesignPreference[K]) =>
    setDesign((current) => ({ ...current, [key]: value }))
  const resetDesign = () => setDesign(defaultDesign)
  return (
    <>
      <div className="theme-settings-card">
        <div className="themeRowHead">
          <div>
            <span>Theme</span>
            <small>
              {preference === 'auto'
                ? `Auto · system ${systemTheme}`
                : `${preference[0].toUpperCase()}${preference.slice(1)} mode`}
            </small>
          </div>
        </div>
        <div className="theme-segmented" role="group" aria-label="Theme preference">
          <button
            className={preference === 'auto' ? 'selected' : ''}
            onClick={() => setPreference('auto')}
          >
            <Laptop size={15} />
            Auto
          </button>
          <button
            className={preference === 'light' ? 'selected' : ''}
            onClick={() => setPreference('light')}
          >
            <Sun size={15} />
            Light
          </button>
          <button
            className={preference === 'dark' ? 'selected' : ''}
            onClick={() => setPreference('dark')}
          >
            <Moon size={15} />
            Dark
          </button>
        </div>
      </div>
      <div className="design-settings-card">
        <div className="designSettingsHead">
          <div>
            <span>Customize Design</span>
            <small>Personalize how Spenza looks on this device</small>
          </div>
          <button type="button" className="designReset" onClick={resetDesign}>
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
        <div className="designSettingBlock">
          <label>Accent color</label>
          <label className="accentColorPicker">
            <input
              type="color"
              value={design.accent}
              onChange={(e) => updateDesign('accent', e.target.value)}
            />
            <span className="accentColorPreview" style={{ background: design.accent }} />
            <strong>{design.accent.toUpperCase()}</strong>
            <span className="accentPickerHint">Choose color</span>
          </label>
        </div>
        <div className="designSettingBlock">
          <label>Corner style</label>
          <div className="designSegmented">
            {(['rounded', 'soft', 'square'] as RadiusPreference[]).map((value) => (
              <button
                type="button"
                key={value}
                className={design.radius === value ? 'selected' : ''}
                onClick={() => updateDesign('radius', value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
