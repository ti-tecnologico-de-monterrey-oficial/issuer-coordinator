import { expect } from 'vitest'
import sanitizeForLog from './sanitizeForLog.js'

describe('sanitizeForLog', () => {
  it('replaces line breaks so a value cannot forge a log entry', () => {
    expect(sanitizeForLog('/ruta\r\n{"level":"info"}\nfalso')).to.equal('/ruta {"level":"info"} falso')
  })

  it('converts non-string values to text', () => {
    expect(sanitizeForLog(undefined)).to.equal('undefined')
  })
})
