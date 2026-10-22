import nock from 'nock'
import { expect } from 'vitest'
import request from 'supertest'
import { afterAll, beforeAll } from 'vitest'
import { getUnsignedVC } from './test-fixtures/vc.js'
import unprotectedNock from './test-fixtures/nocks/unprotected_status_signing.js'
import protectedNock from './test-fixtures/nocks/protected_status_signing.js'
import unprotectedStatusUpdateNock from './test-fixtures/nocks/unprotected_status_update.js'
import unknownStatusIdNock from './test-fixtures/nocks/unknown_status_id_nock.js'
import protectedStatusUpdateNock from './test-fixtures/nocks/protected_status_update.js'
import statusListNock from './test-fixtures/nocks/status_list_nock.js'
import unknownStatusListNock from './test-fixtures/nocks/unknown_status_list_nock.js'
import didKeyGeneratorNock from './test-fixtures/nocks/did-key-generator.js'
import { resetConfig } from './config.js'

import { build } from './app.js'

let testTenantToken
let testTenantToken2

let statusUpdateBody
let app

describe('api', () => {
  beforeAll(async () => {
    testTenantToken = process.env.TENANT_TOKEN_PROTECTED_TEST
    testTenantToken2 = process.env.TENANT_TOKEN_PROTECTED_TEST_2
    statusUpdateBody = {
      credentialId: 'urn:uuid:951b475e-b795-43bc-ba8f-a2d01efd2eb1',
      credentialStatus: [{ type: 'BitstringStatusListCredential', status: 'revoked' }]
    }
  })

  afterAll(() => {
  })

  beforeEach(async () => {
    app = await build()
    if (!nock.isActive()) nock.activate()
  })

  afterEach(async () => {
    nock.cleanAll()
    nock.restore()
  })

  describe('GET /', () => {
    it('GET / => hello', async () => {
      nock('http://localhost:4006').get('/').reply(200, 'signing-service server status: ok.')
      nock('http://localhost:4008').get('/').reply(200, 'status-service server status: ok.')

      await request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(/{"message":"issuer-coordinator, status-service, and signing-service all ok."}/)
    })

    it('reports 500 when the status service is down', async () => {
      nock('http://localhost:4008').get('/').replyWithError('connect ECONNREFUSED')

      const response = await request(app).get('/')

      expect(response.status).to.equal(500)
      expect(response.body.message).to.equal('status service is NOT running.')
    })

    it('reports 500 when the signing service is down', async () => {
      nock('http://localhost:4008').get('/').reply(200, 'status-service server status: ok.')
      nock('http://localhost:4006').get('/').replyWithError('connect ECONNREFUSED')

      const response = await request(app).get('/')

      expect(response.status).to.equal(500)
      expect(response.body.message).to.equal('signing service is NOT running.')
    })
  })

  describe('signing service proxies when the signer is down', () => {
    it('GET /seedgen forwards the failure to the error handler', async () => {
      nock('http://localhost:4006').get('/seedgen').replyWithError('connect ECONNREFUSED')

      const response = await request(app).get('/seedgen')

      expect(response.status).to.equal(500)
      expect(response.body.message).to.have.string("didn't respond")
    })

    it('GET /did-key-generator forwards the failure to the error handler', async () => {
      nock('http://localhost:4006').get('/did-key-generator').reply(503, { message: 'unavailable' })

      const response = await request(app).get('/did-key-generator')

      expect(response.status).to.equal(500)
      expect(response.body.serviceResponseStatus).to.equal(503)
    })
  })

  describe('GET /unknown', () => {
    it('unknown endpoint returns 404', async () => {
      await request(app)
        .get('/unknown')
        .expect(404)
    })
  })

  describe('GET /seedgen', () => {
    it('forwards seed generation requests to the signing service', async () => {
      nock('http://localhost:4006').get('/seedgen').reply(200, { seed: 'generated-seed' })

      const response = await request(app).get('/seedgen')

      expect(response.status).to.equal(200)
      expect(response.body).to.deep.equal({ seed: 'generated-seed' })
    })
  })

  describe('POST /instance/:instanceId/credentials/issue', () => {
    it('returns 422 if no body', async () => {
      const response = await request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .expect('Content-Type', /json/)
        .expect(422)

      expect(response.body.message).to.equal('A valid verifiable credential must be provided')
    })

    it('returns 422 when credential fields have invalid shapes', async () => {
      const validCredential = getUnsignedVC()
      const invalidCredentials = [
        { ...validCredential, '@context': [] },
        { ...validCredential, '@context': 'not-an-array' },
        { ...validCredential, '@context': [42] },
        { ...validCredential, type: [] },
        { ...validCredential, type: ['VerifiableCredential', 42] },
        { ...validCredential, issuer: [] },
        { ...validCredential, credentialSubject: [] }
      ]

      for (const credential of invalidCredentials) {
        const response = await request(app)
          .post('/instance/un_protected_test/credentials/issue')
          .send(credential)
        expect(response.status).to.equal(422)
      }
    })

    it('accepts inline JSON-LD contexts next to context URLs', async () => {
      const inlineContext = { '@version': 1.1, tec: 'https://tec.mx/credentials#' }
      const credential = getUnsignedVC()
      credential['@context'] = [...credential['@context'], inlineContext]
      nock('http://localhost:4008')
        .post('/credentials/status/allocate')
        .reply(200, (uri, body) => body)
      nock('http://localhost:4006')
        .post('/instance/un_protected_test/credentials/sign')
        .reply(200, (uri, body) => ({ ...body, proof: { type: 'Ed25519Signature2020' } }))

      const response = await request(app)
        .post('/instance/un_protected_test/credentials/issue')
        .send(credential)

      expect(response.status).to.equal(201)
      expect(response.body['@context']).to.deep.include(inlineContext)
    })

    it('returns 422 when a context item is null', async () => {
      const credential = getUnsignedVC()
      credential['@context'] = [...credential['@context'], null]

      const response = await request(app)
        .post('/instance/un_protected_test/credentials/issue')
        .send(credential)

      expect(response.status).to.equal(422)
    })

    it('returns 401 if tenant token is missing from auth header', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/issue')
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(401)
    })

    it('issues credential for unprotected tenant', async () => {
      unprotectedNock()

      const response = await request(app)
        .post('/instance/un_protected_test/credentials/issue')
        .send(getUnsignedVC())

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(201)
      expect(Boolean(response.body.proof)).to.equal(true)
    })

    it('returns 403 if token is not valid', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', 'Bearer badToken')
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(403)
    })

    it('returns 403 when trying to use token for a different tenant', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `Bearer ${testTenantToken2}`)
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(403)
    })

    it('returns 401 if token is not marked as Bearer', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `${testTenantToken}`)
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(401)
    })

    it('returns 404 if no seed for tenant name', async () => {
      await request(app)
        .post('/instance/wrongTenantName/credentials/issue')
        .set('Authorization', `${testTenantToken}`)
        .send(getUnsignedVC())
        .expect(404)
        .expect('Content-Type', /json/)
    })

    it('returns signed vc for protected tenant', async () => {
      protectedNock()
      const sentCred = getUnsignedVC()
      const response = await request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .send(sentCred)

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(201)

      const returnedCred = JSON.parse(JSON.stringify(response.body))
      // this proof value comes from the nock:
      expect(returnedCred.proof.proofValue).to.equal('z5QQ12zr5JvEsKvbnEN2EYZ6punR6Pa5wMJzywGJ2dCh6SSA5oQb9hBiGADsNTbs57bopArwdBHE9kEVemMxcu1Fq')
    })
  })

  describe('POST /instance/:instanceId/credentials/status', () => {
    it('returns 400 if no body', async () => {
      await request(app)
        .post('/instance/un_protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .expect('Content-Type', /json/)
        .expect(400)
    })

    it('returns 401 if tenant token is missing from auth header', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/status')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(401)
    })

    it('update unprotected status when token not set for tenant in config', async () => {
      unprotectedStatusUpdateNock()
      await request(app)
        .post('/instance/un_protected_test/credentials/status')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(200)
    })

    it('returns 403 if token is not valid', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', 'Bearer ThisIsABadToken')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(403)
    })

    it('returns 401 if token is not marked as Bearer', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `${testTenantToken}`)
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(401)
    })

    it('returns 404 if no seed for tenant name', async () => {
      await request(app)
        .post('/instance/wrongTenantName/credentials/status')
        .set('Authorization', `${testTenantToken}`)
        .send(statusUpdateBody)
        .expect(404)
        .expect('Content-Type', /json/)
    })

    it('returns 403 when trying to use token for a different tenant', async () => {
      await request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken2}`)
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(403)
    })

    it('returns 404 for unknown cred id', async () => {
      unknownStatusIdNock()
      const statusUpdateBodyWithUnknownId = JSON.parse(JSON.stringify(statusUpdateBody))
      statusUpdateBodyWithUnknownId.credentialId = 'kj09ij'
      const response = await request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .send(statusUpdateBodyWithUnknownId)

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(404)
    })

    it('calls status manager for protected tenant', async () => {
      protectedStatusUpdateNock()
      const response = await request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .send(statusUpdateBody)

      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(200)
    })
  })

  describe('GET /status/:statusCredentialId', () => {
    it('returns credential status list from status service', async () => {
      statusListNock()
      const response = await request(app)
        .get('/status/slAwJe6GGR6mBojlGW5U')
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(200)
      const returnedList = JSON.parse(JSON.stringify(response.body))
      // this proof value comes from the nock:
      expect(returnedList.proof.proofValue).to.equal('z4y3GawinQg1aCqbYqZM8dmDpbmtFa3kE6tFefdXvLi5iby25dvmVwLNZrfcFPyhpshrhCWB76pdSZchVve3K1Znr')
    })

    it('returns 404 without calling the status service when the id has unsafe characters', async () => {
      const response = await request(app).get('/status/..%2Fcredentials%2Fstatus')

      expect(response.status).to.equal(404)
      expect(response.body.message).to.equal('No status credential found for that id.')
    })

    it('returns 404 when the status service does not know the id', async () => {
      unknownStatusListNock()

      const response = await request(app).get('/status/9898u')

      expect(response.status).to.equal(404)
      expect(response.body.message).to.equal('No status credential found for that id.')
    })

    it('returns 500 when the status service does not respond', async () => {
      nock('http://localhost:4008').get('/slAwJe6GGR6mBojlGW5U').replyWithError('connect ECONNREFUSED')

      const response = await request(app).get('/status/slAwJe6GGR6mBojlGW5U')

      expect(response.status).to.equal(500)
      expect(response.body.message).to.have.string("didn't respond")
    })
  })

  describe('when status service is disabled', () => {
    let previousStatusSetting

    beforeEach(async () => {
      previousStatusSetting = process.env.ENABLE_STATUS_SERVICE
      process.env.ENABLE_STATUS_SERVICE = 'false'
      resetConfig()
      app = await build()
    })

    afterEach(() => {
      if (previousStatusSetting === undefined) delete process.env.ENABLE_STATUS_SERVICE
      else process.env.ENABLE_STATUS_SERVICE = previousStatusSetting
      resetConfig()
    })

    it('reports a healthy coordinator and signer without checking the status service', async () => {
      nock('http://localhost:4006').get('/').reply(200, 'signer ok')

      const response = await request(app).get('/')

      expect(response.status).to.equal(200)
      expect(response.body.message).to.equal('issuer issuer-coordinator and signing-service both ok. status-service is disabled.')
    })

    it('rejects status updates with 405', async () => {
      const response = await request(app)
        .post('/instance/un_protected_test/credentials/status')
        .send(statusUpdateBody)

      expect(response.status).to.equal(405)
    })

    it('rejects status list lookups with 405', async () => {
      const response = await request(app).get('/status/slAwJe6GGR6mBojlGW5U')

      expect(response.status).to.equal(405)
      expect(response.body.message).to.equal('The status service has not been enabled.')
    })

    it('issues valid credentials directly through the signer without allocating status', async () => {
      const signingServiceCall = nock('http://localhost:4006')
        .post('/instance/un_protected_test/credentials/sign')
        .reply(200, { proof: { type: 'Ed25519Signature2020' } })

      const response = await request(app)
        .post('/instance/un_protected_test/credentials/issue')
        .send({ credential: getUnsignedVC() })

      expect(response.status).to.equal(201)
      expect(response.body.proof.type).to.equal('Ed25519Signature2020')
      expect(signingServiceCall.isDone()).to.equal(true)
    })
  })

  it('does not proxy /did-web-generator; it is only available on the signing service', async () => {
    const response = await request(app)
      .post('/did-web-generator')
      .send({ url: 'https://example.edu' })

    expect(response.status).to.equal(404)
  })

  describe('/did-key-generator', () => {
    it('returns a new did:key', async () => {
      didKeyGeneratorNock()
      await request(app)
        .get('/did-key-generator')
        .expect('Content-Type', /json/)
        .expect((res) => {
          // eslint-disable-next-line
          expect(res.body.seed).to.exist
          expect(res.body.didDocument.id).to.contain('did:key')
          expect(res.body.did).to.contain('did:key')
        })
        .expect(200)
    })
  })
})
