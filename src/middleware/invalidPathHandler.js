import logger from '../utils/logger.js'
import sanitizeForLog from '../utils/sanitizeForLog.js'

// Fallback middleware for undefined paths
const invalidPathHandler = (req, res, next) => {
  res.status(404).send('Not Found')
  logger.error(sanitizeForLog(`404 || ${res.statusMessage} - ${req.originalUrl} - ${req.method} - ${req.ip}`))
}

export default invalidPathHandler
