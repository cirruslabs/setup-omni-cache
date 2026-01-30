import * as core from '@actions/core'
import * as fs from 'fs'

/**
 * Read log file contents if available.
 * @param {string} logPath - Path to the log file
 * @returns {string} Log contents or empty string
 */
export function readLogs(logPath) {
  if (!logPath) return ''

  try {
    if (fs.existsSync(logPath)) {
      return fs.readFileSync(logPath, 'utf8')
    }
  } catch (error) {
    core.debug(`Could not read log file: ${error.message}`)
  }

  return ''
}

/**
 * Extract the resolved listener address from omni-cache logs.
 * @param {string} logs - Log contents
 * @returns {string} The resolved address or empty string
 */
export function extractOmniCacheAddress(logs) {
  if (!logs) return ''

  const lines = logs.trim().split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i]
    if (!line.includes('omni-cache started')) continue

    if (line.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(line)
        if (parsed?.msg === 'omni-cache started' && parsed?.addr) {
          return String(parsed.addr)
        }
      } catch {
        // Fall through to text parsing.
      }
    }

    const match = line.match(/\baddr=("([^"]+)"|\S+)/)
    if (match) {
      return match[2] || match[1]
    }
  }

  return ''
}

/**
 * Read the omni-cache address from a log file if present.
 * @param {string} logPath - Path to the log file
 * @returns {string} The resolved address or empty string
 */
export function readOmniCacheAddress(logPath) {
  const logs = readLogs(logPath)
  return extractOmniCacheAddress(logs)
}

/**
 * Display log file contents if available
 * @param {string} logPath - Path to the log file
 * @param {string} title - Log group title
 */
export function displayLogs(logPath, title = 'omni-cache logs') {
  const logs = readLogs(logPath)
  if (!logs.trim()) return

  core.startGroup(title)
  core.info(logs)
  core.endGroup()
}
