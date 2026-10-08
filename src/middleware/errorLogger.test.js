import { expect } from 'chai'
import sinon from 'sinon'
import errorLogger from './errorLogger.js'
import logger from '../utils/logger.js'

describe('errorLogger middleware', () => {
  let req, res, next, loggerErrorStub

  beforeEach(() => {
    req = { originalUrl: '/some/path', method: 'POST', ip: '127.0.0.1' }
    res = {}
    next = sinon.stub()
    loggerErrorStub = sinon.stub(logger, 'error')
  })

  afterEach(() => {
    loggerErrorStub.restore()
  })

  it('calls next with the original error so it can continue down the chain', () => {
    const error = { message: 'boom' }
    errorLogger(error, req, res, next)
    expect(next.calledOnceWith(error)).to.equal(true)
  })

  it('logs a non-axios error using its message', () => {
    const error = { message: 'a plain error' }
    errorLogger(error, req, res, next)
    const [logMessage, meta] = loggerErrorStub.firstCall.args
    expect(logMessage).to.include('/some/path')
    expect(logMessage).to.include('POST')
    expect(logMessage).to.include('127.0.0.1')
    expect(meta.message).to.equal('a plain error')
  })

  it('falls back to a generic message when the error has no message', () => {
    const error = {}
    errorLogger(error, req, res, next)
    const meta = loggerErrorStub.firstCall.args[1]
    expect(meta.message).to.equal('An unknown error occurred.')
  })

  it('logs axios error details when the microservice responded with an error', () => {
    const error = {
      isAxiosError: true,
      config: { url: 'http://signing-service/sign' },
      response: {
        data: { error: 'bad request' },
        status: 400,
        headers: { 'content-type': 'application/json' }
      }
    }
    errorLogger(error, req, res, next)
    const meta = loggerErrorStub.firstCall.args[1]
    expect(meta.serviceConfig).to.equal(error.config)
    expect(meta.message).to.equal('One of the internal microservices returned an error.')
    expect(meta.serviceResponseError).to.eql({ error: 'bad request' })
    expect(meta.serviceResponseStatus).to.equal(400)
  })

  it('logs axios error details when the microservice did not respond', () => {
    const error = {
      isAxiosError: true,
      config: {},
      request: {}
    }
    errorLogger(error, req, res, next)
    const meta = loggerErrorStub.firstCall.args[1]
    expect(meta.message).to.equal("One of the internal microservices didn't respond. Hit / to check heartbeats.")
  })

  it('logs axios error details when the request could not be formulated', () => {
    const error = {
      isAxiosError: true,
      config: {},
      message: 'bad config'
    }
    errorLogger(error, req, res, next)
    const meta = loggerErrorStub.firstCall.args[1]
    expect(meta.message).to.include('bad config')
    expect(meta.error).to.equal(error)
  })
})
