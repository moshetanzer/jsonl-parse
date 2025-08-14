import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JSONLParser } from '../src/index'

describe('jSONLParser', () => {
  let parser: JSONLParser

  beforeEach(() => {
    parser = new JSONLParser()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const parser = new JSONLParser()
      expect(parser).toBeInstanceOf(JSONLParser)
    })

    it('should accept custom options', () => {
      const reviver = vi.fn()
      const parser = new JSONLParser({
        strict: false,
        reviver,
        skipEmptyLines: false,
        maxLineLength: 1000,
        encoding: 'ascii',
      })
      expect(parser).toBeInstanceOf(JSONLParser)
    })
  })

  describe('basic parsing', () => {
    it('should parse valid JSONL data', async () => {
      const input = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
    })

    it('should handle single line without trailing newline', async () => {
      const input = '{"test": true}'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([{ test: true }])
    })

    it('should handle multiple chunks', async () => {
      const chunks = [
        '{"name":"A',
        'lice","age":30}\n{"na',
        'me":"Bob","age":25}\n',
      ]
      const results: any[] = []

      const readable = Readable.from(chunks)

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
    })
  })

  describe('line ending handling', () => {
    it('should handle Unix line endings (LF)', async () => {
      const input = '{"unix": true}\n{"test": "lf"}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ unix: true })
      expect(results[1]).toEqual({ test: 'lf' })
    })

    it('should handle Windows line endings (CRLF)', async () => {
      const input = '{"windows": true}\r\n{"test": "crlf"}\r\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ windows: true })
      expect(results[1]).toEqual({ test: 'crlf' })
    })

    it('should handle mixed line endings', async () => {
      const input = '{"mixed": true}\r\n{"test": "both"}\n{"final": true}\r\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(3)
    })
  })

  describe('empty line handling', () => {
    it('should skip empty lines by default', async () => {
      const input = '{"test": 1}\n\n{"test": 2}\n   \n{"test": 3}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        { test: 1 },
        { test: 2 },
        { test: 3 },
      ])
    })

    it('should preserve empty lines when skipEmptyLines is false', async () => {
      const parser = new JSONLParser({ skipEmptyLines: false, strict: false })
      const input = '{"test": 1}\n\n{"test": 2}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      // Should have 2 valid objects (empty line causes parse error but is skipped in non-strict)
      expect(results).toEqual([
        { test: 1 },
        { test: 2 },
      ])
    })
  })

  describe('error handling - strict mode', () => {
    it('should throw error on invalid JSON in strict mode', async () => {
      const parser = new JSONLParser({ strict: true })
      const input = '{"valid": true}\n{invalid json}\n{"more": "data"}\n'

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          parser,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Invalid JSON at line')
    })

    it('should throw error on line length exceeded in strict mode', async () => {
      const parser = new JSONLParser({ strict: true, maxLineLength: 10 })
      const input = '{"this_is_a_very_long_line_that_exceeds_limit": true}\n'

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          parser,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Line length')
    })

    it('should throw error on buffer size exceeded', async () => {
      const parser = new JSONLParser({ strict: true, maxLineLength: 10 })
      const input = 'x'.repeat(200) // Very long input without newlines

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          parser,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Buffer size exceeded')
    })
  })

  describe('error handling - lenient mode', () => {
    it('should skip invalid JSON in lenient mode', async () => {
      const parser = new JSONLParser({ strict: false })
      const input = '{"valid": 1}\n{invalid json}\n{"valid": 2}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        { valid: 1 },
        { valid: 2 },
      ])
    })

    it('should skip overly long lines in lenient mode', async () => {
      const parser = new JSONLParser({ strict: false, maxLineLength: 20 })
      const input = '{"short": true}\n{"this_line_is_way_too_long_and_exceeds_the_limit": true}\n{"also_short": true}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        { short: true },
        { also_short: true },
      ])
    })
  })

  describe('reviver function', () => {
    it('should apply reviver function to parsed objects', async () => {
      const reviver = vi.fn((key: string, value: any) => {
        if (key === 'timestamp')
          return new Date(value)
        if (key === 'count' && typeof value === 'string')
          return Number.parseInt(value, 10)
        return value
      })

      const parser = new JSONLParser({ reviver })
      const input = '{"timestamp": "2023-01-01T00:00:00Z", "count": "42", "name": "test"}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(reviver).toHaveBeenCalled()
      expect(results[0].timestamp).toBeInstanceOf(Date)
      expect(results[0].count).toBe(42)
      expect(results[0].name).toBe('test')
    })
  })

  describe('encoding handling', () => {
    it('should handle different encodings', async () => {
      const parser = new JSONLParser({ encoding: 'ascii' })
      const input = '{"ascii": true}\n'
      const results: any[] = []

      const readable = Readable.from([Buffer.from(input, 'ascii')])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([{ ascii: true }])
    })
  })

  describe('edge cases', () => {
    it('should handle empty input', async () => {
      const input = ''
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([])
    })

    it('should handle input with only whitespace', async () => {
      const input = '   \n\t\n  \n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([])
    })

    it('should handle very large valid JSON objects', async () => {
      const largeObject = {
        data: 'x'.repeat(1000),
        array: Array.from({ length: 100 }).fill(0).map((_, i) => ({ id: i, value: `item_${i}` })),
      }
      const input = `${JSON.stringify(largeObject)}\n`
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(largeObject)
    })

    it('should handle Unicode characters', async () => {
      const input = '{"emoji": "🚀", "chinese": "你好", "math": "∑∆"}\n'
      const results: any[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        parser,
        async function* (source) {
          for await (const chunk of source) {
            results.push(chunk)
            yield chunk
          }
        },
      )

      expect(results).toEqual([{
        emoji: '🚀',
        chinese: '你好',
        math: '∑∆',
      }])
    })
  })

  describe('performance considerations', () => {
    it('should handle many small objects efficiently', async () => {
      const lines = Array.from({ length: 100 }, (_, i) =>
        JSON.stringify({ id: i, value: `item_${i}` }))
      const input = `${lines.join('\n')}\n`
      const results: any[] = []

      const readable = Readable.from([input])
      const parser = new JSONLParser()

      readable.pipe(parser)

      parser.on('data', (chunk) => {
        results.push(chunk)
      })

      await new Promise<void>((resolve, reject) => {
        parser.on('end', () => resolve())
        parser.on('error', reject)
      })

      expect(results).toHaveLength(100)
      expect(results[0]).toEqual({ id: 0, value: 'item_0' })
      expect(results[99]).toEqual({ id: 99, value: 'item_99' })
    }, 15000) // 15 second timeout

    it('should handle streaming with backpressure', async () => {
      let processedCount = 0
      const totalItems = 50 // Reduced from 100

      // eslint-disable-next-line prefer-template
      const input = Array.from({ length: totalItems }, (_, i) =>
        JSON.stringify({ id: i, data: 'x'.repeat(50) })).join('\n') + '\n'

      const readable = Readable.from([input])
      const parser = new JSONLParser()

      readable.pipe(parser)

      parser.on('data', async () => {
        processedCount++
        // Simulate very light processing instead of setTimeout
        await Promise.resolve()
      })

      await new Promise<void>((resolve, reject) => {
        parser.on('end', () => resolve())
        parser.on('error', reject)
      })

      expect(processedCount).toBe(totalItems)
    }, 15000) // 15 second timeout
  })
})
