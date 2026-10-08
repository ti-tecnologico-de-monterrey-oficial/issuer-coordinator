import { expect } from 'chai'
import sinon from 'sinon'
import errorHandler from './errorHandler.js'

describe('errorHandler middleware', () => {
  let req, res, next

  beforeEach(() => {
    req = {}
    res = {
      header: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
      json: sinon.stub().returnsThis()
    }
    next = sinon.stub()
  })

  it('sets Content-Type header to application/json', () => {
    const error = { code: 500, message: 'boom' }
    errorHandler(error, req, res, next)
    expect(res.header.calledWith('Content-Type', 'application/json')).to.equal(true)
  })

  it('responds with the error code and the error itself for a non-axios error', () => {
    const error = { code: 422, message: 'A valid verifiable credential must be provided' }
    errorHandler(error, req, res, next)
    expect(res.status.calledWith(422)).to.equal(true)
    expect(res.json.calledWith(error)).to.equal(true)
  })

  it('handles an axios error with a response from the downstream service', () => {
    const error = {
      isAxiosError: true,
      response: {
        data: { some: 'data' },
        status: 404,
        headers: { 'content-type': 'application/json' }
      }
    }
    errorHandler(error, req, res, next)
    const jsonArg = res.json.firstCall.args[0]
    expect(jsonArg.code).to.equal(500)
    expect(jsonArg.message).to.equal('One of the internal microservices returned an error')
    expect(jsonArg.serviceResponseError).to.eql({ some: 'data' })
    expect(jsonArg.serviceResponseStatus).to.equal(404)
    expect(res.status.calledWith(500)).to.equal(true)
  })

  it('handles an axios error with a request but no response (service did not respond)', () => {
    const error = {
      isAxiosError: true,
      request: {}
    }
    errorHandler(error, req, res, next)
    const jsonArg = res.json.firstCall.args[0]
    expect(jsonArg.code).to.equal(500)
    expect(jsonArg.message).to.equal("One of the internal microservices didn't respond. Hit / to check heartbeats.")
  })

  it('handles an axios error with neither request nor response (setup error)', () => {
    const error = {
      isAxiosError: true,
      message: 'something went wrong setting up the request'
    }
    errorHandler(error, req, res, next)
    const jsonArg = res.json.firstCall.args[0]
    expect(jsonArg.code).to.equal(500)
    expect(jsonArg.message).to.include('something went wrong setting up the request')
    expect(jsonArg.error).to.equal(error)
  })
})
