import { expect } from 'vitest'
import { getConfig, getTenantToken, resetConfig } from './config.js'

const configKeys = [
  'ENABLE_HTTPS_FOR_DEV',
  'ENABLE_ACCESS_LOGGING',
  'ENABLE_STATUS_SERVICE',
  'SIGNING_SERVICE',
  'STATUS_SERVICE',
  'PORT'
]

function withEnv (values, callback) {
  const originalValues = Object.fromEntries(configKeys.map(key => [key, process.env[key]]))
  for (const key of configKeys) {
    if (Object.hasOwn(values, key)) {
      if (values[key] === undefined) delete process.env[key]
      else process.env[key] = values[key]
    }
  }
  resetConfig()
  try {
    callback()
  } finally {
    for (const key of configKeys) {
      if (originalValues[key] === undefined) delete process.env[key]
      else process.env[key] = originalValues[key]
    }
    resetConfig()
  }
}

describe('configuration', () => {
  it('uses defaults when optional environment values are absent', () => {
    withEnv({
      ENABLE_HTTPS_FOR_DEV: undefined,
      ENABLE_ACCESS_LOGGING: undefined,
      ENABLE_STATUS_SERVICE: undefined,
      SIGNING_SERVICE: undefined,
      STATUS_SERVICE: undefined,
      PORT: undefined
    }, () => {
      expect(getConfig()).to.deep.equal({
        enableHttpsForDev: false,
        enableAccessLogging: false,
        enableStatusService: false,
        signingService: 'SIGNER:4006',
        statusService: 'STATUS:4008',
        port: 4005
      })
    })
  })

  it('parses configured flags, services, and port', () => {
    withEnv({
      ENABLE_HTTPS_FOR_DEV: 'TRUE',
      ENABLE_ACCESS_LOGGING: 'true',
      ENABLE_STATUS_SERVICE: 'true',
      SIGNING_SERVICE: 'signer:5001',
      STATUS_SERVICE: 'status:5002',
      PORT: '5000'
    }, () => {
      expect(getConfig()).to.deep.equal({
        enableHttpsForDev: true,
        enableAccessLogging: true,
        enableStatusService: true,
        signingService: 'signer:5001',
        statusService: 'status:5002',
        port: 5000
      })
    })
  })

  it('returns built-in and environment tenant tokens and null for unknown tenants', () => {
    expect(getTenantToken('test')).to.equal('UNPROTECTED')
    expect(getTenantToken('protected_test')).to.equal(process.env.TENANT_TOKEN_PROTECTED_TEST)
    expect(getTenantToken('tenant-that-does-not-exist')).to.equal(null)
  })
})
