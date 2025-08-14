import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JSONLParse } from '../src/index'

describe('jSONLParse', () => {
  let parser: JSONLParse

  beforeEach(() => {
    parser = new JSONLParse()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const parser = new JSONLParse()
      expect(parser).toBeInstanceOf(JSONLParse)
    })

    it('should accept custom options', () => {
      const reviver = vi.fn()
      const onRecord = vi.fn()
      const onSkip = vi.fn()
      const parser = new JSONLParse({
        strict: false,
        reviver,
        skipEmptyLines: false,
        maxLineLength: 1000,
        encoding: 'ascii',
        columns: ['id', 'name'],
        from: 2,
        to: 10,
        cast: true,
        ltrim: true,
        on_record: onRecord,
        on_skip: onSkip,
        info: true,
        raw: true,
      })
      expect(parser).toBeInstanceOf(JSONLParse)
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

  describe('columns option', () => {
    it('should treat first line as header when columns is true', async () => {
      const parser = new JSONLParse({ columns: true })
      const input = '["name","age"]\n["Alice",30]\n["Bob",25]\n'
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

    it('should use provided column names array', async () => {
      const parser = new JSONLParse({ columns: ['id', 'name', 'email'] })
      const input = '[1,"Alice","alice@test.com"]\n[2,"Bob","bob@test.com"]\n'
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
        { id: 1, name: 'Alice', email: 'alice@test.com' },
        { id: 2, name: 'Bob', email: 'bob@test.com' },
      ])
    })

    it('should use function to generate column names', async () => {
      const parser = new JSONLParse({
        columns: record => record.map((col: string) => col.toLowerCase()),
      })
      const input = '["NAME","AGE"]\n["Alice",30]\n["Bob",25]\n'
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
  })

  describe('from/to options', () => {
    it('should filter records by from/to', async () => {
      const parser = new JSONLParse({ from: 2, to: 3 })
      const input = '{"id":1}\n{"id":2}\n{"id":3}\n{"id":4}\n{"id":5}\n'
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
        { id: 2 },
        { id: 3 },
      ])
    })

    it('should filter lines by from_line/to_line', async () => {
      const parser = new JSONLParse({ from_line: 2, to_line: 3 })
      const input = '{"id":1}\n{"id":2}\n{"id":3}\n{"id":4}\n'
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
        { id: 2 },
        { id: 3 },
      ])
    })
  })

  describe('casting options', () => {
    it('should auto-cast values when cast is true', async () => {
      const parser = new JSONLParse({ cast: true })
      const input = '{"str":"123","bool":"true","null":"null","float":"3.14"}\n'
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
        { str: 123, bool: true, null: null, float: 3.14 },
      ])
    })

    it('should use custom cast function', async () => {
      const parser = new JSONLParse({
        cast: value => typeof value === 'string' ? value.toUpperCase() : value,
      })
      const input = '{"name":"alice","age":30}\n'
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
        { name: 'ALICE', age: 30 },
      ])
    })

    it('should cast dates when cast_date is true', async () => {
      const parser = new JSONLParse({ cast_date: true })
      const input = '{"created":"2023-01-01T00:00:00Z","name":"test"}\n'
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

      expect(results[0].created).toBeInstanceOf(Date)
      expect(results[0].name).toBe('test')
    })
  })

  describe('trimming options', () => {
    it('should trim whitespace when trim is true', async () => {
      const parser = new JSONLParse({ trim: true })
      const input = '  {"test": "value"}  \n   {"another": "data"}   \n'
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
        { test: 'value' },
        { another: 'data' },
      ])
    })

    it('should left trim when ltrim is true', async () => {
      const parser = new JSONLParse({ ltrim: true })
      const input = '   {"test": "value"}\n    {"another": "data"}\n'
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
        { test: 'value' },
        { another: 'data' },
      ])
    })
  })

  describe('callback options', () => {
    it('should call on_record for each record', async () => {
      const onRecord = vi.fn(record => ({ ...record, processed: true }))
      const parser = new JSONLParse({ on_record: onRecord })
      const input = '{"id":1}\n{"id":2}\n'
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

      expect(onRecord).toHaveBeenCalledTimes(2)
      expect(results).toEqual([
        { id: 1, processed: true },
        { id: 2, processed: true },
      ])
    })

    it('should call on_skip for errors in lenient mode', async () => {
      const onSkip = vi.fn()
      const parser = new JSONLParse({ strict: false, on_skip: onSkip })
      const input = '{"valid":1}\n{invalid json}\n{"valid":2}\n'
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

      expect(onSkip).toHaveBeenCalledTimes(1)
      expect(results).toEqual([
        { valid: 1 },
        { valid: 2 },
      ])
    })

    it('should filter records when on_record returns null', async () => {
      const parser = new JSONLParse({
        on_record: record => record.id > 2 ? record : null,
      })
      const input = '{"id":1}\n{"id":2}\n{"id":3}\n{"id":4}\n'
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
        { id: 3 },
        { id: 4 },
      ])
    })
  })

  describe('output enhancement options', () => {
    it('should include info when info is true', async () => {
      const parser = new JSONLParse({ info: true })
      const input = '{"test": 1}\n{"test": 2}\n'
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

      expect(results[0]).toHaveProperty('info')
      expect(results[0]).toHaveProperty('record')
      expect(results[0].info).toHaveProperty('lines')
      expect(results[0].info).toHaveProperty('records')
      expect(results[0].record).toEqual({ test: 1 })
    })

    it('should include raw line when raw is true', async () => {
      const parser = new JSONLParse({ raw: true })
      const input = '{"test": 1}\n'
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

      expect(results[0]).toHaveProperty('raw')
      expect(results[0]).toHaveProperty('record')
      expect(results[0].raw).toBe('{"test": 1}')
      expect(results[0].record).toEqual({ test: 1 })
    })

    it('should create nested objects with objname', async () => {
      const parser = new JSONLParse({ objname: 'id' })
      const input = '{"id":"user1","name":"Alice"}\n{"id":"user2","name":"Bob"}\n'
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
        { user1: { id: 'user1', name: 'Alice' } },
        { user2: { id: 'user2', name: 'Bob' } },
      ])
    })
  })

  describe('skip options', () => {
    it('should skip records with empty values', async () => {
      const parser = new JSONLParse({ skip_records_with_empty_values: true })
      const input = '{"name":"Alice","age":30}\n{"name":"","age":null}\n{"name":"Bob","age":25}\n'
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

    it('should skip records with errors', async () => {
      const parser = new JSONLParse({ skip_records_with_error: true })
      const input = '{"valid":1}\n{invalid json}\n{"valid":2}\n'
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
      const parser = new JSONLParse({ skipEmptyLines: false, strict: false })
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

      expect(results).toEqual([
        { test: 1 },
        { test: 2 },
      ])
    })
  })

  describe('error handling - strict mode', () => {
    it('should throw error on invalid JSON in strict mode', async () => {
      const parser = new JSONLParse({ strict: true })
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
      const parser = new JSONLParse({ strict: true, maxLineLength: 10 })
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
      const parser = new JSONLParse({ strict: true, maxLineLength: 10 })
      const input = 'x'.repeat(200)

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
      const parser = new JSONLParse({ strict: false })
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
      const parser = new JSONLParse({ strict: false, maxLineLength: 20 })
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

      const parser = new JSONLParse({ reviver })
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
      const parser = new JSONLParse({ encoding: 'ascii' })
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
      const parser = new JSONLParse()

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
    }, 15000)

    it('should handle streaming with backpressure', async () => {
      let processedCount = 0
      const totalItems = 50

      const input = `${Array.from({ length: totalItems }, (_, i) =>
        JSON.stringify({ id: i, data: 'x'.repeat(50) })).join('\n')}\n`

      const readable = Readable.from([input])
      const parser = new JSONLParse()

      readable.pipe(parser)

      parser.on('data', async () => {
        processedCount++
        await Promise.resolve()
      })

      await new Promise<void>((resolve, reject) => {
        parser.on('end', () => resolve())
        parser.on('error', reject)
      })

      expect(processedCount).toBe(totalItems)
    }, 15000)
  })
})
