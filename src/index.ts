import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export interface JSONLParseOptions {
  /**
   * If true (default), stops the stream on the first invalid JSON line.
   * If false, invalid lines are silently skipped.
   */
  strict?: boolean
  /**
   * Optional reviver function passed to JSON.parse.
   */
  reviver?: (this: any, key: string, value: any) => any
  /**
   * If true (default), trims whitespace from each line and skips empty lines.
   * If false, whitespace is preserved and empty lines are passed to JSON.parse.
   */
  skipEmptyLines?: boolean
  /**
   * Maximum line length to prevent memory issues (default: Infinity)
   */
  maxLineLength?: number
  /**
   * Encoding for chunk conversion (default: 'utf8')
   */
  encoding?: BufferEncoding
}

export class JSONLParse extends Transform {
  private buffer: string
  private strict: boolean
  private reviver: ((this: any, key: string, value: any) => any) | null
  private skipEmptyLines: boolean
  private maxLineLength: number
  private encoding: BufferEncoding

  constructor(options: JSONLParseOptions = {}) {
    super({ objectMode: true })
    this.buffer = ''
    this.strict = options.strict !== false
    this.reviver = options.reviver || null
    this.skipEmptyLines = options.skipEmptyLines !== false
    this.maxLineLength = options.maxLineLength || Infinity
    this.encoding = options.encoding || 'utf8'
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    this.buffer += chunk.toString(this.encoding)

    if (this.buffer.length > this.maxLineLength * 10) {
      return callback(new Error('Buffer size exceeded maximum limit'))
    }

    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]

      if (line.length > this.maxLineLength) {
        if (this.strict) {
          return callback(new Error(`Line length ${line.length} exceeds maximum ${this.maxLineLength}`))
        }
        continue // Skip overly long lines in non-strict mode
      }

      if (this.skipEmptyLines) {
        line = line.trim()
        if (!line)
          continue
      }

      try {
        this.push(JSON.parse(line, this.reviver || undefined))
      }
      catch {
        if (this.strict) {
          return callback(new Error(`Invalid JSON at line: ${line.slice(0, 50)}...`))
        }
        // strict=false  skip bad line silently
      }
    }
    callback()
  }

  _flush(callback: TransformCallback) {
    let line = this.buffer

    if (this.skipEmptyLines) {
      line = line.trim()
      if (!line)
        return callback()
    }

    if (line) {
      if (line.length > this.maxLineLength) {
        if (this.strict) {
          return callback(new Error(`Final line length ${line.length} exceeds maximum ${this.maxLineLength}`))
        }
        return callback() // Skip overly long final line in non-strict mode
      }

      try {
        this.push(JSON.parse(line, this.reviver || undefined))
      }
      catch {
        if (this.strict) {
          return callback(new Error(`Invalid JSON in last line: ${line.slice(0, 50)}...`))
        }
      }
    }
    callback()
  }
}
