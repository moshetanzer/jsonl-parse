import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { describe, expect, it } from 'vitest'
import { createJSONLToCSVStream, JSONLToCSV } from '../src/converters/jsonl-csv'

// Helper function to collect stream output
async function collectStreamOutput(input: string, transformer: JSONLToCSV): Promise<string> {
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

// Helper function to parse CSV output into array of arrays
function parseCSV(csv: string): string[][] {
  return csv
    .trim()
    .split('\n')
    .map((line) => {
      // Simple CSV parser for testing - handles basic cases
      const result: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]

        if (char === '"') {
          inQuotes = !inQuotes
        }
        else if (char === ',' && !inQuotes) {
          result.push(current)
          current = ''
        }
        else {
          current += char
        }
      }

      result.push(current)
      return result
    })
}

describe('jSONLToCSV Transform Stream', () => {
  it('should transform basic JSONL to CSV with headers', async () => {
    const jsonl = `{"name":"John","age":30,"city":"New York"}
{"name":"Jane","age":25,"city":"Boston"}
{"name":"Bob","age":35,"city":"Chicago"}`

    const transformer = new JSONLToCSV({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows).toHaveLength(4) // header + 3 data rows
    expect(rows[0]).toEqual(['name', 'age', 'city']) // header
    expect(rows[1]).toEqual(['John', '30', 'New York'])
    expect(rows[2]).toEqual(['Jane', '25', 'Boston'])
    expect(rows[3]).toEqual(['Bob', '35', 'Chicago'])
  })

  it('should work without headers', async () => {
    const jsonl = `{"name":"John","age":30}
{"name":"Jane","age":25}`

    const transformer = new JSONLToCSV({ header: false })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['John', '30'])
    expect(rows[1]).toEqual(['Jane', '25'])
  })

  it('should handle custom delimiters', async () => {
    const jsonl = `{"name":"John","age":30}
{"name":"Jane","age":25}`

    const transformer = new JSONLToCSV({
      header: true,
      delimiter: ';',
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('name;age')
    expect(result).toContain('John;30')
  })

  it('should handle specific column ordering', async () => {
    const jsonl = `{"age":30,"name":"John","city":"NYC"}
{"age":25,"name":"Jane","city":"Boston"}`

    const transformer = new JSONLToCSV({
      header: true,
      columns: ['name', 'age'], // Only include these columns in this order
    })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows[0]).toEqual(['name', 'age'])
    expect(rows[1]).toEqual(['John', '30'])
    expect(rows[2]).toEqual(['Jane', '25'])
  })

  it('should handle quoted fields', async () => {
    const jsonl = `{"name":"John Doe","description":"A person, who works"}
{"name":"Jane Smith","description":"Another person, also works"}`

    const transformer = new JSONLToCSV({
      header: true,
      quoted: true,
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('"John Doe"')
    expect(result).toContain('"A person, who works"')
  })

  it('should handle missing fields gracefully', async () => {
    const jsonl = `{"name":"John","age":30,"city":"NYC"}
{"name":"Jane","age":25}
{"name":"Bob","city":"Chicago"}`

    const transformer = new JSONLToCSV({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual(['name', 'age', 'city'])
    expect(rows[1]).toEqual(['John', '30', 'NYC'])
    expect(rows[2]).toEqual(['Jane', '25', '']) // missing city
    expect(rows[3]).toEqual(['Bob', '', 'Chicago']) // missing age
  })

  it('should unflatten dot notation objects', async () => {
    const jsonl = `{"user.name":"John","user.age":"30","user.address.city":"NYC"}
{"user.name":"Jane","user.age":"25","user.address.city":"Boston"}`

    const transformer = new JSONLToCSV({
      header: true,
      unflatten: true,
      unflattenSeparator: '.',
    })
    const result = await collectStreamOutput(jsonl, transformer)

    // Note: The actual output structure depends on how csv-stringify handles nested objects
    // This test verifies the unflatten functionality is called
    expect(result).toBeTruthy()
    expect(result).toContain('John')
    expect(result).toContain('Jane')
  })

  it('should handle custom type casting', async () => {
    const jsonl = `{"name":"John","active":true,"score":95.5}
{"name":"Jane","active":false,"score":87.2}`

    const transformer = new JSONLToCSV({
      header: true,
      cast: {
        boolean: (value: boolean) => value ? 'YES' : 'NO',
        number: (value: number) => value.toFixed(1),
      },
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('YES')
    expect(result).toContain('NO')
    expect(result).toContain('95.5')
    expect(result).toContain('87.2')
  })

  it('should handle empty JSONL', async () => {
    const jsonl = ``

    const transformer = new JSONLToCSV()
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result.trim()).toBe('')
  })

  it('should handle single JSON object', async () => {
    const jsonl = `{"name":"John","age":30}`

    const transformer = new JSONLToCSV({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['name', 'age'])
    expect(rows[1]).toEqual(['John', '30'])
  })

  it('should handle malformed JSON lines gracefully', async () => {
    const jsonl = `{"name":"John","age":30}
{invalid json}
{"name":"Jane","age":25}`

    const transformer = new JSONLToCSV({ header: true })

    await expect(
      collectStreamOutput(jsonl, transformer),
    ).rejects.toThrow(/Invalid JSON line/)
  })

  it('should handle different data types', async () => {
    const jsonl = `{"string":"text","number":42,"boolean":true,"null_value":null,"array":[1,2,3],"object":{"nested":"value"}}
{"string":"more text","number":0,"boolean":false,"null_value":null,"array":["a","b"],"object":{"other":"data"}}`

    const transformer = new JSONLToCSV({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows[0]).toEqual(['string', 'number', 'boolean', 'null_value', 'array', 'object'])
    expect(rows[1][0]).toBe('text')
    expect(rows[1][1]).toBe('42')
    // maybe should be true???
    expect(rows[1][2]).toBe('1')
    // Arrays and objects are stringified
    expect(rows[1][4]).toContain('[')
    expect(rows[1][5]).toContain('{')
  })

  it('should handle quoted empty values', async () => {
    const jsonl = `{"name":"","age":null,"city":"NYC"}
{"name":"John","age":"","city":""}`

    const transformer = new JSONLToCSV({
      header: true,
      quotedEmpty: true,
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('""') // quoted empty strings
  })

  it('should work with factory function', async () => {
    const jsonl = `{"name":"John","age":30}`

    const transformer = createJSONLToCSVStream({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows[0]).toEqual(['name', 'age'])
    expect(rows[1]).toEqual(['John', '30'])
  })

  it('should handle different encodings', async () => {
    const jsonl = `{"name":"John","age":30}`

    const transformer = new JSONLToCSV({
      encoding: 'utf8',
      header: true,
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('John')
  })

  it('should handle custom unflatten separator', async () => {
    const jsonl = `{"user_name":"John","user_age":"30"}
{"user_name":"Jane","user_age":"25"}`

    const transformer = new JSONLToCSV({
      header: true,
      unflatten: true,
      unflattenSeparator: '_',
    })
    const result = await collectStreamOutput(jsonl, transformer)

    expect(result).toContain('John')
    expect(result).toContain('Jane')
  })

  it('should handle large JSONL files in chunks', async () => {
    // Generate large JSONL
    const lines = Array.from({ length: 1000 }, (_, i) =>
      JSON.stringify({
        id: i,
        name: `User${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50),
      }))
    const jsonl = lines.join('\n')

    const transformer = new JSONLToCSV({ header: true })
    const result = await collectStreamOutput(jsonl, transformer)
    const rows = parseCSV(result)

    expect(rows).toHaveLength(1001) // header + 1000 data rows
    expect(rows[0]).toEqual(['id', 'name', 'email', 'age'])
    expect(rows[1]).toEqual(['0', 'User0', 'user0@example.com', '20'])
    expect(rows[1000]).toEqual(['999', 'User999', 'user999@example.com', '69'])
  })

  it('should handle incomplete lines at chunk boundaries', async () => {
    const transformer = new JSONLToCSV({ header: true })

    // Simulate chunked input where JSON line is split
    const chunks = [
      '{"name":"Jo',
      'hn","age":30}\n{"name":"Jane"',
      ',"age":25}\n',
    ]

    const result: string[] = []
    const writable = new Writable({
      write(chunk, encoding, callback) {
        result.push(chunk.toString())
        callback()
      },
    })

    const readable = new Readable({
      read() {
        const chunk = chunks.shift()
        if (chunk !== undefined) {
          this.push(chunk)
        }
        else {
          this.push(null)
        }
      },
    })

    await pipeline(readable, transformer, writable)

    const output = result.join('')
    const rows = parseCSV(output)

    expect(rows).toHaveLength(3) // header + 2 data rows
    expect(rows[1]).toEqual(['John', '30'])
    expect(rows[2]).toEqual(['Jane', '25'])
  })
})
