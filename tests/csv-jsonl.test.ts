import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { describe, expect, it } from 'vitest'
import { createCSVToJSONLStream, CSVToJSONL } from '../src/converters/csv-jsonl'

// Helper function to collect stream output
async function collectStreamOutput(input: string, transformer: CSVToJSONL): Promise<string> {
  const chunks: string[] = []

  await pipeline(
    Readable.from([input]),
    transformer,
    new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk.toString())
        callback()
      },
    }),
  )

  return chunks.join('')
}

// Helper function to parse JSONL output
function parseJSONL(jsonl: string): any[] {
  return jsonl
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line))
}

describe('cSVToJSONL Transform Stream', () => {
  it('should transform basic CSV with headers to JSONL', async () => {
    const csv = `name,age,city
John,30,New York
Jane,25,Boston
Bob,35,Chicago`

    const transformer = new CSVToJSONL()
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records).toHaveLength(3)
    expect(records[0]).toEqual({ name: 'John', age: '30', city: 'New York' })
    expect(records[1]).toEqual({ name: 'Jane', age: '25', city: 'Boston' })
    expect(records[2]).toEqual({ name: 'Bob', age: '35', city: 'Chicago' })
  })

  it('should handle custom delimiters', async () => {
    const csv = `name;age;city
John;30;New York
Jane;25;Boston`

    const transformer = new CSVToJSONL({ delimiter: ';' })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ name: 'John', age: '30', city: 'New York' })
  })

  it('should handle quoted fields with commas', async () => {
    const csv = `name,description,price
"Widget A","A useful widget, very nice",29.99
"Widget B","Another widget, also good",39.99`

    const transformer = new CSVToJSONL()
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({
      name: 'Widget A',
      description: 'A useful widget, very nice',
      price: '29.99',
    })
  })

  it('should work with custom headers', async () => {
    const csv = `John,30,New York
Jane,25,Boston`

    const transformer = new CSVToJSONL({
      headers: ['name', 'age', 'city'],
    })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ name: 'John', age: '30', city: 'New York' })
  })

  it('should handle type casting', async () => {
    const csv = `name,age,active,salary
John,30,true,50000.50
Jane,25,false,45000.25`

    const transformer = new CSVToJSONL({
      cast: (value, context) => {
        if (context.column === 'age')
          return Number.parseInt(value)
        if (context.column === 'active')
          return value === 'true'
        if (context.column === 'salary')
          return Number.parseFloat(value)
        return value
      },
    })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({
      name: 'John',
      age: 30,
      active: true,
      salary: 50000.50,
    })
  })

  it('should skip empty lines', async () => {
    const csv = `name,age
John,30

Jane,25
`

    const transformer = new CSVToJSONL({ skipEmptyLines: true })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ name: 'John', age: '30' })
    expect(records[1]).toEqual({ name: 'Jane', age: '25' })
  })

  it('should apply custom replacer function', async () => {
    const csv = `name,password,email
John,secret123,john@example.com
Jane,mypassword,jane@example.com`

    const transformer = new CSVToJSONL({
      replacer: (key, value) => {
        if (key === 'password')
          return '[REDACTED]'
        return value
      },
    })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({
      name: 'John',
      password: '[REDACTED]',
      email: 'john@example.com',
    })
  })

  it('should flatten nested objects when enabled', async () => {
    const csv = `name,age
John,30`

    const transformer = new CSVToJSONL({
      flatten: true,
      // This test is more about the API - real flattening would need nested input
    })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({ name: 'John', age: '30' })
  })

  it('should add root key when specified', async () => {
    const csv = `name,age
John,30`

    const transformer = new CSVToJSONL({ rootKey: 'user' })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({
      user: { name: 'John', age: '30' },
    })
  })

  it('should respect maximum object size limit', async () => {
    const csv = `name,description
John,This is a very long description that exceeds the limit`

    const transformer = new CSVToJSONL({ maxObjectSize: 50 })

    await expect(
      collectStreamOutput(csv, transformer),
    ).rejects.toThrow(/Object size .* exceeds maximum 50/)
  })

  it('should handle empty CSV', async () => {
    const csv = ``

    const transformer = new CSVToJSONL()
    const result = await collectStreamOutput(csv, transformer)

    expect(result.trim()).toBe('')
  })

  it('should handle CSV with only headers', async () => {
    const csv = `name,age,city`

    const transformer = new CSVToJSONL()
    const result = await collectStreamOutput(csv, transformer)

    expect(result.trim()).toBe('')
  })

  it('should handle malformed CSV gracefully', async () => {
    const csv = `name,age
John,30
Jane,"25,extra`

    const transformer = new CSVToJSONL({
      skipRecordsWithError: true,
    })

    // Should not throw but might skip malformed records
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records.length).toBeGreaterThanOrEqual(1)
    expect(records[0]).toEqual({ name: 'John', age: '30' })
  })

  it('should trim whitespace when enabled', async () => {
    const csv = `name,age
 John , 30 
 Jane , 25 `

    const transformer = new CSVToJSONL({ trim: true })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({ name: 'John', age: '30' })
    expect(records[1]).toEqual({ name: 'Jane', age: '25' })
  })

  it('should work with factory function', async () => {
    const csv = `name,age
John,30`

    const transformer = createCSVToJSONLStream({ trim: true })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({ name: 'John', age: '30' })
  })

  it('should handle different encodings', async () => {
    const csv = `name,age
John,30`

    const transformer = new CSVToJSONL({ encoding: 'utf8' })
    const result = await collectStreamOutput(csv, transformer)
    const records = parseJSONL(result)

    expect(records[0]).toEqual({ name: 'John', age: '30' })
  })
})
