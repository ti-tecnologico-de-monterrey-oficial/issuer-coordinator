import { expect } from 'chai'
import sinon from 'sinon'
import logger from '../utils/logger.js'
import invalidPathHandler from './invalidPathHandler.js'

describe('invalidPathHandler', () => {
  afterEach(() => sinon.restore())

  it('responds with 404 and logs the unknown request', () => {
    sinon.stub(logger, 'error')
    const response = { status: sinon.stub(), send: sinon.stub(), statusMessage: 'Not Found' }
    response.status.returns(response)
    const request = { originalUrl: '/missing', method: 'GET', ip: '127.0.0.1' }

    invalidPathHandler(request, response)

    expect(response.status.calledWith(404)).to.equal(true)
    expect(response.send.calledWith('Not Found')).to.equal(true)
    expect(logger.error.calledWith('404 || Not Found - /missing - GET - 127.0.0.1')).to.equal(true)
  })
})
