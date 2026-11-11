import neostandard from 'neostandard'

export default [
  { ignores: ['coverage/', 'logs/'] },
  ...neostandard({ env: ['vitest'] })
]
