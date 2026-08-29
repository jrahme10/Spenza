import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'mobile/**', 'node_modules/**', 'public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly',
        crypto: 'readonly', fetch: 'readonly', URL: 'readonly', Blob: 'readonly', File: 'readonly',
        Notification: 'readonly', HTMLElement: 'readonly', HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly', HTMLButtonElement: 'readonly', Event: 'readonly', DOMException: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly',
        indexedDB: 'readonly', IDBDatabase: 'readonly', IDBRequest: 'readonly', IDBTransaction: 'readonly',
        IDBObjectStore: 'readonly', IDBKeyRange: 'readonly', console: 'readonly'
      }
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
)
