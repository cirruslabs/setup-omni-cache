import * as os from 'os'

/**
 * Maps Node.js os.platform() to omni-cache platform names
 * @returns {string} The platform name for omni-cache binary
 */
export function getPlatform() {
  const platform = os.platform()
  const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
    freebsd: 'freebsd',
    netbsd: 'netbsd',
    openbsd: 'openbsd'
  }

  const mapped = platformMap[platform]
  if (!mapped) {
    throw new Error(
      `Unsupported platform: ${platform}. omni-cache supports: darwin, linux, freebsd, netbsd, openbsd`
    )
  }
  return mapped
}

/**
 * Maps Node.js os.arch() to omni-cache architecture names
 * @returns {string} The architecture name for omni-cache binary
 */
export function getArch() {
  const arch = os.arch()
  const archMap = {
    x64: 'amd64',
    arm64: 'arm64',
    arm: 'arm',
    s390x: 's390x'
  }

  const mapped = archMap[arch]
  if (!mapped) {
    throw new Error(
      `Unsupported architecture: ${arch}. omni-cache supports: x64 (amd64), arm64, arm, s390x`
    )
  }
  return mapped
}

/**
 * Get the binary name for the current platform
 * @returns {string} The binary name (e.g., 'omni-cache-linux-amd64')
 */
export function getBinaryName() {
  const platform = getPlatform()
  const arch = getArch()
  return `omni-cache-${platform}-${arch}`
}

/**
 * Get download URL for a specific version
 * @param {string} version - Version to download ('latest' or specific version like 'v0.7.0')
 * @returns {string} The download URL
 */
export function getDownloadUrl(version) {
  const binaryName = getBinaryName()
  const tag = version === 'latest' ? 'latest' : version

  if (tag === 'latest') {
    return `https://github.com/cirruslabs/omni-cache/releases/latest/download/${binaryName}`
  }
  return `https://github.com/cirruslabs/omni-cache/releases/download/${tag}/${binaryName}`
}
