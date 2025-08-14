import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'
import { parse } from 'csv-parse'

// CSV to JSONL Transform
export interface CSVToJSONLOptions {
  delimiter?: string
  quote?: string
  escape?: string
  headers?: boolean | string[]
  skipEmptyLines?: boolean
  skipRecordsWithEmptyValues?: boolean
  skipRecordsWithError?: boolean
  replacer?: (this: any, key: string, value: any) => any
  encoding?: BufferEncoding
  maxObjectSize?: number
  flatten?: boolean
  rootKey?: string
  trim?: boolean
  cast?: boolean | ((value: string, context: any) => any)
}

export class CSVToJSONL extends Transform {
  private parser: any
  private replacer: ((this: any, key: string, value: any) => any) | null
  private encoding: BufferEncoding
  private maxObjectSize: number
  private flatten: boolean
  private rootKey: string | null
  private objectCount: number

  constructor(options: CSVToJSONLOptions = {}) {
    super({ objectMode: false })
    this.replacer = options.replacer ?? null
    this.encoding = options.encoding ?? 'utf8'
    this.maxObjectSize = options.maxObjectSize ?? Infinity
    this.flatten = options.flatten ?? false
    this.rootKey = options.rootKey ?? null
    this.objectCount = 0

    // Configure csv-parse options
    const parseOptions = {
      delimiter: options.delimiter ?? ',',
      quote: options.quote ?? '"',
      escape: options.escape ?? '"',
      columns: options.headers ?? true,
      skip_empty_lines: options.skipEmptyLines ?? true,
      skip_records_with_empty_values: options.skipRecordsWithEmptyValues ?? false,
      skip_records_with_error: options.skipRecordsWithError ?? false,
      trim: options.trim ?? true,
      cast: options.cast ?? false,
    }

    this.parser = parse(parseOptions)

    // Handle parsed records
    this.parser.on('readable', () => {
      let record
      // eslint-disable-next-line no-cond-assign
      while ((record = this.parser.read()) !== null) {
        try {
          const line = this.processObject(record)
          this.push(`${line}\n`)
        }
        catch (error) {
          this.emit('error', error)
          return
        }
      }
    })

    this.parser.on('error', (error: Error) => {
      this.emit('error', error)
    })
  }

  private flattenObject(obj: any, prefix = '', result: any = {}): any {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = prefix ? `${prefix}.${key}` : key
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          this.flattenObject(obj[key], newKey, result)
        }
        else {
          result[newKey] = obj[key]
        }
      }
    }
    return result
  }

  private processObject(obj: any): string {
    this.objectCount++

    let processedObj = obj

    if (this.flatten && typeof obj === 'object' && obj !== null) {
      processedObj = this.flattenObject(obj)
    }

    if (this.rootKey && this.objectCount === 1) {
      processedObj = { [this.rootKey]: processedObj }
    }

    const jsonString = JSON.stringify(processedObj, this.replacer || undefined)

    if (jsonString.length > this.maxObjectSize) {
      throw new Error(`Object size ${jsonString.length} exceeds maximum ${this.maxObjectSize}`)
    }

    return jsonString
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    try {
      this.parser.write(chunk)
      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }

  _flush(callback: TransformCallback) {
    try {
      this.parser.end()
      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }
}

export function createCSVToJSONLStream(options?: CSVToJSONLOptions) {
  return new CSVToJSONL(options)
}
