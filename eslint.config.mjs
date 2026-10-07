import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  {
    ignores: [
      '.agent/**',
      '.next/**',
      'reference-projects/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      '.vercel/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // ESLint 10 removed `context.getFilename()`, which `eslint-plugin-react`
    // still relies on when `settings.react.version` is left as "detect".
    // Pinning the version explicitly skips that codepath.
    // https://github.com/jsx-eslint/eslint-plugin-react/issues/3977
    settings: {
      react: {
        version: '19.2.7',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
]

export default eslintConfig
