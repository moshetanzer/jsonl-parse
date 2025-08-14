import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { JSONLToJSON } from '../src/converters/jsonl-json'

describe('jSONLToJSON', () => {
  let converter: JSONLToJSON

  beforeEach(() => {
    converter = new JSONLToJSON()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const converter = new JSONLToJSON()
      expect(converter).toBeInstanceOf(JSONLToJSON)
    })

    it('should accept custom options', () => {
      const converter = new JSONLToJSON({
        arrayWrapper: false,
        arrayName: 'items',
        pretty: true,
        space: 4,
        encoding: 'ascii',
        maxObjects: 1000,
      })
      expect(converter).toBeInstanceOf(JSONLToJSON)
    })
  })

  describe('basic conversion', () => {
    it('should convert JSONL to JSON array', async () => {
      const input = '{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
    })

    it('should handle single JSONL line', async () => {
      const input = '{"name":"Alice","age":30}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { name: 'Alice', age: 30 },
      ])
    })

    it('should handle line without trailing newline', async () => {
      const input = '{"test": true}'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([{ test: true }])
    })

    it('should handle multiple chunks', async () => {
      const chunks = [
        '{"name":"A',
        'lice","age":30}\n{"na',
        'me":"Bob","age":25}\n',
      ]
      let result = ''

      const readable = Readable.from(chunks)

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ])
    })
  })

  describe('arrayWrapper option', () => {
    it('should wrap objects in array by default', async () => {
      const input = '{"test": 1}\n{"test": 2}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      const parsed = JSON.parse(result)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toEqual([{ test: 1 }, { test: 2 }])
    })

    it('should not wrap in array when arrayWrapper is false', async () => {
      const converter = new JSONLToJSON({ arrayWrapper: false })
      const input = '{"test": true}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual({ test: true })
    })

    it('should return array when arrayWrapper is false but multiple objects', async () => {
      const converter = new JSONLToJSON({ arrayWrapper: false })
      const input = '{"test": 1}\n{"test": 2}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([{ test: 1 }, { test: 2 }])
    })
  })

  describe('arrayName option', () => {
    it('should wrap array with custom name', async () => {
      const converter = new JSONLToJSON({ arrayName: 'items' })
      const input = '{"id": 1}\n{"id": 2}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual({
        items: [{ id: 1 }, { id: 2 }],
      })
    })

    it('should work with single object and arrayName', async () => {
      const converter = new JSONLToJSON({ arrayName: 'data' })
      const input = '{"test": true}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual({
        data: [{ test: true }],
      })
    })
  })

  describe('pretty printing', () => {
    it('should format output with indentation when pretty is true', async () => {
      const converter = new JSONLToJSON({ pretty: true })
      const input = '{"name":"Alice"}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(result).toContain('  ')
      expect(result).toContain('\n')
      expect(JSON.parse(result)).toEqual([{ name: 'Alice' }])
    })

    it('should use custom space option', async () => {
      const converter = new JSONLToJSON({ pretty: true, space: 4 })
      const input = '{"name":"Alice"}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(result).toContain('    ')
    })

    it('should use string as space option', async () => {
      const converter = new JSONLToJSON({ pretty: true, space: '\t' })
      const input = '{"test":true}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(result).toContain('\t')
    })
  })

  describe('line ending handling', () => {
    it('should handle Unix line endings (LF)', async () => {
      const input = '{"unix": true}\n{"test": "lf"}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { unix: true },
        { test: 'lf' },
      ])
    })

    it('should handle Windows line endings (CRLF)', async () => {
      const input = '{"windows": true}\r\n{"test": "crlf"}\r\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { windows: true },
        { test: 'crlf' },
      ])
    })

    it('should handle mixed line endings', async () => {
      const input = '{"mixed": true}\r\n{"test": "both"}\n{"final": true}\r\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toHaveLength(3)
    })
  })

  describe('empty line handling', () => {
    it('should skip empty lines', async () => {
      const input = '{"test": 1}\n\n{"test": 2}\n   \n{"test": 3}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { test: 1 },
        { test: 2 },
        { test: 3 },
      ])
    })

    it('should handle input with only empty lines', async () => {
      const input = '\n\n   \n\t\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([])
    })
  })

  describe('error handling', () => {
    it('should throw error on invalid JSON line', async () => {
      const input = '{"valid": true}\n{invalid json}\n{"more": "data"}\n'

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          converter,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Invalid JSON line')
    })

    it('should throw error on invalid JSON in final line', async () => {
      const input = '{"valid": true}\n{invalid final'

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          converter,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Invalid JSON in final line')
    })

    it('should handle empty input', async () => {
      const input = ''
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([])
    })

    it('should handle whitespace-only input', async () => {
      const input = '   \n\t  \n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([])
    })
  })

  describe('maxObjects limit', () => {
    it('should throw error when exceeding maxObjects limit', async () => {
      const converter = new JSONLToJSON({ maxObjects: 2 })
      const input = '{"id": 1}\n{"id": 2}\n{"id": 3}\n'

      const readable = Readable.from([input])

      await expect(
        pipeline(
          readable,
          converter,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk
            }
          },
        ),
      ).rejects.toThrow('Maximum object limit 2 exceeded')
    })

    it('should work within maxObjects limit', async () => {
      const converter = new JSONLToJSON({ maxObjects: 5 })
      const input = '{"id": 1}\n{"id": 2}\n{"id": 3}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ])
    })
  })

  describe('encoding', () => {
    it('should handle different encodings', async () => {
      const converter = new JSONLToJSON({ encoding: 'ascii' })
      const input = '{"ascii": true}\n'
      let result = ''

      const readable = Readable.from([Buffer.from(input, 'ascii')])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([{ ascii: true }])
    })
  })

  describe('complex scenarios', () => {
    it('should handle large number of objects efficiently', async () => {
      const lines = Array.from({ length: 100 }, (_, i) =>
        JSON.stringify({ id: i, value: `item_${i}` }))
      const input = `${lines.join('\n')}\n`
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(100)
      expect(parsed[0]).toEqual({ id: 0, value: 'item_0' })
      expect(parsed[99]).toEqual({ id: 99, value: 'item_99' })
    })

    it('should handle mixed data types', async () => {
      const input = `{"type":"string","value":"hello"}
{"type":"number","value":42}
{"type":"boolean","value":true}
{"type":"null","value":null}
{"type":"array","value":[1,2,3]}
{"type":"object","value":{"nested":true}}
`
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([
        { type: 'string', value: 'hello' },
        { type: 'number', value: 42 },
        { type: 'boolean', value: true },
        { type: 'null', value: null },
        { type: 'array', value: [1, 2, 3] },
        { type: 'object', value: { nested: true } },
      ])
    })

    it('should handle Unicode characters', async () => {
      const input = '{"emoji":"🚀","chinese":"你好","math":"∑∆"}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([{
        emoji: '🚀',
        chinese: '你好',
        math: '∑∆',
      }])
    })

    it('should handle very large JSON objects', async () => {
      const largeObject = {
        data: 'x'.repeat(1000),
        array: Array.from({ length: 50 }).fill(0).map((_, i) => ({ id: i, value: `item_${i}` })),
      }
      const input = `${JSON.stringify(largeObject)}\n`
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([largeObject])
    })

    it('should handle nested objects with deep structure', async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep nested value',
                array: [1, 2, { nested: true }],
              },
            },
          },
        },
      }
      const input = `${JSON.stringify(deepObject)}\n`
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(JSON.parse(result)).toEqual([deepObject])
    })
  })

  describe('streaming behavior', () => {
    it('should handle streaming with backpressure', async () => {
      let processedObjects = 0
      const totalItems = 50

      const input = `${Array.from({ length: totalItems }, (_, i) =>
        JSON.stringify({ id: i, data: 'x'.repeat(50) })).join('\n')}\n`

      const readable = Readable.from([input])
      const converter = new JSONLToJSON()

      readable.pipe(converter)

      converter.on('data', async () => {
        processedObjects++
        await Promise.resolve()
      })

      await new Promise<void>((resolve, reject) => {
        converter.on('end', () => resolve())
        converter.on('error', reject)
      })

      expect(processedObjects).toBe(1) // All objects collected into one JSON array
    })

    it('should preserve object order', async () => {
      const objects = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        timestamp: Date.now() + i,
        order: i,
      }))
      const input = `${objects.map(obj => JSON.stringify(obj)).join('\n')}\n`
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(10)

      for (let i = 0; i < 10; i++) {
        expect(parsed[i].order).toBe(i)
      }
    })
  })

  describe('combined options', () => {
    it('should work with arrayName and pretty printing', async () => {
      const converter = new JSONLToJSON({
        arrayName: 'results',
        pretty: true,
        space: 2,
      })
      const input = '{"id": 1}\n{"id": 2}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(result).toContain('  ')
      expect(result).toContain('"results"')
      expect(JSON.parse(result)).toEqual({
        results: [{ id: 1 }, { id: 2 }],
      })
    })

    it('should work with all options combined', async () => {
      const converter = new JSONLToJSON({
        arrayWrapper: true,
        arrayName: 'data',
        pretty: true,
        space: 4,
        maxObjects: 10,
      })
      const input = '{"test": 1}\n{"test": 2}\n'
      let result = ''

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            result += chunk.toString()
            yield chunk
          }
        },
      )

      expect(result).toContain('    ')
      expect(JSON.parse(result)).toEqual({
        data: [{ test: 1 }, { test: 2 }],
      })
    })
  })
})
