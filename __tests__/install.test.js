/**
 * Unit tests for src/install.js
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const mockTc = {
  find: jest.fn(),
  downloadTool: jest.fn(),
  cacheDir: jest.fn()
}

const mockFsPromises = {
  chmod: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined)
}

const mockFs = {
  promises: mockFsPromises
}

const mockPlatform = {
  getBinaryName: jest.fn().mockReturnValue('omni-cache-linux-amd64'),
  getDownloadUrl: jest
    .fn()
    .mockReturnValue(
      'https://github.com/cirruslabs/omni-cache/releases/latest/download/omni-cache-linux-amd64'
    )
}

const mockOs = {
  platform: jest.fn().mockReturnValue('linux'),
  tmpdir: jest.fn().mockReturnValue('/tmp')
}

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/tool-cache', () => mockTc)
jest.unstable_mockModule('fs', () => mockFs)
jest.unstable_mockModule('os', () => mockOs)
jest.unstable_mockModule('../src/platform.js', () => mockPlatform)

const { installOmniCache } = await import('../src/install.js')

describe('install.js', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTc.find.mockReturnValue('')
    mockTc.downloadTool.mockResolvedValue('/tmp/downloaded-binary')
    mockTc.cacheDir.mockResolvedValue('/cached/path')
    mockFsPromises.chmod.mockResolvedValue(undefined)
    mockFsPromises.mkdir.mockResolvedValue(undefined)
    mockFsPromises.copyFile.mockResolvedValue(undefined)
    mockPlatform.getBinaryName.mockReturnValue('omni-cache-linux-amd64')
    mockPlatform.getDownloadUrl.mockReturnValue(
      'https://github.com/cirruslabs/omni-cache/releases/latest/download/omni-cache-linux-amd64'
    )
    mockOs.platform.mockReturnValue('linux')
    mockOs.tmpdir.mockReturnValue('/tmp')
  })

  it('downloads and caches the binary', async () => {
    const result = await installOmniCache('latest')

    expect(mockTc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/cirruslabs/omni-cache/releases/latest/download/omni-cache-linux-amd64'
    )
    expect(mockTc.cacheDir).toHaveBeenCalled()
    expect(result.path).toContain('omni-cache-linux-amd64')
    expect(core.addPath).toHaveBeenCalled()
  })

  it('uses cached binary if available for specific version', async () => {
    mockTc.find.mockReturnValue('/cached/path')

    const result = await installOmniCache('v0.7.0')

    expect(mockTc.downloadTool).not.toHaveBeenCalled()
    expect(result.path).toContain('/cached/path')
    expect(core.addPath).toHaveBeenCalledWith('/cached/path')
  })

  it('always downloads for latest version', async () => {
    mockTc.find.mockReturnValue('/cached/path')

    const result = await installOmniCache('latest')

    // For 'latest', we always download to get the newest version
    expect(mockTc.downloadTool).toHaveBeenCalled()
    expect(result.path).toContain('omni-cache-linux-amd64')
  })

  it('makes binary executable on non-Windows', async () => {
    await installOmniCache('latest')

    expect(mockFsPromises.chmod).toHaveBeenCalledWith(
      '/tmp/downloaded-binary',
      0o755
    )
  })

  it('throws on download failure', async () => {
    mockTc.downloadTool.mockRejectedValue(new Error('Network error'))

    await expect(installOmniCache('latest')).rejects.toThrow(
      'Failed to download omni-cache'
    )
  })
})
