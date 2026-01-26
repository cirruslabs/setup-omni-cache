import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getBinaryName, getDownloadUrl } from './platform.js'

const TOOL_NAME = 'omni-cache'

/**
 * Download and install omni-cache binary
 * @param {string} version - Version to install (e.g., 'latest', 'v0.7.0')
 * @returns {Promise<{path: string, version: string}>} - Path to binary and resolved version
 */
export async function installOmniCache(version) {
  const binaryName = getBinaryName()

  // Check tool cache first (skip for 'latest' as we can't version-match it reliably)
  if (version !== 'latest') {
    const cachedPath = tc.find(TOOL_NAME, version)
    if (cachedPath) {
      core.info(`Found cached omni-cache ${version} at ${cachedPath}`)
      const binaryPath = path.join(cachedPath, binaryName)
      core.addPath(cachedPath)
      return { path: binaryPath, version }
    }
  }

  // Download the binary
  const downloadUrl = getDownloadUrl(version)
  core.info(`Downloading omni-cache from ${downloadUrl}`)

  let downloadPath
  try {
    downloadPath = await tc.downloadTool(downloadUrl)
  } catch (error) {
    throw new Error(
      `Failed to download omni-cache from ${downloadUrl}: ${error.message}`
    )
  }

  // Make binary executable (non-Windows)
  if (os.platform() !== 'win32') {
    await fs.promises.chmod(downloadPath, 0o755)
  }

  // Resolve the actual version if 'latest' was requested
  let resolvedVersion = version
  if (version === 'latest') {
    // For caching purposes, use a timestamp-based version for 'latest'
    // This prevents re-downloading on every run while still getting updates periodically
    resolvedVersion = `latest-${new Date().toISOString().split('T')[0]}`
  }

  // Prepare cache directory
  const cacheDir = path.join(os.tmpdir(), `omni-cache-install-${Date.now()}`)
  await fs.promises.mkdir(cacheDir, { recursive: true })
  const destPath = path.join(cacheDir, binaryName)
  await fs.promises.copyFile(downloadPath, destPath)

  // Cache the binary for future runs
  const cachedDir = await tc.cacheDir(cacheDir, TOOL_NAME, resolvedVersion)
  const finalPath = path.join(cachedDir, binaryName)

  // Add to PATH so subsequent steps can use omni-cache CLI directly
  core.addPath(cachedDir)

  core.info(`omni-cache installed to ${finalPath}`)
  return { path: finalPath, version: resolvedVersion }
}
