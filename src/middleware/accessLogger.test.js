import { expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import logger from '../utils/logger.js'
import { resetConfig } from '../config.js'
import accessLogger from './accessLogger.js'

describe('accessLogger', () => {
  it('writes Morgan access logs when access logging is enabled', async () => {
    const previousSetting = process.env.ENABLE_ACCESS_LOGGING
    process.env.ENABLE_ACCESS_LOGGING = 'true'
    resetConfig()
    const logStub = vi.spyOn(logger, 'http').mockImplementation(() => {})

    try {
      const app = express()
      app.use(accessLogger())
      app.get('/', (req, res) => res.send('ok'))

      const response = await request(app).get('/').expect(200)

      expect(response.text).to.equal('ok')
      expect(logStub).toHaveBeenCalledOnce()
      expect(logStub.mock.calls[0][0]).to.contain('GET / 200')
    } finally {
      vi.restoreAllMocks()
      if (previousSetting === undefined) delete process.env.ENABLE_ACCESS_LOGGING
      else process.env.ENABLE_ACCESS_LOGGING = previousSetting
      resetConfig()
    }
  })
})
