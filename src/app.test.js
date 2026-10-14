import nock from 'nock'
import { expect } from 'chai'
import request from 'supertest'
import { getUnsignedVC } from './test-fixtures/vc.js'
import unprotectedNock from './test-fixtures/nocks/unprotected_status_signing.js'
import protectedNock from './test-fixtures/nocks/protected_status_signing.js'
import unprotectedStatusUpdateNock from './test-fixtures/nocks/unprotected_status_update.js'
import unknownStatusIdNock from './test-fixtures/nocks/unknown_status_id_nock.js'
import protectedStatusUpdateNock from './test-fixtures/nocks/protected_status_update.js'
import unknownStatusListNock from './test-fixtures/nocks/unknown_status_list_nock.js'
import statusListNock from './test-fixtures/nocks/status_list_nock.js'
import didWebGeneratorNock from './test-fixtures/nocks/did-web-generator.js'
import didKeyGeneratorNock from './test-fixtures/nocks/did-key-generator.js'
import { resetConfig } from './config.js'

import { build } from './app.js'

let testTenantToken
let testTenantToken2

let statusUpdateBody
let app

describe('api', () => {
  before(async () => {
    testTenantToken = process.env.TENANT_TOKEN_PROTECTED_TEST
    testTenantToken2 = process.env.TENANT_TOKEN_PROTECTED_TEST_2
    statusUpdateBody = {
      credentialId: 'urn:uuid:951b475e-b795-43bc-ba8f-a2d01efd2eb1',
      credentialStatus: [{ type: 'BitstringStatusListCredential', status: 'revoked' }]
    }
  })

  after(() => {
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
    it('GET / => hello', done => {
      nock('http://localhost:4006').get('/').reply(200, 'signing-service server status: ok.')
      nock('http://localhost:4008').get('/').reply(200, 'status-service server status: ok.')

      request(app)
        .get('/')
        .expect(200)
        .expect('Content-Type', /json/)
        .expect(/{"message":"issuer-coordinator, status-service, and signing-service all ok."}/, done)
    })
  })

  describe('GET /unknown', () => {
    it('unknown endpoint returns 404', done => {
      request(app)
        .get('/unknown')
        .expect(404, done)
    }, 10000)
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
    it('returns 422 if no body', done => {
      request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .expect('Content-Type', /json/)
        .expect(422, done)
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

    it('returns 401 if tenant token is missing from auth header', done => {
      request(app)
        .post('/instance/protected_test/credentials/issue')
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(401, done)
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

    it('returns 403 if token is not valid', done => {
      request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', 'Bearer badToken')
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(403, done)
    })

    it('returns 403 when trying to use token for a different tenant', done => {
      request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `Bearer ${testTenantToken2}`)
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(403, done)
    })

    it('returns 401 if token is not marked as Bearer', done => {
      request(app)
        .post('/instance/protected_test/credentials/issue')
        .set('Authorization', `${testTenantToken}`)
        .send(getUnsignedVC())
        .expect('Content-Type', /json/)
        .expect(401, done)
    })

    it('returns 404 if no seed for tenant name', done => {
      request(app)
        .post('/instance/wrongTenantName/credentials/issue')
        .set('Authorization', `${testTenantToken}`)
        .send(getUnsignedVC())
        .expect(404, done)
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
    it('returns 400 if no body', done => {
      request(app)
        .post('/instance/un_protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken}`)
        .expect('Content-Type', /json/)
        .expect(400, done)
    })

    it('returns 401 if tenant token is missing from auth header', done => {
      request(app)
        .post('/instance/protected_test/credentials/status')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(401, done)
    })

    it('update unprotected status when token not set for tenant in config', done => {
      unprotectedStatusUpdateNock()
      request(app)
        .post('/instance/un_protected_test/credentials/status')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(200, done)
    })

    it('returns 403 if token is not valid', done => {
      request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', 'Bearer ThisIsABadToken')
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(403, done)
    })

    it('returns 401 if token is not marked as Bearer', done => {
      request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `${testTenantToken}`)
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(401, done)
    })

    it('returns 404 if no seed for tenant name', done => {
      request(app)
        .post('/instance/wrongTenantName/credentials/status')
        .set('Authorization', `${testTenantToken}`)
        .send(statusUpdateBody)
        .expect(404, done)
        .expect('Content-Type', /json/)
    })

    it('returns 403 when trying to use token for a different tenant', done => {
      request(app)
        .post('/instance/protected_test/credentials/status')
        .set('Authorization', `Bearer ${testTenantToken2}`)
        .send(statusUpdateBody)
        .expect('Content-Type', /json/)
        .expect(403, done)
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
    it('returns 404 for unknown status credential id', async () => {
      unknownStatusListNock()
      const response = await request(app)
        .get('/status/9898u')
      expect(response.header['content-type']).to.have.string('json')
      expect(response.status).to.equal(404)
    })

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

    it('forwards non-404 status service errors to the error handler', async () => {
      nock('http://localhost:4008').get('/service-error').reply(503, { message: 'maintenance' })

      const response = await request(app).get('/status/service-error')

      expect(response.status).to.equal(500)
      expect(response.body.serviceResponseStatus).to.equal(503)
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

    it('rejects status list requests with 405 when status service is disabled', async () => {
      const response = await request(app).get('/status/list-id')

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

  describe('/did-web-generator', () => {
    it('returns a new did:web', async () => {
      didWebGeneratorNock()
      await request(app)
        .post('/did-web-generator')
        .send({
          url: 'https://raw.githubusercontent.com/jchartrand/didWebTest/main'
        })
        .expect('Content-Type', /json/)
        .expect((res) => {
          // eslint-disable-next-line
          expect(res.body.seed).to.exist
          expect(res.body.didDocument.id).to.eql(
            'did:web:raw.githubusercontent.com:jchartrand:didWebTest:main'
          )
          expect(res.body.did).to.eql(
            'did:web:raw.githubusercontent.com:jchartrand:didWebTest:main'
          )
        })
        .expect(200)
    })
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
