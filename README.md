# JSONLParse

A high-performance, memory-safe TypeScript/JavaScript streaming parser for JSONL (JSON Lines) files with extensive configuration options inspired by csv-parse. Included is a JSONL validator and converters to and from JSON and CSV.

## Features

- 🚀 **High Performance**: Native Node.js streams with minimal overhead
- 🛡️ **Memory Safe**: Built-in protection against memory exhaustion
- 📝 **TypeScript Support**: Full type definitions and interfaces
- 🔧 **Highly Configurable**: Extensive options for data transformation and filtering
- 🌍 **Cross-Platform**: Handles both Unix (`\n`) and Windows (`\r\n`) line endings
- ⚡ **Streaming**: Process large files without loading everything into memory
- 🎯 **Robust Error Handling**: Multiple error handling strategies
- 📊 **Data Processing**: Built-in casting, trimming, and transformation capabilities
- 🔍 **Flexible Filtering**: Record and line-based filtering options
- 🔄 **Format Converters**: Built-in converters between JSONL, JSON, and CSV formats

## Installation

```bash
npm install jsonl-parse
# or
yarn add jsonl-parse
```

## Quick Start

```typescript
import { createReadStream } from 'node:fs'
import { JSONLParse } from 'jsonl-parse'

const parser = new JSONLParse()

createReadStream('data.jsonl')
  .pipe(parser)
  .on('data', (obj) => {
    console.log('Parsed object:', obj)
  })
  .on('error', (err) => {
    console.error('Parse error:', err.message)
  })
  .on('end', () => {
    console.log('Parsing complete!')
  })
```

## API Reference

### Constructor

```typescript
new JSONLParse(options?: JSONLParseOptions)
```

### JSONLParseOptions

#### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strict` | `boolean` | `true` | If `true`, stops on first invalid JSON. If `false`, skips invalid lines |
| `reviver` | `function` | `null` | Optional reviver function passed to `JSON.parse` |
| `skipEmptyLines` | `boolean` | `true` | If `true`, trims whitespace and skips empty lines |
| `maxLineLength` | `number` | `Infinity` | Maximum line length to prevent memory issues |
| `encoding` | `BufferEncoding` | `'utf8'` | Encoding for chunk conversion |

#### Column/Header Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `columns` | `string[]` \| `boolean` \| `function` | `null` | Convert arrays to objects. `true` uses first line as headers, array provides column names, function generates names |

#### Record Filtering Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `from` | `number` | `null` | Start processing from record number (1-based) |
| `to` | `number` | `null` | Stop processing at record number (1-based) |
| `from_line` | `number` | `null` | Start processing from line number (1-based) |
| `to_line` | `number` | `null` | Stop processing at line number (1-based) |

#### Data Transformation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cast` | `boolean` \| `function` | `null` | Auto-convert strings to native types or use custom function |
| `cast_date` | `boolean` \| `function` | `null` | Convert date strings to Date objects |
| `ltrim` | `boolean` | `false` | Left-trim whitespace from lines |
| `rtrim` | `boolean` | `false` | Right-trim whitespace from lines |
| `trim` | `boolean` | `false` | Trim whitespace from both ends of lines |

#### Callback Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `on_record` | `function` | `null` | Transform/filter each record. Return `null` to skip |
| `on_skip` | `function` | `null` | Called when records are skipped due to errors |

#### Output Enhancement Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `info` | `boolean` | `false` | Include parsing metadata (line/record counts) |
| `raw` | `boolean` | `false` | Include original line text |
| `objname` | `string` | `null` | Create nested objects keyed by field value |

#### Skip Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skip_records_with_empty_values` | `boolean` | `false` | Skip records where all values are empty |
| `skip_records_with_error` | `boolean` | `false` | Continue processing when encountering invalid records |

## Usage Examples

### Basic Usage

```typescript
import { createReadStream } from 'node:fs'
import { JSONLParse } from 'jsonl-parse'

const parser = new JSONLParse()
createReadStream('data.jsonl').pipe(parser)
```

### Array to Object Conversion with Headers

```typescript
// Input: ["name","age","email"]
//        ["Alice",30,"alice@test.com"]
//        ["Bob",25,"bob@test.com"]

const parser = new JSONLParse({ columns: true })

// Output: {name: "Alice", age: 30, email: "alice@test.com"}
//         {name: "Bob", age: 25, email: "bob@test.com"}
```

### Custom Column Names

```typescript
const parser = new JSONLParse({
  columns: ['id', 'name', 'email']
})

// Converts arrays to objects with specified keys
```

### Data Type Casting

```typescript
const parser = new JSONLParse({
  cast: true, // Auto-convert strings to numbers, booleans, null
  cast_date: true, // Convert date strings to Date objects
})

// Input: {"age": "30", "active": "true", "created": "2023-01-01"}
// Output: {age: 30, active: true, created: Date object}
```

### Record Filtering

```typescript
const parser = new JSONLParse({
  from: 10, // Start from 10th record
  to: 100, // Stop at 100th record
  from_line: 5, // Start from 5th line
  to_line: 200 // Stop at 200th line
})
```

### Custom Record Processing

```typescript
const parser = new JSONLParse({
  on_record: (record, context) => {
    // Transform each record
    return {
      ...record,
      processed_at: new Date(),
      line_number: context.lines
    }
  }
})
```

### Error Handling with Callbacks

```typescript
const parser = new JSONLParse({
  strict: false,
  on_skip: (error, line) => {
    console.warn(`Skipped invalid line: ${line.slice(0, 50)}...`)
    console.warn(`Error: ${error.message}`)
  }
})
```

### Enhanced Output with Metadata

```typescript
const parser = new JSONLParse({
  info: true, // Include parsing metadata
  raw: true // Include original line text
})

// Output: {
//   info: { lines: 1, records: 1, invalid_field_length: 0 },
//   raw: '{"name": "Alice"}',
//   record: { name: "Alice" }
// }
```

### Whitespace Handling

```typescript
const parser = new JSONLParse({
  trim: true, // Trim both ends
  // or
  ltrim: true, // Left trim only
  rtrim: true, // Right trim only
})
```

### Skip Empty Records

```typescript
const parser = new JSONLParse({
  skip_records_with_empty_values: true // Skip records with all empty/null values
})
```

### Nested Object Creation

```typescript
const parser = new JSONLParse({
  objname: 'id' // Use 'id' field as object key
})

// Input: {"id": "user1", "name": "Alice"}
// Output: { user1: {"id": "user1", "name": "Alice"} }
```

### Memory-Safe Processing

```typescript
const safeParser = new JSONLParse({
  maxLineLength: 1024 * 1024, // 1MB per line maximum
  strict: false, // Skip overly long lines instead of erroring
  skip_records_with_error: true // Continue on any parsing errors
})
```

### Complex Data Pipeline

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const parser = new JSONLParse({
  columns: true, // First line as headers
  cast: true, // Auto-convert types
  cast_date: true, // Convert dates
  trim: true, // Trim whitespace
  from: 2, // Skip first data record
  skip_records_with_empty_values: true,
  on_record: (record) => {
    // Filter and transform
    if (record.status !== 'active')
      return null
    return { ...record, processed: true }
  },
  info: true // Include metadata
})

const processor = new Transform({
  objectMode: true,
  transform(data, encoding, callback) {
    // Access both metadata and record
    const { info, record } = data
    const output = {
      ...record,
      metadata: info,
      processed_at: new Date().toISOString()
    }
    callback(null, `${JSON.stringify(output)}\n`)
  }
})

await pipeline(
  createReadStream('input.jsonl'),
  parser,
  processor,
  createWriteStream('output.jsonl')
)
```

### Async Iterator Usage

```typescript
import { Readable } from 'node:stream'

const parser = new JSONLParse({
  cast: true,
  on_record: record => record.priority === 'high' ? record : null
})

const readable = Readable.from(createReadStream('data.jsonl').pipe(parser))

for await (const obj of readable) {
  console.log('High priority object:', obj)
  await processHighPriorityObject(obj)
}
```

## JSONL Validator

JSONLParse includes a comprehensive validator for ensuring JSONL file integrity and schema compliance.

### JSONLValidator - Validate JSONL Files

Validate JSONL files with comprehensive error reporting and optional schema validation.

```typescript
import { createReadStream } from 'node:fs'
import { JSONLValidator } from 'jsonl-parse'

const validator = new JSONLValidator({
  strictMode: true,
  schema: {
    type: 'object',
    required: ['id', 'name'],
    properties: {
      id: { type: 'number', minimum: 1 },
      name: { type: 'string', minLength: 1 },
      email: { type: 'string', pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/ }
    }
  }
})

createReadStream('data.jsonl')
  .pipe(validator)
  .on('data', (result) => {
    const validation = JSON.parse(result.toString())
    console.log(`Valid: ${validation.valid}`)
    console.log(`Total lines: ${validation.totalLines}`)
    console.log(`Valid lines: ${validation.validLines}`)
    console.log(`Invalid lines: ${validation.invalidLines}`)

    if (validation.errors.length > 0) {
      console.log('Errors:', validation.errors)
    }
  })
```

#### JSONLValidatorOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | `BufferEncoding` | `'utf8'` | Text encoding |
| `maxLineLength` | `number` | `1048576` | Maximum line length (1MB) |
| `maxObjects` | `number` | `Infinity` | Maximum objects to validate |
| `strictMode` | `boolean` | `false` | Strict validation (no whitespace, newlines) |
| `allowEmptyLines` | `boolean` | `true` | Allow empty lines |
| `schema` | `JSONLSchema` | `null` | JSON schema for validation |

#### JSONLSchema Interface

```typescript
interface JSONLSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  required?: string[] // Required object properties
  properties?: Record<string, JSONLSchema> // Object property schemas
  items?: JSONLSchema // Array item schema
  minLength?: number // Minimum string/array length
  maxLength?: number // Maximum string/array length
  pattern?: RegExp // String pattern matching
  minimum?: number // Minimum numeric value
  maximum?: number // Maximum numeric value
  enum?: any[] // Allowed values
}
```

#### ValidationResult Interface

```typescript
interface ValidationResult {
  valid: boolean // Overall validation result
  errors: ValidationError[] // List of validation errors
  totalLines: number // Total lines processed
  validLines: number // Number of valid lines
  invalidLines: number // Number of invalid lines
}

interface ValidationError {
  line: number // Line number (1-based)
  column?: number // Column position for JSON errors
  message: string // Error description
  value?: any // Invalid value
  schema?: JSONLSchema // Schema that failed
}
```

### Validator Usage Examples

#### Basic Validation

```typescript
import { validateJSONL } from 'jsonl-parse'

const jsonlData = `
{"id": 1, "name": "Alice"}
{"id": 2, "name": "Bob"}
invalid json line
{"id": 3, "name": "Charlie"}
`

const result = validateJSONL(jsonlData, {
  strictMode: false,
  allowEmptyLines: true
})

console.log(`${result.validLines}/${result.totalLines} lines valid`)
// Output: 3/4 lines valid

result.errors.forEach((error) => {
  console.log(`Line ${error.line}: ${error.message}`)
})
// Output: Line 3: Invalid JSON: Unexpected token i in JSON at position 0
```

#### Schema Validation

```typescript
const userSchema = {
  type: 'object',
  required: ['id', 'name', 'email'],
  properties: {
    id: {
      type: 'number',
      minimum: 1
    },
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 50
    },
    email: {
      type: 'string',
      pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
    },
    age: {
      type: 'number',
      minimum: 0,
      maximum: 150
    },
    status: {
      type: 'string',
      enum: ['active', 'inactive', 'pending']
    }
  }
}

const validator = new JSONLValidator({
  schema: userSchema,
  strictMode: true
})

// Will validate each line against the schema
```

#### Streaming Validation

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const validator = new JSONLValidator({
  maxLineLength: 1024 * 10, // 10KB per line
  maxObjects: 10000, // Limit validation to 10k objects
  schema: {
    type: 'object',
    required: ['timestamp', 'level', 'message'],
    properties: {
      timestamp: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
      level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      message: { type: 'string', minLength: 1 },
      metadata: { type: 'object' }
    }
  }
})

await pipeline(
  createReadStream('logs.jsonl'),
  validator,
  createWriteStream('validation-report.json')
)
```

#### Strict Mode Validation

```typescript
const strictValidator = new JSONLValidator({
  strictMode: true, // No whitespace, perfect formatting
  allowEmptyLines: false, // No empty lines allowed
  maxLineLength: 1000 // Reasonable line length limit
})

const result = validateJSONL('  {"valid": true}  \n', {
  strictMode: true
})

// Will report: "Line has leading or trailing whitespace"
```

#### Complex Schema Example

```typescript
const apiResponseSchema = {
  type: 'object',
  required: ['status', 'data'],
  properties: {
    status: {
      type: 'string',
      enum: ['success', 'error']
    },
    data: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'attributes'],
        properties: {
          id: { type: 'string', pattern: /^[a-f0-9-]{36}$/ }, // UUID
          attributes: {
            type: 'object',
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              score: { type: 'number', minimum: 0, maximum: 100 },
              tags: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    },
    pagination: {
      type: 'object',
      properties: {
        page: { type: 'number', minimum: 1 },
        limit: { type: 'number', minimum: 1, maximum: 1000 },
        total: { type: 'number', minimum: 0 }
      }
    }
  }
}

const validator = new JSONLValidator({ schema: apiResponseSchema })
```

#### Error Analysis

```typescript
const validator = new JSONLValidator({
  schema: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'number' },
      email: { type: 'string', pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/ }
    }
  }
})

createReadStream('users.jsonl')
  .pipe(validator)
  .on('data', (result) => {
    const validation = JSON.parse(result.toString())

    // Categorize errors
    const errorsByType = validation.errors.reduce((acc, error) => {
      const type = error.message.includes('JSON') ? 'syntax' : 'schema'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    console.log('Error breakdown:', errorsByType)

    // Find most common errors
    const errorCounts = {}
    validation.errors.forEach((error) => {
      errorCounts[error.message] = (errorCounts[error.message] || 0) + 1
    })

    const sortedErrors = Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)

    console.log('Top 5 errors:', sortedErrors)
  })
```

#### Validation with Processing Pipeline

```typescript
import { JSONLParse } from 'jsonl-parse'

// Validate then process valid records
const validator = new JSONLValidator({
  schema: {
    type: 'object',
    required: ['id', 'email'],
    properties: {
      id: { type: 'number' },
      email: { type: 'string', pattern: /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/ }
    }
  }
})

const processor = new JSONLParse({
  strict: false,
  on_record: (record, context) => {
    // Only process records that passed validation
    return {
      ...record,
      processed_at: new Date().toISOString(),
      line_number: context.lines
    }
  }
})

// First validate, then process if valid
validator.on('data', (validationResult) => {
  const result = JSON.parse(validationResult.toString())

  if (result.valid) {
    console.log('✅ Validation passed, processing records...')
    createReadStream('input.jsonl').pipe(processor)
  }
  else {
    console.error('❌ Validation failed:')
    result.errors.forEach((error) => {
      console.error(`  Line ${error.line}: ${error.message}`)
    })
  }
})

createReadStream('input.jsonl').pipe(validator)
```

## Format Converters

JSONLParse includes several built-in converters for transforming between different data formats:

### JSONToJSONL - Convert JSON to JSONL

Convert JSON files (arrays or objects) to JSONL format.

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { JSONToJSONL } from 'jsonl-parse'

const converter = new JSONToJSONL({
  arrayPath: 'data', // Extract array from nested path
  flatten: true, // Flatten nested objects
  maxObjectSize: 1024 * 1024 // 1MB per object limit
})

createReadStream('data.json')
  .pipe(converter)
  .pipe(createWriteStream('data.jsonl'))
```

#### JSONToJSONLOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `arrayPath` | `string` | `null` | Extract array from nested object path (e.g., "data.items") |
| `replacer` | `function` | `null` | JSON.stringify replacer function |
| `encoding` | `BufferEncoding` | `'utf8'` | Text encoding |
| `maxObjectSize` | `number` | `Infinity` | Maximum size per JSON object |
| `flatten` | `boolean` | `false` | Flatten nested objects to dot notation |
| `rootKey` | `string` | `null` | Wrap first object in specified key |

### JSONLToJSON - Convert JSONL to JSON

Convert JSONL files to JSON arrays or objects.

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { JSONLToJSON } from 'jsonl-parse'

const converter = new JSONLToJSON({
  arrayWrapper: true, // Wrap in array
  arrayName: 'results', // Use custom array name
  pretty: true, // Pretty print output
  space: 2 // Indentation spaces
})

createReadStream('data.jsonl')
  .pipe(converter)
  .pipe(createWriteStream('data.json'))
```

#### JSONLToJSONOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `arrayWrapper` | `boolean` | `true` | Wrap objects in array |
| `arrayName` | `string` | `null` | Name for root array property |
| `pretty` | `boolean` | `false` | Pretty print JSON output |
| `space` | `string \| number` | `2` | Indentation for pretty printing |
| `encoding` | `BufferEncoding` | `'utf8'` | Text encoding |
| `maxObjects` | `number` | `Infinity` | Maximum objects to process |

### JSONLToCSV - Convert JSONL to CSV

Convert JSONL files to CSV format with full customization.

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { JSONLToCSV } from 'jsonl-parse'

const converter = new JSONLToCSV({
  delimiter: ',',
  header: true,
  columns: ['id', 'name', 'email'], // Specific columns
  unflatten: true, // Reconstruct nested objects from flat keys
  cast: {
    boolean: value => value ? 'Yes' : 'No',
    date: value => value.toISOString(),
    number: value => value.toFixed(2)
  }
})

createReadStream('data.jsonl')
  .pipe(converter)
  .pipe(createWriteStream('data.csv'))
```

#### JSONLToCSVOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `','` | Field delimiter |
| `quote` | `string` | `'"'` | Quote character |
| `quoted` | `boolean` | `false` | Quote all fields |
| `quotedEmpty` | `boolean` | `false` | Quote empty fields |
| `quotedString` | `boolean` | `false` | Quote string fields |
| `escape` | `string` | `'"'` | Escape character |
| `header` | `boolean` | `true` | Include header row |
| `columns` | `string[] \| function` | `null` | Column selection/ordering |
| `encoding` | `BufferEncoding` | `'utf8'` | Text encoding |
| `cast` | `object` | `null` | Custom type casting functions |
| `unflatten` | `boolean` | `false` | Reconstruct nested objects |
| `unflattenSeparator` | `string` | `'.'` | Separator for nested keys |

### CSVToJSONL - Convert CSV to JSONL

Convert CSV files to JSONL format with robust parsing.

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { CSVToJSONL } from 'jsonl-parse'

const converter = new CSVToJSONL({
  headers: true, // Use first row as headers
  delimiter: ',',
  cast: true, // Auto-convert types
  trim: true, // Trim whitespace
  skipEmptyLines: true,
  flatten: true, // Flatten objects to dot notation
  maxObjectSize: 1024 * 1024 // 1MB limit per object
})

createReadStream('data.csv')
  .pipe(converter)
  .pipe(createWriteStream('data.jsonl'))
```

#### CSVToJSONLOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delimiter` | `string` | `','` | Field delimiter |
| `quote` | `string` | `'"'` | Quote character |
| `escape` | `string` | `'"'` | Escape character |
| `headers` | `boolean \| string[]` | `true` | Header handling |
| `skipEmptyLines` | `boolean` | `true` | Skip empty lines |
| `skipRecordsWithEmptyValues` | `boolean` | `false` | Skip records with empty values |
| `skipRecordsWithError` | `boolean` | `false` | Continue on parse errors |
| `replacer` | `function` | `null` | JSON.stringify replacer |
| `encoding` | `BufferEncoding` | `'utf8'` | Text encoding |
| `maxObjectSize` | `number` | `Infinity` | Maximum object size |
| `flatten` | `boolean` | `false` | Flatten nested objects |
| `rootKey` | `string` | `null` | Wrap objects in root key |
| `trim` | `boolean` | `true` | Trim field values |
| `cast` | `boolean \| function` | `false` | Type casting |

## Converter Usage Examples

### Batch Processing Pipeline

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { CSVToJSONL, JSONLParse, JSONLToCSV } from 'jsonl-parse'

// JSONL -> Process -> CSV
await pipeline(
  createReadStream('input.jsonl'),
  new JSONLParse({
    cast: true,
    on_record: record => ({
      ...record,
      processed: true,
      timestamp: new Date().toISOString()
    })
  }),
  new JSONLToCSV({ header: true }),
  createWriteStream('output.csv')
)

// CSV -> JSONL -> Process -> JSON
await pipeline(
  createReadStream('data.csv'),
  new CSVToJSONL({ cast: true }),
  new JSONLParse({
    on_record: record => record.active ? record : null
  }),
  new JSONLToJSON({ pretty: true }),
  createWriteStream('filtered.json')
)
```

### Data Transformation Examples

```typescript
// Convert nested JSON to flat JSONL
const jsonToFlat = new JSONToJSONL({
  arrayPath: 'users',
  flatten: true
})

// Convert flat JSONL back to nested CSV
const flatToNested = new JSONLToCSV({
  unflatten: true,
  unflattenSeparator: '.',
  columns: ['id', 'profile.name', 'profile.email', 'settings.theme']
})

// Round-trip conversion with processing
await pipeline(
  createReadStream('nested.json'),
  jsonToFlat,
  new JSONLParse({
    on_record: (record) => {
      // Process flat structure
      record['profile.verified'] = true
      return record
    }
  }),
  flatToNested,
  createWriteStream('processed.csv')
)
```

### Memory-Safe Large File Processing

```typescript
// Process large files with memory constraints
const safeConverter = new JSONLToCSV({
  maxObjectSize: 512 * 1024, // 512KB per object
  cast: {
    // Compress large text fields
    object: obj => JSON.stringify(obj).slice(0, 1000)
  }
})

const safeParser = new JSONLParse({
  maxLineLength: 1024 * 1024, // 1MB per line
  strict: false,
  skip_records_with_error: true,
  on_skip: (error, line) => {
    console.warn(`Skipped problematic record: ${error.message}`)
  }
})

await pipeline(
  createReadStream('large-file.jsonl'),
  safeParser,
  safeConverter,
  createWriteStream('safe-output.csv')
)
```

## Error Handling

### Strict Mode Errors

```typescript
const parser = new JSONLParse({ strict: true })

parser.on('error', (err) => {
  if (err.message.includes('Invalid JSON at line')) {
    console.error('JSON parsing failed:', err.message)
  }
  else if (err.message.includes('Line length')) {
    console.error('Line too long:', err.message)
  }
  else if (err.message.includes('Buffer size exceeded')) {
    console.error('Memory limit exceeded:', err.message)
  }
})
```

### Lenient Mode with Error Tracking

```typescript
let errorCount = 0

const parser = new JSONLParse({
  strict: false,
  skip_records_with_error: true,
  on_skip: (error, line) => {
    errorCount++
    console.warn(`Error ${errorCount}: ${error.message}`)
    console.warn(`Problem line: ${line.slice(0, 100)}...`)
  }
})

parser.on('end', () => {
  console.log(`Processing complete. ${errorCount} errors encountered.`)
})
```

### Converter Error Handling

```typescript
const converter = new JSONLToCSV({
  cast: {
    date: (value) => {
      try {
        return new Date(value).toISOString()
      }
      catch {
        return 'Invalid Date'
      }
    }
  }
})

converter.on('error', (err) => {
  console.error('Conversion error:', err.message)
  // Handle converter-specific errors
})
```

## License

MIT License
