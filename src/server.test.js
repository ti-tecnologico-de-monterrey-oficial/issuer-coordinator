import http from 'node:http'
import https from 'node:https'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { resetConfig } from './config.js'
import { createServer, start } from './server.js'

describe('server', () => {
  let previousPort
  let server

  beforeEach(() => {
    previousPort = process.env.PORT
    // Puerto 0: el sistema asigna uno libre y la prueba no choca con otro proceso.
    process.env.PORT = '0'
    resetConfig()
  })

  afterEach(async () => {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    server = undefined
    if (previousPort === undefined) delete process.env.PORT
    else process.env.PORT = previousPort
    resetConfig()
  })

  it('creates an http server when https for dev is disabled', () => {
    const created = createServer(() => {}, false)

    expect(created).to.be.instanceOf(http.Server)
    expect(created).not.to.be.instanceOf(https.Server)
  })

  it('creates an https server with the dev certificate when enabled', () => {
    const created = createServer(() => {}, true)

    expect(created).to.be.instanceOf(https.Server)
  })

  it('starts listening on the configured port', async () => {
    server = await start()

    expect(server.listening).to.equal(true)
    expect(server.address().port).to.be.greaterThan(0)
  })

  it('starts an https server when https for dev is enabled', async () => {
    vi.stubEnv('ENABLE_HTTPS_FOR_DEV', 'true')
    resetConfig()
    try {
      server = await start()

      expect(server).to.be.instanceOf(https.Server)
      expect(server.listening).to.equal(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
