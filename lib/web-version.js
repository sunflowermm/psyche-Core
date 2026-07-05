import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../www/psyche/version.json')

export function getWebVersion() {
  try {
    return JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).version || '1.0.0'
  } catch {
    return '1.0.0'
  }
}
