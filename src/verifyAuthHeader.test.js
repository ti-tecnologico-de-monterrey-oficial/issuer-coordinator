import { expect } from 'vitest'
import verifyAuthHeader from './verifyAuthHeader.js'

describe('verifyAuthHeader', () => {
  it('allows an unprotected tenant without an authorization header', async () => {
    expect(await verifyAuthHeader(undefined, 'un_protected_test')).to.equal(true)
  })

  it('allows a protected tenant with its bearer token', async () => {
    expect(await verifyAuthHeader('Bearer jds', 'protected_test')).to.equal(true)
  })

  it('rejects a tenant that is not configured', async () => {
    try {
      await verifyAuthHeader('Bearer token', 'missing_tenant')
      expect.fail('expected tenant validation to fail')
    } catch (error) {
      expect(error).to.include({ code: 404, message: 'Tenant does not exist.' })
    }
  })

  it('rejects a missing authorization header for a protected tenant', async () => {
    try {
      await verifyAuthHeader(undefined, 'protected_test')
      expect.fail('expected authorization validation to fail')
    } catch (error) {
      expect(error).to.include({ code: 401, message: 'No authorization header was provided.' })
    }
  })

  it('rejects a non-Bearer authorization scheme', async () => {
    try {
      await verifyAuthHeader('Basic jds', 'protected_test')
      expect.fail('expected scheme validation to fail')
    } catch (error) {
      expect(error).to.include({ code: 401, message: 'Access header must be of type Bearer.' })
    }
  })

  it('rejects a token that does not match the tenant', async () => {
    try {
      await verifyAuthHeader('Bearer incorrect', 'protected_test')
      expect.fail('expected token validation to fail')
    } catch (error) {
      expect(error).to.include({ code: 403 })
    }
  })
})
