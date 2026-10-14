import { expect } from 'chai'
import { AxiosError } from 'axios'
import sinon from 'sinon'
import logger from '../utils/logger.js'
import errorLogger from './errorLogger.js'

describe('errorLogger', () => {
  let next
  const request = { originalUrl: '/credentials', method: 'POST', ip: '127.0.0.1' }

  beforeEach(() => {
    sinon.stub(logger, 'error')
    next = sinon.spy()
  })

  afterEach(() => sinon.restore())

  it('logs downstream response details and forwards the error', () => {
    const error = new AxiosError('bad response', 'ERR_BAD_RESPONSE', { url: '/sign' }, null, {
      status: 502,
      data: { reason: 'unavailable' },
      headers: { 'content-type': 'application/json' }
    })

    errorLogger(error, request, {}, next)

    expect(logger.error.calledOnce).to.equal(true)
    expect(logger.error.firstCall.args[0]).to.contain('/credentials - POST - IP: 127.0.0.1')
    expect(logger.error.firstCall.args[1]).to.include({
      serviceConfig: error.config,
      message: 'One of the internal microservices returned an error.',
      serviceResponseError: error.response.data,
      serviceResponseStatus: 502,
      serviceResponseHeaders: error.response.headers
    })
    expect(next.calledWith(error)).to.equal(true)
  })

  it('logs a downstream request that received no response', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED', {}, {})
    errorLogger(error, request, {}, next)
    expect(logger.error.firstCall.args[1].message).to.contain("didn't respond")
    expect(next.calledWith(error)).to.equal(true)
  })

  it('logs errors raised while creating a downstream request', () => {
    const error = new AxiosError('invalid endpoint')
    errorLogger(error, request, {}, next)
    expect(logger.error.firstCall.args[1]).to.include({ error })
    expect(logger.error.firstCall.args[1].message).to.contain('prevented the request from being formulated')
  })

  it('logs application errors and supplies a fallback message when needed', () => {
    const error = {}
    errorLogger(error, request, {}, next)
    expect(logger.error.firstCall.args[1].message).to.equal('An unknown error occurred.')
    expect(next.calledWith(error)).to.equal(true)
  })
})
