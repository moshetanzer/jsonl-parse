import type {
  JSONLSchema,
} from '../src/validator/validator'
import { describe, expect, it } from 'vitest'
import {
  createJSONLValidatorStream,
  JSONLValidator,
  validateJSONL,
} from '../src/validator/validator'

describe('jSONLValidator', () => {
  it('validates valid JSONL input', () => {
    const input = '{"a":1}\n{"b":2}\n'
    const result = validateJSONL(input)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.totalLines).toBe(2)
    expect(result.validLines).toBe(2)
    expect(result.invalidLines).toBe(0)
  })

  it('detects invalid JSON', () => {
    const input = '{"a":1}\n{b:2}\n'
    const result = validateJSONL(input)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0].message).toMatch(/Invalid JSON/)
    expect(result.invalidLines).toBe(1)
  })

  it('enforces maxLineLength', () => {
    const input = `{"a":1}\n${'{"b":2}'.repeat(1000)}\n`
    const result = validateJSONL(input, { maxLineLength: 10 })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Line length'))).toBe(true)
  })

  it('enforces maxObjects', () => {
    const validator = new JSONLValidator({ maxObjects: 1 })
    let error: Error | null = null
    validator.on('error', (err) => {
      error = err
    })
    validator.write('{"a":1}\n{"b":2}\n')
    validator.end()
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/Maximum object limit/)
  })

  it('disallows empty lines if allowEmptyLines is false', () => {
    const input = '{"a":1}\n\n{"b":2}\n'
    const result = validateJSONL(input, { allowEmptyLines: false })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message === 'Empty lines not allowed')).toBe(true)
  })

  it('strictMode: detects leading/trailing whitespace', () => {
    const input = ' {"a":1}\n{"b":2} \n'
    const result = validateJSONL(input, { strictMode: true })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('whitespace'))).toBe(true)
  })

  it('validates against schema: required fields', () => {
    const schema: JSONLSchema = {
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'number' },
      },
    }
    const input = '{"bar":1}\n{"foo":2}\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('Missing required field'))).toBe(true)
    expect(result.validLines).toBe(1)
    expect(result.invalidLines).toBe(1)
  })

  it('validates against schema: type mismatch', () => {
    const schema: JSONLSchema = { type: 'object' }
    const input = '"not an object"\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toMatch(/Expected type object/)
  })

  it('validates string schema constraints', () => {
    const schema: JSONLSchema = {
      type: 'string',
      minLength: 3,
      maxLength: 5,
      pattern: /^foo/,
    }
    const input = '"fo"\n"foobar"\n"bar"\n"food"\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(4)
    expect(result.validLines).toBe(1)
  })

  it('validates number schema constraints', () => {
    const schema: JSONLSchema = {
      type: 'number',
      minimum: 10,
      maximum: 20,
    }
    const input = '5\n15\n25\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(2)
    expect(result.validLines).toBe(1)
  })

  it('validates enum constraint', () => {
    const schema: JSONLSchema = {
      enum: [1, 2, 3],
    }
    const input = '1\n4\n2\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(1)
    expect(result.validLines).toBe(2)
  })

  it('validates array items schema', () => {
    const schema: JSONLSchema = {
      type: 'array',
      items: { type: 'number', minimum: 0 },
    }
    const input = '[1,2,3]\n[-1,2,3]\n'
    const result = validateJSONL(input, { schema })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.message.includes('less than minimum'))).toBe(true)
  })

  it('createJSONLValidatorStream returns a stream', () => {
    const stream = createJSONLValidatorStream()
    expect(stream).toBeInstanceOf(JSONLValidator)
  })
})

// We recommend installing an extension to run vitest tests.
