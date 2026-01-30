import * as core from '@actions/core'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import { installOmniCache } from './install.js'

/**
 * Wait for omni-cache to become healthy
 * @param {string} host - Host address to check
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<boolean>}
 */
async function waitForHealthy(host, maxAttempts = 30, delayMs = 1000) {
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
    core.saveState('omni-cache-host', host)
    core.saveState('omni-cache-log', logFile)

    core.info(`omni-cache started with PID ${pid}`)

    // Detach the child process so it continues running after action completes
    child.unref()

    // Close log file descriptor in parent process
    fs.closeSync(logFd)

    // Wait for omni-cache to be healthy
    await waitForHealthy(host)

    // Set outputs
    const endpoint = host.startsWith('http') ? host : `http://${host}`
    core.setOutput('cache-endpoint', endpoint)

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
