/**
 * Unit tests for the action's main functionality, src/main.js
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

const mockInstall = {
  installOmniCache: jest.fn()
}

let mockChildInstance

const mockSpawn = jest.fn()
const mockExecFile = jest.fn()

const mockChildProcess = {
  spawn: mockSpawn,
  execFile: mockExecFile
}

const mockFs = {
  openSync: jest.fn().mockReturnValue(3),
  closeSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  readFileSync: jest.fn().mockReturnValue('')
}

const mockOs = {
  tmpdir: jest.fn().mockReturnValue('/tmp'),
  homedir: jest.fn().mockReturnValue('/home/user')
}

const mockPath = {
  join: jest.fn((...args) => args.join('/'))
}

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/install.js', () => mockInstall)
jest.unstable_mockModule('child_process', () => mockChildProcess)
jest.unstable_mockModule('fs', () => mockFs)
jest.unstable_mockModule('os', () => mockOs)
jest.unstable_mockModule('path', () => mockPath)

// Mock global fetch
global.fetch = jest.fn()

// The module being tested should be imported dynamically.
const { run } = await import('../src/main.js')

describe('main.js', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockChildInstance = {
      pid: 12345,
      unref: jest.fn()
    }
    mockSpawn.mockReturnValue(mockChildInstance)
    mockExecFile.mockImplementation((file, args, opts, cb) => {
      const callback = typeof opts === 'function' ? opts : cb
      callback(null, 'omni-cache version 0.9.0-808310f\n', '')
    })

    mockInstall.installOmniCache.mockResolvedValue({
      path: '/path/to/omni-cache',
      version: 'v0.7.0'
    })

    core.getInput.mockImplementation((name) => {
      const inputs = {
        bucket: 'test-bucket',
        prefix: 'test-prefix',
        host: 'localhost:12321',
        's3-endpoint': 'https://s3.example.com',
        version: 'latest'
      }
      return inputs[name] || ''
    })

    mockFs.openSync.mockReturnValue(3)
    mockOs.tmpdir.mockReturnValue('/tmp')
    mockOs.homedir.mockReturnValue('/home/user')
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(
      'time=2026-01-30T12:34:56Z level=INFO msg="omni-cache started" addr=127.0.0.1:12321 socket=/home/user/.cirruslabs/omni-cache.sock bucket=test-bucket'
    )

    // Mock successful health check
    global.fetch.mockResolvedValue({ ok: true })
  })

  it('installs and starts omni-cache', async () => {
    await run()

    expect(mockInstall.installOmniCache).toHaveBeenCalledWith('latest')
    expect(mockSpawn).toHaveBeenCalledWith(
      '/path/to/omni-cache',
      [
        'sidecar',
        '--bucket',
        'test-bucket',
        '--listen-addr',
        'localhost:12321',
        '--prefix',
        'test-prefix',
        '--s3-endpoint',
        'https://s3.example.com'
      ],
      expect.objectContaining({
        detached: true
      })
    )
    expect(core.saveState).toHaveBeenCalledWith('omni-cache-pid', '12345')
    expect(core.setOutput).toHaveBeenCalledWith(
      'cache-address',
      '127.0.0.1:12321'
    )
  })

  it('sets environment variables correctly', async () => {
    await run()

    expect(mockSpawn).toHaveBeenCalled()
    const spawnCall = mockSpawn.mock.calls[0]
    const env = spawnCall[2].env

    expect(env.OMNI_CACHE_BUCKET).toBe('test-bucket')
    expect(env.OMNI_CACHE_PREFIX).toBe('test-prefix')
    expect(env.OMNI_CACHE_HOST).toBe('localhost:12321')
    expect(env.OMNI_CACHE_S3_ENDPOINT).toBe('https://s3.example.com')
  })

  it('exports OMNI_CACHE_ADDRESS', async () => {
    await run()

    expect(core.exportVariable).toHaveBeenCalledWith(
      'OMNI_CACHE_ADDRESS',
      '127.0.0.1:12321'
    )
  })

  it('sets version output', async () => {
    await run()

    expect(core.setOutput).toHaveBeenCalledWith('version', '0.9.0-808310f')
  })

  it('sets cache-socket output', async () => {
    await run()

    expect(core.setOutput).toHaveBeenCalledWith(
      'cache-socket',
      expect.stringContaining('.cirruslabs/omni-cache.sock')
    )
  })

  it('fails when bucket is not provided', async () => {
    core.getInput.mockImplementation((name, opts) => {
      if (name === 'bucket' && opts?.required) {
        throw new Error('Input required and not supplied: bucket')
      }
      return ''
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      'Input required and not supplied: bucket'
    )
  })

  it('fails when health check times out', async () => {
    global.fetch.mockRejectedValue(new Error('Connection refused'))

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('failed to become healthy')
    )
  }, 15000)

  it('detaches child process', async () => {
    await run()

    expect(mockChildInstance.unref).toHaveBeenCalled()
  })
})
