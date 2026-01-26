/**
 * Unit tests for src/platform.js
 */
import { jest } from '@jest/globals'

// Mock os module
const mockOs = {
  platform: jest.fn(),
  arch: jest.fn()
}

jest.unstable_mockModule('os', () => mockOs)

const { getPlatform, getArch, getBinaryName, getDownloadUrl } =
  await import('../src/platform.js')

describe('platform.js', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('getPlatform', () => {
    it('maps darwin correctly', () => {
      mockOs.platform.mockReturnValue('darwin')
      expect(getPlatform()).toBe('darwin')
    })

    it('maps linux correctly', () => {
      mockOs.platform.mockReturnValue('linux')
      expect(getPlatform()).toBe('linux')
    })

    it('maps freebsd correctly', () => {
      mockOs.platform.mockReturnValue('freebsd')
      expect(getPlatform()).toBe('freebsd')
    })

    it('throws for unsupported platform', () => {
      mockOs.platform.mockReturnValue('win32')
      expect(() => getPlatform()).toThrow('Unsupported platform: win32')
    })
  })

  describe('getArch', () => {
    it('maps x64 to amd64', () => {
      mockOs.arch.mockReturnValue('x64')
      expect(getArch()).toBe('amd64')
    })

    it('maps arm64 correctly', () => {
      mockOs.arch.mockReturnValue('arm64')
      expect(getArch()).toBe('arm64')
    })

    it('maps arm correctly', () => {
      mockOs.arch.mockReturnValue('arm')
      expect(getArch()).toBe('arm')
    })

    it('throws for unsupported arch', () => {
      mockOs.arch.mockReturnValue('ppc64')
      expect(() => getArch()).toThrow('Unsupported architecture: ppc64')
    })
  })

  describe('getBinaryName', () => {
    it('returns correct name for linux amd64', () => {
      mockOs.platform.mockReturnValue('linux')
      mockOs.arch.mockReturnValue('x64')
      expect(getBinaryName()).toBe('omni-cache-linux-amd64')
    })

    it('returns correct name for darwin arm64', () => {
      mockOs.platform.mockReturnValue('darwin')
      mockOs.arch.mockReturnValue('arm64')
      expect(getBinaryName()).toBe('omni-cache-darwin-arm64')
    })
  })

  describe('getDownloadUrl', () => {
    beforeEach(() => {
      mockOs.platform.mockReturnValue('linux')
      mockOs.arch.mockReturnValue('x64')
    })

    it('uses latest for latest version', () => {
      expect(getDownloadUrl('latest')).toBe(
        'https://github.com/cirruslabs/omni-cache/releases/latest/download/omni-cache-linux-amd64'
      )
    })

    it('uses specific version tag', () => {
      expect(getDownloadUrl('v0.7.0')).toBe(
        'https://github.com/cirruslabs/omni-cache/releases/download/v0.7.0/omni-cache-linux-amd64'
      )
    })
  })
})
