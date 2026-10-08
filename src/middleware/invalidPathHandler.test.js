import { expect } from 'chai'
import sinon from 'sinon'
import invalidPathHandler from './invalidPathHandler.js'
import logger from '../utils/logger.js'

describe('invalidPathHandler middleware', () => {
  let req, res, next, loggerErrorStub

  beforeEach(() => {
    req = { originalUrl: '/unknown', method: 'GET', ip: '127.0.0.1' }
    res = {
      statusMessage: 'Not Found',
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis()
    }
    next = sinon.stub()
    loggerErrorStub = sinon.stub(logger, 'error')
  })

  afterEach(() => {
    loggerErrorStub.restore()
  })

  it('responds with 404', () => {
    invalidPathHandler(req, res, next)
    expect(res.status.calledWith(404)).to.equal(true)
  })

  it('sends "Not Found" as the body', () => {
    invalidPathHandler(req, res, next)
    expect(res.send.calledWith('Not Found')).to.equal(true)
  })

  it('logs the error including the request path, method and ip', () => {
    invalidPathHandler(req, res, next)
    const logMessage = loggerErrorStub.firstCall.args[0]
    expect(logMessage).to.include('/unknown')
    expect(logMessage).to.include('GET')
    expect(logMessage).to.include('127.0.0.1')
  })

  it('does not call next, since this is a terminal fallback handler', () => {
    invalidPathHandler(req, res, next)
    expect(next.called).to.equal(false)
  })
})
