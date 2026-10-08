import { expect } from 'chai'
import verifyAuthHeader from './verifyAuthHeader.js'

describe('verifyAuthHeader', () => {
  let testTenantToken
  let testTenantToken2

  before(() => {
    testTenantToken = process.env.TENANT_TOKEN_PROTECTED_TEST
    testTenantToken2 = process.env.TENANT_TOKEN_PROTECTED_TEST_2
  })

  it('throws a 404 if the tenant does not exist', async () => {
    try {
      await verifyAuthHeader('Bearer anything', 'not-a-real-tenant')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(404)
      expect(error.message).to.equal('Tenant does not exist.')
    }
  })

  it('returns true for an unprotected tenant even with no auth header', async () => {
    const result = await verifyAuthHeader(undefined, 'un_protected_test')
    expect(result).to.equal(true)
  })

  it('returns true for an unprotected tenant regardless of header content', async () => {
    const result = await verifyAuthHeader('Bearer whatever', 'un_protected_test')
    expect(result).to.equal(true)
  })

  it('throws a 401 if no authorization header is provided for a protected tenant', async () => {
    try {
      await verifyAuthHeader(undefined, 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(401)
      expect(error.message).to.equal('No authorization header was provided.')
    }
  })

  it('throws a 401 if the header is not an empty string', async () => {
    try {
      await verifyAuthHeader('', 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(401)
    }
  })

  it('throws a 401 if the scheme is not Bearer', async () => {
    try {
      await verifyAuthHeader(`Basic ${testTenantToken}`, 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(401)
      expect(error.message).to.equal('Access header must be of type Bearer.')
    }
  })

  it('throws a 401 if the token is not prefixed with a scheme at all', async () => {
    try {
      await verifyAuthHeader(`${testTenantToken}`, 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(401)
    }
  })

  it('throws a 403 if the token does not match the tenant token', async () => {
    try {
      await verifyAuthHeader('Bearer badToken', 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(403)
      expect(error.message).to.equal('You provided a token that is not authorized or may have changed.')
    }
  })

  it('throws a 403 when using a token that belongs to a different tenant', async () => {
    try {
      await verifyAuthHeader(`Bearer ${testTenantToken2}`, 'protected_test')
      throw new Error('should not reach here')
    } catch (error) {
      expect(error.code).to.equal(403)
    }
  })

  it('returns true when the correct bearer token is provided for the matching tenant', async () => {
    const result = await verifyAuthHeader(`Bearer ${testTenantToken}`, 'protected_test')
    expect(result).to.equal(true)
  })
})
