import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JSONToJSONL } from '../src/converters/json-jsonl'

describe('jSONToJSONL', () => {
  let converter: JSONToJSONL

  beforeEach(() => {
    converter = new JSONToJSONL()
  })

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const converter = new JSONToJSONL()
      expect(converter).toBeInstanceOf(JSONToJSONL)
    })

    it('should accept custom options', () => {
      const replacer = vi.fn()
      const converter = new JSONToJSONL({
        arrayPath: 'data.items',
        replacer,
        encoding: 'ascii',
        maxObjectSize: 1000,
        flatten: true,
        rootKey: 'root',
      })
      expect(converter).toBeInstanceOf(JSONToJSONL)
    })
  })

  describe('array conversion', () => {
    it('should convert JSON array to JSONL', async () => {
      const input = '[{"name":"Alice","age":30},{"name":"Bob","age":25}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        '{"name":"Alice","age":30}',
        '{"name":"Bob","age":25}',
      ])
    })

    it('should handle empty array', async () => {
      const input = '[]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const content = chunk.toString().trim()
            if (content)
              results.push(content)
            yield chunk
          }
        },
      )

      expect(results).toEqual([])
    })

    it('should handle single item array', async () => {
      const input = '[{"test":true}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual(['{"test":true}'])
    })
  })

  describe('single object conversion', () => {
    it('should convert single JSON object to JSONL line', async () => {
      const input = '{"name":"Alice","age":30}'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual(['{"name":"Alice","age":30}'])
    })

    it('should handle complex nested object', async () => {
      const input = '{"user":{"name":"Alice","details":{"age":30,"active":true}}}'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(1)
      expect(JSON.parse(results[0])).toEqual({
        user: { name: 'Alice', details: { age: 30, active: true } },
      })
    })
  })

  describe('arrayPath option', () => {
    it('should extract array from nested path', async () => {
      const converter = new JSONToJSONL({ arrayPath: 'data.users' })
      const input = '{"status":"ok","data":{"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}}'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        '{"id":1,"name":"Alice"}',
        '{"id":2,"name":"Bob"}',
      ])
    })

    it('should handle deep nested path', async () => {
      const converter = new JSONToJSONL({ arrayPath: 'response.payload.items' })
      const input = '{"response":{"payload":{"items":[{"test":1},{"test":2}]}}}'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual([
        '{"test":1}',
        '{"test":2}',
      ])
    })

    it('should throw error when path does not exist', async () => {
      const converter = new JSONToJSONL({ arrayPath: 'nonexistent.path' })
      const input = '{"data":{"users":[]}}'

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
      ).rejects.toThrow('Path "nonexistent.path" does not point to an array')
    })

    it('should throw error when path points to non-array', async () => {
      const converter = new JSONToJSONL({ arrayPath: 'data.user' })
      const input = '{"data":{"user":{"name":"Alice"}}}'

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
      ).rejects.toThrow('Path "data.user" does not point to an array')
    })
  })

  describe('flattening', () => {
    it('should flatten nested objects when flatten is true', async () => {
      const converter = new JSONToJSONL({ flatten: true })
      const input = '[{"user":{"name":"Alice","details":{"age":30}}}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(JSON.parse(results[0])).toEqual({
        'user.name': 'Alice',
        'user.details.age': 30,
      })
    })

    it('should handle arrays in flattened objects', async () => {
      const converter = new JSONToJSONL({ flatten: true })
      const input = '[{"user":{"name":"Alice","tags":["admin","user"]}}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(JSON.parse(results[0])).toEqual({
        'user.name': 'Alice',
        'user.tags': ['admin', 'user'],
      })
    })
  })

  describe('replacer function', () => {
    it('should apply replacer function to values', async () => {
      const replacer = vi.fn((key: string, value: any) => {
        if (key === 'password')
          return '[REDACTED]'
        if (typeof value === 'number')
          return value * 2
        return value
      })

      const converter = new JSONToJSONL({ replacer })
      const input = '[{"name":"Alice","age":30,"password":"secret"}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(replacer).toHaveBeenCalled()
      expect(JSON.parse(results[0])).toEqual({
        name: 'Alice',
        age: 60,
        password: '[REDACTED]',
      })
    })
  })

  describe('size limits', () => {
    it('should throw error when object exceeds maxObjectSize', async () => {
      const converter = new JSONToJSONL({ maxObjectSize: 50 })
      const largeObject = { data: 'x'.repeat(100) }
      const input = JSON.stringify([largeObject])

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
      ).rejects.toThrow('Object size')
    })
  })

  describe('rootKey option', () => {
    it('should wrap first object with rootKey', async () => {
      const converter = new JSONToJSONL({ rootKey: 'item' })
      const input = '{"name":"Alice","age":30}'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(JSON.parse(results[0])).toEqual({
        item: { name: 'Alice', age: 30 },
      })
    })
  })

  describe('error handling', () => {
    it('should throw error on invalid JSON input', async () => {
      const input = '{invalid json}'

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
      ).rejects.toThrow()
    })

    it('should handle empty input', async () => {
      const input = ''
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const content = chunk.toString().trim()
            if (content)
              results.push(content)
            yield chunk
          }
        },
      )

      expect(results).toEqual([])
    })

    it('should handle whitespace-only input', async () => {
      const input = '   \n\t  \n'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const content = chunk.toString().trim()
            if (content)
              results.push(content)
            yield chunk
          }
        },
      )

      expect(results).toEqual([])
    })
  })

  describe('encoding', () => {
    it('should handle different encodings', async () => {
      const converter = new JSONToJSONL({ encoding: 'ascii' })
      const input = '[{"ascii":true}]'
      const results: string[] = []

      const readable = Readable.from([Buffer.from(input, 'ascii')])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toEqual(['{"ascii":true}'])
    })
  })

  describe('complex scenarios', () => {
    it('should handle large arrays efficiently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` }))
      const input = JSON.stringify(items)
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(100)
      expect(JSON.parse(results[0])).toEqual({ id: 0, value: 'item_0' })
      expect(JSON.parse(results[99])).toEqual({ id: 99, value: 'item_99' })
    })

    it('should handle mixed data types in array', async () => {
      const input = '[{"type":"string","value":"hello"},{"type":"number","value":42},{"type":"boolean","value":true},{"type":"null","value":null}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(results).toHaveLength(4)
      expect(JSON.parse(results[0])).toEqual({ type: 'string', value: 'hello' })
      expect(JSON.parse(results[1])).toEqual({ type: 'number', value: 42 })
      expect(JSON.parse(results[2])).toEqual({ type: 'boolean', value: true })
      expect(JSON.parse(results[3])).toEqual({ type: 'null', value: null })
    })

    it('should handle Unicode characters', async () => {
      const input = '[{"emoji":"🚀","chinese":"你好","math":"∑∆"}]'
      const results: string[] = []

      const readable = Readable.from([input])

      await pipeline(
        readable,
        converter,
        async function* (source) {
          for await (const chunk of source) {
            const lines = chunk.toString().split('\n').filter(line => line.trim())
            results.push(...lines)
            yield chunk
          }
        },
      )

      expect(JSON.parse(results[0])).toEqual({
        emoji: '🚀',
        chinese: '你好',
        math: '∑∆',
      })
    })
  })
})
