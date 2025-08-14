import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export interface JSONLParseOptions {
  strict?: boolean
  reviver?: (this: any, key: string, value: any) => any
  skipEmptyLines?: boolean
  maxLineLength?: number
  encoding?: BufferEncoding

  columns?: (string | false | null | undefined)[] | boolean | ((line: any) => string[])
  from?: number
  to?: number
  from_line?: number
  to_line?: number
  cast?: boolean | ((value: any, context: any) => any)
  cast_date?: boolean | ((value: any, context: any) => Date | any)
  ltrim?: boolean
  rtrim?: boolean
  trim?: boolean
  on_record?: (record: any, context: any) => any
  on_skip?: (error: Error, line: string) => void
  info?: boolean
  raw?: boolean
  objname?: string
  skip_records_with_empty_values?: boolean
  skip_records_with_error?: boolean
}

interface RecordContext {
  lines: number
  records: number
  invalid_field_length: number
}

export class JSONLParse extends Transform {
  private buffer: string
  private strict: boolean
  private reviver: ((this: any, key: string, value: any) => any) | null
  private skipEmptyLines: boolean
  private maxLineLength: number
  private encoding: BufferEncoding
  private columns: (string | false | null | undefined)[] | boolean | ((line: any) => string[]) | null
  private from: number | null
  private to: number | null
  private from_line: number | null
  private to_line: number | null
  private cast: boolean | ((value: any, context: any) => any) | null
  private cast_date: boolean | ((value: any, context: any) => any) | null
  private ltrim: boolean
  private rtrim: boolean
  private trim: boolean
  private on_record: ((record: any, context: any) => any) | null
  private on_skip: ((error: Error, line: string) => void) | null
  private info: boolean
  private raw: boolean
  private objname: string | null
  private skip_records_with_empty_values: boolean
  private skip_records_with_error: boolean

  private context: RecordContext
  private headerColumns: string[] | null
  private headerProcessed: boolean

  constructor(options: JSONLParseOptions = {}) {
    super({ objectMode: true })
    this.buffer = ''
    this.strict = options.strict !== false
    this.reviver = options.reviver || null
    this.skipEmptyLines = options.skipEmptyLines !== false
    this.maxLineLength = options.maxLineLength || Infinity
    this.encoding = options.encoding || 'utf8'

    this.columns = options.columns ?? null
    this.from = options.from ?? null
    this.to = options.to ?? null
    this.from_line = options.from_line ?? null
    this.to_line = options.to_line ?? null
    this.cast = options.cast ?? null
    this.cast_date = options.cast_date ?? null
    this.ltrim = options.ltrim ?? false
    this.rtrim = options.rtrim ?? false
    this.trim = options.trim ?? false
    this.on_record = options.on_record ?? null
    this.on_skip = options.on_skip ?? null
    this.info = options.info ?? false
    this.raw = options.raw ?? false
    this.objname = options.objname ?? null
    this.skip_records_with_empty_values = options.skip_records_with_empty_values ?? false
    this.skip_records_with_error = options.skip_records_with_error ?? false

    this.context = { lines: 0, records: 0, invalid_field_length: 0 }
    this.headerColumns = null
    this.headerProcessed = false
  }

  private trimValue(value: string): string {
    if (this.trim)
      return value.trim()
    if (this.ltrim && this.rtrim)
      return value.trim()
    if (this.ltrim)
      return value.replace(/^\s+/, '')
    if (this.rtrim)
      return value.replace(/\s+$/, '')
    return value
  }

  private castValue(value: any, context: RecordContext): any {
    if (this.cast === true) {
      if (value === '')
        return value
      if (value === 'true')
        return true
      if (value === 'false')
        return false
      if (value === 'null')
        return null
      if (value === 'undefined')
        return undefined
      if (!Number.isNaN(Number(value)) && value !== '')
        return Number(value)
    }
    else if (typeof this.cast === 'function') {
      return this.cast(value, context)
    }

    // eslint-disable-next-line unicorn/prefer-number-properties
    if (this.cast_date === true && value && !isNaN(Date.parse(value))) {
      return new Date(value)
    }
    else if (typeof this.cast_date === 'function') {
      return this.cast_date(value, context)
    }

    return value
  }

  private processRecord(parsed: any, originalLine: string): any {
    let record = parsed

    if (this.columns === true && !this.headerProcessed) {
      if (Array.isArray(record)) {
        this.headerColumns = record.map(String)
      }
      else if (typeof record === 'object' && record !== null) {
        this.headerColumns = Object.keys(record)
      }
      this.headerProcessed = true
      return null
    }

    if (Array.isArray(this.columns)) {
      if (Array.isArray(record)) {
        const obj: any = {}
        this.columns.forEach((col, idx) => {
          if (typeof col === 'string') {
            obj[col] = record[idx] !== undefined ? record[idx] : null
          }
        })
        record = obj
      }
    }
    else if (typeof this.columns === 'function') {
      if (!this.headerProcessed) {
        this.headerColumns = this.columns(record)
        this.headerProcessed = true
        return null
      }
      if (Array.isArray(record) && this.headerColumns) {
        const obj: any = {}
        this.headerColumns.forEach((col, idx) => {
          obj[col] = record[idx] !== undefined ? record[idx] : null
        })
        record = obj
      }
    }
    else if (this.headerColumns && Array.isArray(record)) {
      const obj: any = {}
      this.headerColumns.forEach((col, idx) => {
        obj[col] = record[idx] !== undefined ? record[idx] : null
      })
      record = obj
    }

    if (this.cast || this.cast_date) {
      if (Array.isArray(record)) {
        record = record.map(val => this.castValue(val, this.context))
      }
      else if (typeof record === 'object' && record !== null) {
        for (const key in record) {
          record[key] = this.castValue(record[key], this.context)
        }
      }
      else {
        record = this.castValue(record, this.context)
      }
    }

    if (this.skip_records_with_empty_values) {
      if (Array.isArray(record)) {
        if (record.every(val => val === null || val === undefined || val === '')) {
          return null
        }
      }
      else if (typeof record === 'object' && record !== null) {
        if (Object.values(record).every(val => val === null || val === undefined || val === '')) {
          return null
        }
      }
      else if (record === null || record === undefined || record === '') {
        return null
      }
    }

    if (this.on_record) {
      const result = this.on_record(record, { ...this.context })
      if (result === null || result === undefined)
        return null
      record = result
    }

    let output: any = record

    if (this.info || this.raw) {
      output = {}
      if (this.info)
        output.info = { ...this.context }
      if (this.raw)
        output.raw = originalLine
      output.record = record
    }

    if (this.objname && typeof record === 'object' && record !== null && record[this.objname]) {
      const key = record[this.objname]
      const obj: any = {}
      obj[key] = record
      output = obj
    }

    return output
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    this.buffer += chunk.toString(this.encoding)

    if (this.buffer.length > this.maxLineLength * 10) {
      return callback(new Error('Buffer size exceeded maximum limit'))
    }

    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''

    for (let i = 0; i < lines.length; i++) {
      this.context.lines++

      if (this.from_line && this.context.lines < this.from_line)
        continue
      if (this.to_line && this.context.lines > this.to_line)
        break

      let line = lines[i]

      if (line.length > this.maxLineLength) {
        this.context.invalid_field_length++
        const error = new Error(`Line length ${line.length} exceeds maximum ${this.maxLineLength}`)
        if (this.on_skip) {
          this.on_skip(error, line)
          continue
        }
        if (this.skip_records_with_error)
          continue
        if (this.strict)
          return callback(error)
        continue
      }

      if (this.skipEmptyLines) {
        line = line.trim()
        if (!line)
          continue
      }
      else {
        line = this.trimValue(line)
      }

      let parsed: any
      try {
        parsed = JSON.parse(line, this.reviver || undefined)
      }
      catch {
        const error = new Error(`Invalid JSON at line ${this.context.lines}: ${line.slice(0, 50)}...`)
        if (this.on_skip) {
          this.on_skip(error, line)
          continue
        }
        if (this.skip_records_with_error)
          continue
        if (this.strict)
          return callback(error)
        continue
      }

      const processed = this.processRecord(parsed, line)
      if (processed === null)
        continue

      this.context.records++

      if (this.from && this.context.records < this.from)
        continue
      if (this.to && this.context.records > this.to)
        break

      this.push(processed)
    }
    callback()
  }

  _flush(callback: TransformCallback) {
    let line = this.buffer

    if (line) {
      this.context.lines++

      if (this.from_line && this.context.lines < this.from_line) {
        return callback()
      }
      if (this.to_line && this.context.lines > this.to_line) {
        return callback()
      }

      if (line.length > this.maxLineLength) {
        this.context.invalid_field_length++
        const error = new Error(`Final line length ${line.length} exceeds maximum ${this.maxLineLength}`)
        if (this.on_skip) {
          this.on_skip(error, line)
          return callback()
        }
        if (this.skip_records_with_error)
          return callback()
        if (this.strict)
          return callback(error)
        return callback()
      }

      if (this.skipEmptyLines) {
        line = line.trim()
        if (!line) {
          return callback()
        }
      }
      else {
        line = this.trimValue(line)
      }

      let parsed: any
      try {
        parsed = JSON.parse(line, this.reviver || undefined)
      }
      catch {
        const error = new Error(`Invalid JSON in last line: ${line.slice(0, 50)}...`)
        if (this.on_skip) {
          this.on_skip(error, line)
          return callback()
        }
        if (this.skip_records_with_error)
          return callback()
        if (this.strict)
          return callback(error)
        return callback()
      }

      const processed = this.processRecord(parsed, line)
      if (processed !== null) {
        this.context.records++

        if (!this.from || this.context.records >= this.from) {
          if (!this.to || this.context.records <= this.to) {
            this.push(processed)
          }
        }
      }
    }
    callback()
  }
}
