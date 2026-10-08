import { expect } from 'chai'
import accessLogger from './accessLogger.js'
import { resetConfig } from '../config.js'

describe('accessLogger middleware', () => {
  afterEach(() => {
    delete process.env.ENABLE_ACCESS_LOGGING
    resetConfig()
  })

  it('returns a middleware function (morgan instance)', () => {
    const middleware = accessLogger()
    expect(middleware).to.be.a('function')
    // morgan middleware functions take (req, res, next)
    expect(middleware.length).to.equal(3)
  })

  it('builds middleware regardless of ENABLE_ACCESS_LOGGING being true or false', () => {
    process.env.ENABLE_ACCESS_LOGGING = 'true'
    resetConfig()
    expect(accessLogger()).to.be.a('function')

    process.env.ENABLE_ACCESS_LOGGING = 'false'
    resetConfig()
    expect(accessLogger()).to.be.a('function')
  })
})
