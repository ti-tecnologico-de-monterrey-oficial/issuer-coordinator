import { expect, vi } from 'vitest'
import { AxiosError } from 'axios'
import errorHandler from './errorHandler.js'

describe('errorHandler', () => {
  let response

  beforeEach(() => {
    response = {
      header: vi.fn(() => response),
      status: vi.fn(() => response),
      json: vi.fn()
    }
  })

  it('serializes downstream service response errors', () => {
    const error = new AxiosError('bad response', 'ERR_BAD_RESPONSE', {}, null, {
      status: 502,
      data: { reason: 'unavailable' },
      headers: { 'content-type': 'application/json' }
    })

    errorHandler(error, {}, response)

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json.mock.calls[0][0]).to.include({
      code: 500,
      serviceResponseError: error.response.data,
      serviceResponseStatus: 502,
      serviceResponseHeaders: error.response.headers
    })
  })

  it('reports a downstream service request that did not receive a response', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED', {}, {})
    errorHandler(error, {}, response)
    expect(response.json.mock.calls[0][0]).to.include({
      code: 500,
      message: "One of the internal microservices didn't respond. Hit / to check heartbeats."
    })
  })

  it('reports errors that occur before a request is formulated', () => {
    const error = new AxiosError('invalid endpoint')
    errorHandler(error, {}, response)
    expect(response.json.mock.calls[0][0]).to.include({
      code: 500,
      message: 'Likely an error when setting up the request that prevented the request from being formulated: invalid endpoint',
      error
    })
  })

  it('passes application errors through unchanged', () => {
    const error = { code: 422, message: 'Invalid credential' }
    errorHandler(error, {}, response)
    expect(response.header).toHaveBeenCalledWith('Content-Type', 'application/json')
    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith(error)
  })

  it('responds with 500 when the error has no valid HTTP code', () => {
    const error = new TypeError('boom')
    errorHandler(error, {}, response)
    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({ message: 'boom' })
  })

  it('keeps the message of thrown Error instances', () => {
    const error = Object.assign(new Error('A valid verifiable credential must be provided'), { code: 422 })
    errorHandler(error, {}, response)
    expect(response.status).toHaveBeenCalledWith(422)
    expect(response.json).toHaveBeenCalledWith({ code: 422, message: 'A valid verifiable credential must be provided' })
  })
})
