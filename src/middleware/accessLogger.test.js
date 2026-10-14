import { expect } from 'chai'
import express from 'express'
import request from 'supertest'
import sinon from 'sinon'
import logger from '../utils/logger.js'
import { resetConfig } from '../config.js'
import accessLogger from './accessLogger.js'

describe('accessLogger', () => {
  it('writes Morgan access logs when access logging is enabled', async () => {
    const previousSetting = process.env.ENABLE_ACCESS_LOGGING
    process.env.ENABLE_ACCESS_LOGGING = 'true'
    resetConfig()
    const logStub = sinon.stub(logger, 'http')

    try {
      const app = express()
      app.use(accessLogger())
      app.get('/', (req, res) => res.send('ok'))

      const response = await request(app).get('/').expect(200)

      expect(response.text).to.equal('ok')
      expect(logStub.calledOnce).to.equal(true)
      expect(logStub.firstCall.args[0]).to.contain('GET / 200')
    } finally {
      sinon.restore()
      if (previousSetting === undefined) delete process.env.ENABLE_ACCESS_LOGGING
      else process.env.ENABLE_ACCESS_LOGGING = previousSetting
      resetConfig()
    }
  })
})
