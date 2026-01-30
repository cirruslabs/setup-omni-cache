import * as core from '@actions/core'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { installOmniCache } from './install.js'
import { displayLogs, readOmniCacheAddress } from './logs.js'

/**
 * Wait for omni-cache to become healthy
 * @param {string} host - Host address to check
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForHealthy(host, maxAttempts = 10, delayMs = 1000) {
  const url = host.startsWith('http') ? host : `http://${host}`

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${url}/stats`)
      if (response.ok) {
        core.info(`omni-cache is healthy after ${attempt} attempt(s)`)
        return true
      }
    } catch (error) {
      core.debug(
        `Health check attempt ${attempt}/${maxAttempts} failed: ${error.message}`
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error(
    `omni-cache failed to become healthy after ${maxAttempts} attempts`
  )
}

/**
 * Normalize a host string into a host:port address.
 * @param {string} host - Input host or URL
 * @returns {string} Normalized address
 */
function normalizeAddress(host) {
  const trimmed = (host || '').trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).host
    } catch {
      return trimmed.replace(/^https?:\/\//, '')
    }
  }

  return trimmed
}

/**
 * Wait for omni-cache to log the resolved listen address.
 * @param {string} logFile - Log file path
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<string>} The resolved address or empty string
 */
async function waitForOmniCacheAddress(
  logFile,
  maxAttempts = 20,
  delayMs = 250
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const address = readOmniCacheAddress(logFile)
    if (address) {
      core.info(`Resolved omni-cache address from logs: ${address}`)
      return address
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return ''
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    // Get inputs
    const bucket = core.getInput('bucket', { required: true })
    const prefix = core.getInput('prefix')
    const host = core.getInput('host') || 'localhost:12321'
    const s3Endpoint = core.getInput('s3-endpoint')
    const version = core.getInput('version') || 'latest'

    core.info(`Setting up omni-cache ${version}...`)

    // Install omni-cache
    const { path: binaryPath, version: installedVersion } =
      await installOmniCache(version)
    if (version === 'latest') {
      core.info(`Resolved omni-cache version: ${installedVersion}`)
    }
    core.setOutput('version', installedVersion)

    // Prepare environment variables for omni-cache
    const env = {
      ...process.env,
      OMNI_CACHE_BUCKET: bucket,
      OMNI_CACHE_HOST: host
    }

    if (prefix) {
      env.OMNI_CACHE_PREFIX = prefix
    }
    if (s3Endpoint) {
      env.OMNI_CACHE_S3_ENDPOINT = s3Endpoint
    }

    // Create log file for omni-cache output
    const logFile = path.join(os.tmpdir(), 'omni-cache.log')
    const logFd = fs.openSync(logFile, 'a')

    // Start omni-cache in the background
    core.info(`Starting omni-cache sidecar...`)

    const child = spawn(binaryPath, ['sidecar'], {
      env,
      detached: true,
      stdio: ['ignore', logFd, logFd]
    })

    // Save PID for the post action to use
    const pid = child.pid
    core.saveState('omni-cache-pid', pid.toString())
    core.saveState('omni-cache-log', logFile)

    core.info(`omni-cache started with PID ${pid}`)

    // Detach the child process so it continues running after action completes
    child.unref()

    // Close log file descriptor in parent process
    fs.closeSync(logFd)

    const resolvedAddress = await waitForOmniCacheAddress(logFile)
    const fallbackAddress = normalizeAddress(host)
    const cacheAddress = resolvedAddress || fallbackAddress

    if (!cacheAddress) {
      core.warning('Could not resolve omni-cache address from logs')
    } else if (!resolvedAddress) {
      core.warning(
        `Could not resolve omni-cache address from logs, using ${cacheAddress}`
      )
    }

    if (cacheAddress) {
      core.exportVariable('OMNI_CACHE_ADDRESS', cacheAddress)
    }

    core.saveState('omni-cache-host', cacheAddress || host)

    const healthHost = resolvedAddress ? cacheAddress : host

    // Wait for omni-cache to be healthy
    try {
      await waitForHealthy(healthHost)
    } catch (error) {
      displayLogs(logFile, 'omni-cache logs (startup)')
      throw error
    }

    // Set outputs
    if (cacheAddress) {
      core.setOutput('cache-address', cacheAddress)
    }
    const endpoint = cacheAddress
      ? `http://${cacheAddress}`
      : host.startsWith('http')
        ? host
        : `http://${host}`

    // Unix socket path
    const homeDir = os.homedir()
    const socketPath = path.join(homeDir, '.cirruslabs', 'omni-cache.sock')
    core.setOutput('cache-socket', socketPath)

    core.info(`omni-cache is ready!`)
    core.info(`  HTTP endpoint: ${endpoint}`)
    core.info(`  Unix socket: ${socketPath}`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
