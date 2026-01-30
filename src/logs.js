import * as core from '@actions/core'
import * as fs from 'fs'

/**
 * Display log file contents if available
 * @param {string} logPath - Path to the log file
 * @param {string} title - Log group title
 */
export function displayLogs(logPath, title = 'omni-cache logs') {
  if (!logPath) return

  try {
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf8')
      if (logs.trim()) {
        core.startGroup(title)
        core.info(logs)
        core.endGroup()
      }
    }
  } catch (error) {
    core.debug(`Could not read log file: ${error.message}`)
  }
}
