import { existsSync } from 'node:fs'
import process from 'node:process'

// Load local QA configuration before reading process.env. Existing shell/CI
// environment values keep precedence over values in .env.
if (existsSync('.env')) process.loadEnvFile('.env')

/** Set CARTOBIKE_LOGIN_EMAIL and CARTOBIKE_LOGIN_PASSWORD to enable valid login. */
export const loginData = {
    email: process.env.CARTOBIKE_LOGIN_EMAIL,
    password: process.env.CARTOBIKE_LOGIN_PASSWORD,
    negativeEmail: process.env.CARTOBIKE_NEGATIVE_LOGIN_EMAIL,
    invalidEmail: 'invalid-email',
    testEmail: 'qa-login@example.invalid',
    firstEditedEmail: 'first@example.invalid',
    secondEditedEmail: 'second@example.invalid'
} as const

export const hasValidLoginCredentials = Boolean(loginData.email && loginData.password)
export const hasNegativeLoginAccount = Boolean(loginData.negativeEmail)
