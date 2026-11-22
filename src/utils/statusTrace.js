/** Diagnóstico optativo; nunca se registran documentos completos ni secretos. */
import { createHash, randomUUID } from 'node:crypto';

export const traceEnabled = () => process.env.STATUS_TRACE_ENABLED === 'true';

export function operationId(req) {
  const incoming = req.headers['x-operation-id'];
  return typeof incoming === 'string' && /^[A-Za-z0-9._-]{1,96}$/.test(incoming)
    ? incoming : randomUUID();
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
  }
  return value;
}

export function fingerprint(value) {
  if (value === undefined || value === null) return null;
  return createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex');
}

export function credentialTrace(credential) {
  const entry = Array.isArray(credential?.credentialStatus)
    ? credential.credentialStatus[0] : credential?.credentialStatus;
  const listUrl = entry?.statusListCredential;
  return {
    credentialId: credential?.id ?? null,
    documentSha256: fingerprint(credential),
    statusListId: typeof listUrl === 'string' ? listUrl.split('#')[0].split('/').pop() : null,
    statusListIndex: entry?.statusListIndex ?? null,
    proofSha256: fingerprint(credential?.proof?.proofValue),
    encodedListSha256: fingerprint(credential?.credentialSubject?.encodedList)
  };
}

export function trace(phase, id, fields = {}) {
  if (!traceEnabled()) return;
  console.info(JSON.stringify({ tag: 'TEC_STATUS_TRACE', phase, operationId: id, ...fields }));
}
