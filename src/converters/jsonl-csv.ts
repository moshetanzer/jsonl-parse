import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'
import { stringify } from 'csv-stringify'

export interface JSONLToCSVOptions {
  delimiter?: string
  quote?: string
  quoted?: boolean
  quotedEmpty?: boolean
  quotedString?: boolean
  escape?: string
  header?: boolean
  columns?: string[] | ((record: any) => string[])
  encoding?: BufferEncoding
  cast?: {
    boolean?: (value: boolean) => string
    date?: (value: Date) => string
    number?: (value: number) => string
    object?: (value: any) => string
  }
  unflatten?: boolean
  unflattenSeparator?: string
}

export class JSONLToCSV extends Transform {
  private stringifier: any
  private encoding: BufferEncoding
  private unflatten: boolean
  private unflattenSeparator: string
  private buffer: string

  constructor(options: JSONLToCSVOptions = {}) {
    super({ objectMode: false })
    this.encoding = options.encoding ?? 'utf8'
    this.unflatten = options.unflatten ?? false
    this.unflattenSeparator = options.unflattenSeparator ?? '.'
    this.buffer = ''

    const stringifyOptions = {
      delimiter: options.delimiter ?? ',',
      quote: options.quote ?? '"',
      quoted: options.quoted ?? false,
      quoted_empty: options.quotedEmpty ?? false,
      quoted_string: options.quotedString ?? false,
      escape: options.escape ?? '"',
      header: options.header ?? true,
      columns: options.columns,
      cast: options.cast,
    }
    // @ts-expect-error think this is a bug in csv-stringify types when using streaming api docs say to pass options directly
    this.stringifier = stringify(stringifyOptions)

    this.stringifier.on('readable', () => {
      let chunk
      // eslint-disable-next-line no-cond-assign
      while ((chunk = this.stringifier.read()) !== null) {
        this.push(chunk)
      }
    })

    this.stringifier.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  private unflattenObject(obj: any, separator = '.'): any {
    const result: any = {}

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const keys = key.split(separator)
        let current = result

        for (let i = 0; i < keys.length - 1; i++) {
          const k = keys[i]
          if (!(k in current)) {
            current[k] = {}
          }
          current = current[k]
        }

        current[keys[keys.length - 1]] = obj[key]
      }
    }

    return result
  }

  private processLine(line: string): any {
    try {
      let parsed = JSON.parse(line)

      if (this.unflatten && typeof parsed === 'object' && parsed !== null) {
        parsed = this.unflattenObject(parsed, this.unflattenSeparator)
      }

      return parsed
    }
    catch {
      throw new Error(`Invalid JSON line: ${line}`)
    }
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    this.buffer += chunk.toString(this.encoding)

    try {
      const lines = this.buffer.split('\n')
      // Keep the last line in buffer as it might be incomplete
      this.buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine) {
          const record = this.processLine(trimmedLine)
          this.stringifier.write(record)
        }
      }

      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }

  _flush(callback: TransformCallback) {
    try {
      // Process any remaining data in buffer
      if (this.buffer.trim()) {
        const record = this.processLine(this.buffer.trim())
        this.stringifier.write(record)
      }

      this.stringifier.end()
      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }
}

export function createJSONLToCSVStream(options?: JSONLToCSVOptions) {
  return new JSONLToCSV(options)
}
