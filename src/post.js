import * as core from '@actions/core'
import { displayLogs } from './logs.js'

/**
 * Fetch and display cache statistics
 * @param {string} host - The omni-cache host address
 * @returns {Promise<object|null>} The stats object when JSON is available, otherwise null
 */
async function fetchStats(host) {
  const url = host.startsWith('http') ? host : `http://${host}`

  try {
    const response = await fetch(`${url}/metrics/cache`)
    if (response.ok) {
      const bodyText =
        typeof response.text === 'function' ? await response.text() : ''
      const cleaned = (bodyText || '').replace(/^\uFEFF/, '')
      const trimmed = cleaned.trim()
      if (!trimmed) {
        core.debug('omni-cache stats endpoint returned empty response')
        return null
      }

      core.info('=== omni-cache Statistics ===')
      core.info(cleaned)

      if (!/^[{[]/.test(trimmed)) {
        return null
      }

      let stats
      try {
        stats = JSON.parse(trimmed)
      } catch (error) {
        core.warning(`Could not parse cache statistics JSON: ${error.message}`)
        return null
      }

      // Create a summary if hits/misses are available
      if (stats.hits !== undefined && stats.misses !== undefined) {
        const total = stats.hits + stats.misses
        const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(1) : 0
        core.info(
          `Cache hit rate: ${hitRate}% (${stats.hits} hits, ${stats.misses} misses)`
        )

        // Add to job summary
        await core.summary
          .addHeading('omni-cache Statistics', 2)
          .addTable([
            [
              { data: 'Metric', header: true },
              { data: 'Value', header: true }
            ],
            ['Cache Hits', stats.hits.toString()],
            ['Cache Misses', stats.misses.toString()],
            ['Hit Rate', `${hitRate}%`]
          ])
          .write()
      }

      return stats
    } else {
      core.warning(`Failed to fetch stats: HTTP ${response.status}`)
    }
  } catch (error) {
    core.warning(`Could not fetch cache statistics: ${error.message}`)
  }

  return null
}

/**
 * Gracefully shutdown omni-cache
 * @param {number} pid - Process ID to terminate
 * @returns {Promise<void>}
 */
async function shutdownOmniCache(pid) {
  if (!pid || isNaN(pid)) {
    core.warning('No valid PID found for omni-cache')
    return
  }

  core.info(`Shutting down omni-cache (PID: ${pid})...`)

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM')

    // Wait for process to exit (with timeout)
    const maxWait = 10000 // 10 seconds
    const checkInterval = 500
    let waited = 0

    while (waited < maxWait) {
      try {
        // Check if process still exists (kill with signal 0)
        process.kill(pid, 0)
        await new Promise((resolve) => setTimeout(resolve, checkInterval))
        waited += checkInterval
      } catch {
        // Process no longer exists
        core.info('omni-cache shutdown complete')
        return
      }
    }

    // Force kill if still running
    core.warning('omni-cache did not respond to SIGTERM, sending SIGKILL')
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // Process may have exited between checks
    }
  } catch (error) {
    if (error.code === 'ESRCH') {
      core.info('omni-cache process already terminated')
    } else {
      core.warning(`Error shutting down omni-cache: ${error.message}`)
    }
  }
}

/**
 * Post action function - fetches stats and shuts down omni-cache
 * @returns {Promise<void>}
 */
export async function run() {
  try {
    const pidStr = core.getState('omni-cache-pid')
    const host = core.getState('omni-cache-host') || 'localhost:12321'
    const logFile = core.getState('omni-cache-log')

    if (!pidStr) {
      core.info('No omni-cache process to clean up')
      return
    }

    const pid = parseInt(pidStr, 10)

    // Fetch and display statistics before shutdown
    await fetchStats(host)

    // Display logs
    displayLogs(logFile)

    // Shutdown the process
    await shutdownOmniCache(pid)
  } catch (error) {
    // Don't fail the workflow on post-action errors
    core.warning(`Post action error: ${error.message}`)
  }
}
