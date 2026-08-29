import { useEffect, useState } from 'react'
import { LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { createSalt, hashPin, verifyPin } from '../lib/security'
import { platformBiometricAvailable, registerLocalBiometric } from '../lib/biometrics'
import BillNotificationSettings from './BillNotificationSettings'

type Props = { data: SpenzaData; setData: React.Dispatch<React.SetStateAction<SpenzaData>> }
type Mode = 'setup' | 'change' | 'disable' | null

export default function SecuritySettings({ data, setData }: Props) {
  const security = data.security || { enabled: false, timeoutMinutes: 0 }
  const [mode, setMode] = useState<Mode>(null)
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [biometricSupported, setBiometricSupported] = useState(false)
  const [biometricBusy, setBiometricBusy] = useState(false)
  const [biometricMessage, setBiometricMessage] = useState('')

  useEffect(() => {
    platformBiometricAvailable()
      .then(setBiometricSupported)
      .catch(() => setBiometricSupported(false))
  }, [])

  const close = () => {
    setMode(null)
    setPin('')
    setConfirm('')
    setError('')
  }
  const verify = async (value: string) => {
    if (!security.pinHash || !security.salt) return false
    return (await verifyPin(value, security.salt, security.pinHash)).valid
  }
  const submit = async () => {
    if (!mode) return
    if (pin.length < 4) {
      setError('Use at least 4 digits.')
      return
    }
    if (mode === 'setup' || mode === 'change') {
      if (pin !== confirm) {
        setError('PINs do not match.')
        return
      }
      const salt = createSalt()
      const pinHash = await hashPin(pin, salt)
      setData((d) => ({
        ...d,
        security: {
          ...d.security,
          enabled: true,
          pinHash,
          salt,
          timeoutMinutes: d.security?.timeoutMinutes ?? 0,
        },
      }))
      close()
      return
    }
    if (!(await verify(pin))) {
      setError('Incorrect PIN.')
      return
    }
    setData((d) => ({
      ...d,
      security: {
        enabled: false,
        timeoutMinutes: d.security?.timeoutMinutes ?? 0,
        biometricEnabled: false,
      },
    }))
    close()
  }

  const enableBiometric = async () => {
    setBiometricBusy(true)
    setBiometricMessage('')
    try {
      const biometricCredentialId = await registerLocalBiometric()
      setData((d) => ({
        ...d,
        security: { ...d.security, enabled: true, biometricEnabled: true, biometricCredentialId },
      }))
      setBiometricMessage('Biometric unlock is ready on this device.')
    } catch (err) {
      setBiometricMessage(
        err instanceof Error ? err.message : 'Biometric setup could not be completed.',
      )
    } finally {
      setBiometricBusy(false)
    }
  }
  const disableBiometric = () => {
    setData((d) => ({
      ...d,
      security: { ...d.security, biometricEnabled: false, biometricCredentialId: undefined },
    }))
    setBiometricMessage('Biometric unlock disabled.')
  }

  return (
    <>
      <div className="settingsRow securitySettingsRow">
        <div>
          <span>App Lock</span>
          <small>{security.enabled ? 'PIN protection enabled' : 'Protect Spenza with a PIN'}</small>
        </div>
        {security.enabled ? (
          <b className="securityOn">
            <ShieldCheck /> On
          </b>
        ) : (
          <button className="settingsInlineButton" onClick={() => setMode('setup')}>
            Enable
          </button>
        )}
      </div>
      {security.enabled && (
        <div className="securityOptions">
          <label>
            Auto-lock
            <select
              value={security.timeoutMinutes}
              onChange={(e) =>
                setData((d) => ({
                  ...d,
                  security: {
                    ...(d.security || { enabled: true }),
                    enabled: true,
                    timeoutMinutes: Number(e.target.value),
                  },
                }))
              }
            >
              <option value={0}>Immediately</option>
              <option value={1}>After 1 minute</option>
              <option value={5}>After 5 minutes</option>
              <option value={15}>After 15 minutes</option>
            </select>
          </label>
          <div>
            <button onClick={() => setMode('change')}>Change PIN</button>
            <button className="securityDisable" onClick={() => setMode('disable')}>
              Disable
            </button>
          </div>
          <div className="biometricSettings">
            <div>
              <b>Face ID / Biometrics</b>
              <small>
                {security.biometricEnabled
                  ? 'Enabled on this device'
                  : biometricSupported
                    ? 'Use your device authenticator to unlock'
                    : 'Not available on this device/browser'}
              </small>
            </div>
            {security.biometricEnabled ? (
              <button type="button" className="biometricDisable" onClick={disableBiometric}>
                Turn Off
              </button>
            ) : (
              <button
                type="button"
                className="biometricEnable"
                disabled={!biometricSupported || biometricBusy}
                onClick={enableBiometric}
              >
                {biometricBusy ? 'Setting up…' : 'Enable'}
              </button>
            )}
          </div>
          {biometricMessage && <div className="biometricMessage">{biometricMessage}</div>}
        </div>
      )}
      <BillNotificationSettings />
      {mode && (
        <div className="dialogOverlay securityDialog" onClick={close}>
          <div className="dialogCard" onClick={(e) => e.stopPropagation()}>
            <button className="securityClose" onClick={close}>
              <X />
            </button>
            <div className="dialogIcon infoIcon">
              <LockKeyhole />
            </div>
            <h2>
              {mode === 'disable'
                ? 'Disable App Lock?'
                : mode === 'change'
                  ? 'Change PIN'
                  : 'Enable App Lock'}
            </h2>
            <p>
              {mode === 'disable'
                ? 'Enter your current PIN to remove the lock.'
                : 'Choose a PIN with at least 4 digits.'}
            </p>
            <input
              className="securityPinInput"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''))
                setError('')
              }}
              placeholder="PIN"
              autoFocus
            />
            {mode !== 'disable' && (
              <input
                className="securityPinInput"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value.replace(/\D/g, ''))
                  setError('')
                }}
                placeholder="Confirm PIN"
              />
            )}
            {error && <div className="securityError">{error}</div>}
            <button className="primary securitySubmit" onClick={submit}>
              {mode === 'disable'
                ? 'Disable Lock'
                : mode === 'change'
                  ? 'Save New PIN'
                  : 'Enable Lock'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
