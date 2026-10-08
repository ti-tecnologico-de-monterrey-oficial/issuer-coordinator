import { expect } from 'chai'
import { getConfig, resetConfig, initializeConfig, getTenantToken } from './config.js'

describe('config', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    resetConfig()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    resetConfig()
  })

  describe('getConfig', () => {
    it('returns default values when no env vars are set', () => {
      delete process.env.ENABLE_HTTPS_FOR_DEV
      delete process.env.ENABLE_ACCESS_LOGGING
      delete process.env.ENABLE_STATUS_SERVICE
      delete process.env.SIGNING_SERVICE
      delete process.env.STATUS_SERVICE
      delete process.env.PORT

      const config = getConfig()

      expect(config.enableHttpsForDev).to.equal(false)
      expect(config.enableAccessLogging).to.equal(false)
      expect(config.enableStatusService).to.equal(false)
      expect(config.signingService).to.equal('SIGNER:4006')
      expect(config.statusService).to.equal('STATUS:4008')
      expect(config.port).to.equal(4005)
    })

    it('parses boolean env vars case-insensitively', () => {
      process.env.ENABLE_HTTPS_FOR_DEV = 'TRUE'
      process.env.ENABLE_ACCESS_LOGGING = 'True'
      process.env.ENABLE_STATUS_SERVICE = 'true'

      const config = getConfig()

      expect(config.enableHttpsForDev).to.equal(true)
      expect(config.enableAccessLogging).to.equal(true)
      expect(config.enableStatusService).to.equal(true)
    })

    it('treats non "true" values as false', () => {
      process.env.ENABLE_HTTPS_FOR_DEV = 'yes'
      process.env.ENABLE_ACCESS_LOGGING = '1'
      process.env.ENABLE_STATUS_SERVICE = 'false'

      const config = getConfig()

      expect(config.enableHttpsForDev).to.equal(false)
      expect(config.enableAccessLogging).to.equal(false)
      expect(config.enableStatusService).to.equal(false)
    })

    it('uses provided SIGNING_SERVICE and STATUS_SERVICE', () => {
      process.env.SIGNING_SERVICE = 'custom-signer:1234'
      process.env.STATUS_SERVICE = 'custom-status:5678'

      const config = getConfig()

      expect(config.signingService).to.equal('custom-signer:1234')
      expect(config.statusService).to.equal('custom-status:5678')
    })

    it('parses PORT as an integer when provided', () => {
      process.env.PORT = '8080'

      const config = getConfig()

      expect(config.port).to.equal(8080)
      expect(config.port).to.be.a('number')
    })

    it('caches the config so repeated calls return the same object', () => {
      const config1 = getConfig()
      const config2 = getConfig()

      expect(config1).to.equal(config2)
    })

    it('returns a frozen (immutable) config object', () => {
      const config = getConfig()
      expect(Object.isFrozen(config)).to.equal(true)
    })
  })

  describe('initializeConfig', () => {
    it('forces re-parsing of the config from current env vars', () => {
      process.env.PORT = '3000'
      initializeConfig()
      const firstConfig = getConfig()
      expect(firstConfig.port).to.equal(3000)

      process.env.PORT = '4000'
      initializeConfig()
      const secondConfig = getConfig()
      expect(secondConfig.port).to.equal(4000)
      expect(secondConfig).to.not.equal(firstConfig)
    })
  })

  describe('resetConfig', () => {
    it('clears the cached config so getConfig re-parses env vars', () => {
      process.env.PORT = '3000'
      const firstConfig = getConfig()
      expect(firstConfig.port).to.equal(3000)

      resetConfig()
      process.env.PORT = '9999'
      const secondConfig = getConfig()
      expect(secondConfig.port).to.equal(9999)
    })
  })

  describe('getTenantToken', () => {
    it('returns the default tenant token for the default tenant name', () => {
      expect(getTenantToken('test')).to.equal('UNPROTECTED')
    })

    it('returns the demo tenant token for the demo tenant name', () => {
      expect(getTenantToken('testing')).to.equal('UNPROTECTED')
    })

    it('returns the random tenant token for the random tenant name', () => {
      expect(getTenantToken('random')).to.equal('UNPROTECTED')
    })

    it('returns null for an unknown tenant name', () => {
      expect(getTenantToken('does-not-exist-tenant')).to.equal(null)
    })
  })
})
