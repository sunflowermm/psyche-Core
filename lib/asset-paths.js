export const WEB_MOUNT = '/psyche'

export function webAsset(...parts) {
  return `${WEB_MOUNT}/assets/${parts.filter(Boolean).join('/')}`.replace(/\/+/g, '/')
}

export function safeAssetCode(code) {
  return String(code || '').replace(/[^\w-]/g, '_')
}

export function psycheGeneratedPath(engine, code) {
  return webAsset('psyche-generated', engine, `${safeAssetCode(code)}.png`)
}
