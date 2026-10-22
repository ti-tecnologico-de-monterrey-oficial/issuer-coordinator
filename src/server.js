import https from 'https'
import http from 'http'
import fs from 'fs'
import { build } from './app.js'
import { getConfig, initializeConfig } from './config.js'
import logger from './utils/logger.js'

export function createServer (app, enableHttpsForDev) {
  if (!enableHttpsForDev) return http.createServer(app)
  return https.createServer(
    {
      key: fs.readFileSync('server-dev-only.key'),
      cert: fs.readFileSync('server-dev-only.cert')
    },
    app
  )
}

export async function start () {
  await initializeConfig()
  const { port, enableHttpsForDev } = getConfig()

  const app = await build()
  const server = createServer(app, enableHttpsForDev)
  const protocol = enableHttpsForDev ? 'https' : 'http'

  await new Promise(resolve => server.listen(port, resolve))
  logger.info(`Server started and running on port ${port} with ${protocol}`)
  return server
}
