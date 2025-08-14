# JSONLParser

A high-performance, memory-safe TypeScript/JavaScript streaming parser for JSONL (JSON Lines) files.

## Features

- 🚀 **High Performance**: Native Node.js streams with minimal overhead
- 🛡️ **Memory Safe**: Built-in protection against memory exhaustion
- 📝 **TypeScript Support**: Full type definitions and interfaces
- 🔧 **Configurable**: Flexible options for different use cases
- 🌍 **Cross-Platform**: Handles both Unix (`\n`) and Windows (`\r\n`) line endings
- ⚡ **Streaming**: Process large files without loading everything into memory
- 🎯 **Error Handling**: Strict and lenient parsing modes

## Installation

```bash
npm install jsonl-parser-stream
# or
yarn add jsonl-parser-stream
```

## Quick Start

```typescript
import { createReadStream } from 'node:fs'
import { JSONLParser } from 'jsonl-parser-stream'

const parser = new JSONLParser()

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
new JSONLParser(options?: JSONLParserOptions)
```

### JSONLParserOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `strict` | `boolean` | `true` | If `true`, stops on first invalid JSON. If `false`, skips invalid lines |
| `reviver` | `function` | `null` | Optional reviver function passed to `JSON.parse` |
| `skipEmptyLines` | `boolean` | `true` | If `true`, trims whitespace and skips empty lines |
| `maxLineLength` | `number` | `Infinity` | Maximum line length to prevent memory issues |
| `encoding` | `BufferEncoding` | `'utf8'` | Encoding for chunk conversion |

### Methods

The `JSONLParser` extends Node.js `Transform` stream, so it inherits all standard stream methods.

## Usage Examples

### Basic Usage

```typescript
import { createReadStream } from 'node:fs'
import { JSONLParser } from 'jsonl-parser-stream'

const parser = new JSONLParser()
createReadStream('data.jsonl').pipe(parser)
```

### Strict Mode (Default)

```typescript
// Stops on first invalid JSON line
const strictParser = new JSONLParser({ strict: true })

strictParser.on('error', (err) => {
  console.error('Invalid JSON found:', err.message)
})
```

### Lenient Mode

```typescript
// Skips invalid JSON lines silently
const lenientParser = new JSONLParser({ strict: false })

// Will process valid lines and skip invalid ones
```

### With Custom JSON Reviver

```typescript
const parser = new JSONLParser({
  reviver: (key, value) => {
    // Convert timestamp strings to Date objects
    if (key === 'timestamp') {
      return new Date(value)
    }
    // Convert numeric strings to numbers
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return Number.parseInt(value, 10)
    }
    return value
  }
})
```

### Memory-Safe Processing

```typescript
// Protect against extremely large lines
const safeParser = new JSONLParser({
  maxLineLength: 1024 * 1024, // 1MB per line maximum
  strict: false // Skip overly long lines instead of erroring
})
```

### Processing Large Files

```typescript
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const parser = new JSONLParser({
  maxLineLength: 10 * 1024, // 10KB max per line
  strict: false
})

const processor = new Transform({
  objectMode: true,
  transform(obj, encoding, callback) {
    // Process each parsed object
    const processed = {
      ...obj,
      processed_at: new Date().toISOString()
    }
    callback(null, `${JSON.stringify(processed)}\n`)
  }
})

// Stream processing pipeline
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

const parser = new JSONLParser()
const readable = Readable.from(createReadStream('data.jsonl').pipe(parser))

for await (const obj of readable) {
  console.log('Object:', obj)

  // Process objects one by one
  if (obj.type === 'important') {
    await processImportantObject(obj)
  }
}
```

## Error Handling

### Strict Mode Errors

```typescript
const parser = new JSONLParser({ strict: true })

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

### Lenient Mode with Logging

```typescript
const parser = new JSONLParser({ strict: false })

// In lenient mode, errors are silently skipped
// You can add custom logging by extending the class
class LoggingJSONLParser extends JSONLParser {
  _transform(chunk, encoding, callback) {
    const originalPush = this.push
    let lineNumber = 0

    this.push = (obj) => {
      lineNumber++
      return originalPush.call(this, obj)
    }

    super._transform(chunk, encoding, (err) => {
      if (err && !this.strict) {
        console.warn(`Skipped invalid line ${lineNumber}: ${err.message}`)
      }
      callback(err)
    })
  }
}
```

## Performance Tips

1. **Use appropriate buffer sizes**:

   ```typescript
   createReadStream('file.jsonl', { highWaterMark: 64 * 1024 })
   ```

2. **Set reasonable line limits**:

   ```typescript
   new JSONLParser({ maxLineLength: 1024 * 1024 }) // 1MB
   ```

3. **Use object mode streams for processing**:

   ```typescript
   const processor = new Transform({ objectMode: true })
   ```

4. **Consider parallel processing for CPU-intensive tasks**:

   ```typescript
   // Use worker threads for heavy JSON processing
   ```

## License

MIT License - see LICENSE file for details.
