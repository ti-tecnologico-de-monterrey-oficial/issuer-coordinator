import { expect, vi } from 'vitest'
import logger from '../utils/logger.js'
import invalidPathHandler from './invalidPathHandler.js'

describe('invalidPathHandler', () => {
  afterEach(() => vi.restoreAllMocks())

  it('responds with 404 and logs the unknown request', () => {
    vi.spyOn(logger, 'error').mockImplementation(() => {})
    const response = { status: vi.fn(() => response), send: vi.fn(), statusMessage: 'Not Found' }
    const request = { originalUrl: '/missing', method: 'GET', ip: '127.0.0.1' }

    invalidPathHandler(request, response)

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.send).toHaveBeenCalledWith('Not Found')
    expect(logger.error).toHaveBeenCalledWith('404 || Not Found - /missing - GET - 127.0.0.1')
  })
})
