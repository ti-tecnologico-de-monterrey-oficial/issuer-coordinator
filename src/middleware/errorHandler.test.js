import { expect } from 'chai'
import { AxiosError } from 'axios'
import sinon from 'sinon'
import errorHandler from './errorHandler.js'

describe('errorHandler', () => {
  let response

  beforeEach(() => {
    response = {
      header: sinon.stub(),
      status: sinon.stub(),
      json: sinon.stub()
    }
    response.header.returns(response)
    response.status.returns(response)
  })

  it('serializes downstream service response errors', () => {
    const error = new AxiosError('bad response', 'ERR_BAD_RESPONSE', {}, null, {
      status: 502,
      data: { reason: 'unavailable' },
      headers: { 'content-type': 'application/json' }
    })

    errorHandler(error, {}, response)

    expect(response.status.calledWith(500)).to.equal(true)
    expect(response.json.firstCall.args[0]).to.include({
      code: 500,
      serviceResponseError: error.response.data,
      serviceResponseStatus: 502,
      serviceResponseHeaders: error.response.headers
    })
  })

  it('reports a downstream service request that did not receive a response', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED', {}, {})
    errorHandler(error, {}, response)
    expect(response.json.firstCall.args[0]).to.include({
      code: 500,
      message: "One of the internal microservices didn't respond. Hit / to check heartbeats."
    })
  })

  it('reports errors that occur before a request is formulated', () => {
    const error = new AxiosError('invalid endpoint')
    errorHandler(error, {}, response)
    expect(response.json.firstCall.args[0]).to.include({
      code: 500,
      message: 'Likely an error when setting up the request that prevented the request from being formulated: invalid endpoint',
      error
    })
  })

  it('passes application errors through unchanged', () => {
    const error = { code: 422, message: 'Invalid credential' }
    errorHandler(error, {}, response)
    expect(response.header.calledWith('Content-Type', 'application/json')).to.equal(true)
    expect(response.status.calledWith(422)).to.equal(true)
    expect(response.json.calledWith(error)).to.equal(true)
  })
})
