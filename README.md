# JSONLParse

A high-performance, memory-safe TypeScript/JavaScript streaming parser for JSONL (JSON Lines) files with extensive configuration options inspired by csv-parse.

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

## Performance Considerations

- Use `strict: false` and `skip_records_with_error: true` for maximum throughput on noisy data
- Set appropriate `maxLineLength` to prevent memory issues with malformed files
- Use `from` and `to` options to process file chunks in parallel
- The `on_record` callback adds processing overhead - use sparingly for high-volume streams
- Enable `info` and `raw` options only when needed as they increase memory usage

## License

MIT License
