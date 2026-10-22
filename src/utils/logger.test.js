import { expect } from 'chai'
import { afterEach, vi } from 'vitest'

// El nivel se calcula al importar el módulo, así que cada caso lo vuelve a
// cargar con NODE_ENV ya fijado.
async function loadLoggerWith (nodeEnv) {
  if (nodeEnv === undefined) vi.stubEnv('NODE_ENV', undefined)
  else vi.stubEnv('NODE_ENV', nodeEnv)
  vi.resetModules()
  const { default: logger } = await import('./logger.js')
  return logger
}

describe('logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('logs debug and above in development', async () => {
    expect((await loadLoggerWith('development')).level).to.equal('debug')
  })

  it('treats a missing NODE_ENV as development', async () => {
    expect((await loadLoggerWith(undefined)).level).to.equal('debug')
  })

  it('only logs warnings and errors outside development', async () => {
    expect((await loadLoggerWith('production')).level).to.equal('warn')
  })
})
