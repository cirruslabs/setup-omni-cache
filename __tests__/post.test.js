/**
 * Unit tests for the action's post hook, src/post.js
 */
import { jest } from '@jest/globals'

// Create core mock with fresh summary object for each test
const createCoreMock = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  warning: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  addPath: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  summary: {
    addHeading: jest.fn().mockReturnThis(),
    addTable: jest.fn().mockReturnThis(),
    write: jest.fn().mockResolvedValue(undefined)
  }
})

let core = createCoreMock()

const mockFs = {
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}

jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('fs', () => mockFs)

// Mock global fetch
global.fetch = jest.fn()

const createFetchResponse = ({ ok = true, status = 200, body = '' } = {}) => ({
  ok,
  status,
  text: () => Promise.resolve(body)
})

// Mock process.kill
const originalKill = process.kill

const { run } = await import('../src/post.js')

describe('post.js', () => {
  beforeEach(() => {
    // Reset the core mock
    core.debug.mockClear()
    core.error.mockClear()
    core.info.mockClear()
    core.getInput.mockClear()
    core.setOutput.mockClear()
    core.setFailed.mockClear()
    core.warning.mockClear()
    core.saveState.mockClear()
    core.getState.mockClear()
    core.addPath.mockClear()
    core.startGroup.mockClear()
    core.endGroup.mockClear()
    core.summary.addHeading.mockClear().mockReturnThis()
    core.summary.addTable.mockClear().mockReturnThis()
    core.summary.write.mockClear().mockResolvedValue(undefined)

    core.getState.mockImplementation((key) => {
      const state = {
        'omni-cache-pid': '12345',
        'omni-cache-host': 'localhost:12321',
        'omni-cache-log': '/tmp/omni-cache.log'
      }
      return state[key] || ''
    })

    global.fetch.mockResolvedValue(
      createFetchResponse({
        body: JSON.stringify({ hits: 100, misses: 50 })
      })
    )

    process.kill = jest.fn()
    // Process exits immediately after SIGTERM
    process.kill.mockImplementation((pid, signal) => {
      if (signal === 0) throw { code: 'ESRCH' }
    })

    mockFs.existsSync.mockReturnValue(false)
    mockFs.readFileSync.mockReturnValue('')
  })

  afterEach(() => {
    jest.clearAllMocks()
    process.kill = originalKill
  })

  it('fetches and displays stats', async () => {
    await run()

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:12321/metrics/cache',
      {
        headers: {
          Accept: 'application/vnd.github-actions'
        }
      }
    )
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('omni-cache Statistics')
    )
  })

  it('calculates and displays hit rate', async () => {
    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Cache hit rate: 66.7%')
    )
  })

  it('writes to job summary', async () => {
    await run()

    expect(core.summary.addHeading).toHaveBeenCalledWith(
      'omni-cache Statistics',
      2
    )
    expect(core.summary.addTable).toHaveBeenCalled()
    expect(core.summary.write).toHaveBeenCalled()
  })

  it('shuts down omni-cache gracefully', async () => {
    await run()

    expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(core.info).toHaveBeenCalledWith('omni-cache shutdown complete')
  })

  it('handles missing PID gracefully', async () => {
    core.getState.mockReturnValue('')

    await run()

    expect(core.info).toHaveBeenCalledWith('No omni-cache process to clean up')
    expect(process.kill).not.toHaveBeenCalled()
  })

  it('warns but does not fail on stats fetch error', async () => {
    global.fetch.mockRejectedValue(new Error('Connection refused'))

    await run()

    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Could not fetch cache statistics')
    )
    // Should still attempt shutdown
    expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM')
  })

  it('handles already terminated process', async () => {
    process.kill.mockImplementation(() => {
      const err = new Error('No such process')
      err.code = 'ESRCH'
      throw err
    })

    await run()

    expect(core.info).toHaveBeenCalledWith(
      'omni-cache process already terminated'
    )
  })

  it('displays logs if available', async () => {
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue('some log output')

    await run()

    expect(core.startGroup).toHaveBeenCalledWith('omni-cache logs')
    expect(core.info).toHaveBeenCalledWith('some log output')
    expect(core.endGroup).toHaveBeenCalled()
  })

  it('handles stats with zero total gracefully', async () => {
    global.fetch.mockResolvedValue(
      createFetchResponse({
        body: JSON.stringify({ hits: 0, misses: 0 })
      })
    )

    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Cache hit rate: 0%')
    )
  })

  it('prints non-JSON stats responses without warning', async () => {
    global.fetch.mockResolvedValue(
      createFetchResponse({
        body: 'omni-cache is running'
      })
    )

    await run()

    expect(core.info).toHaveBeenCalledWith('omni-cache is running')
    expect(core.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('Could not fetch cache statistics')
    )
  })
})
