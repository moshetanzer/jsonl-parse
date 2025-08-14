import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export interface JSONLToJSONOptions {
  arrayWrapper?: boolean
  arrayName?: string
  pretty?: boolean
  space?: string | number
  encoding?: BufferEncoding
  maxObjects?: number
}

export class JSONLToJSON extends Transform {
  private objects: any[]
  private arrayWrapper: boolean
  private arrayName: string | null
  private pretty: boolean
  private space: string | number | undefined
  private encoding: BufferEncoding
  private maxObjects: number
  private buffer: string

  constructor(options: JSONLToJSONOptions = {}) {
    super({ objectMode: false })
    this.objects = []
    this.arrayWrapper = options.arrayWrapper ?? true
    this.arrayName = options.arrayName ?? null
    this.pretty = options.pretty ?? false
    this.space = this.pretty ? (options.space ?? 2) : undefined
    this.encoding = options.encoding ?? 'utf8'
    this.maxObjects = options.maxObjects ?? Infinity
    this.buffer = ''
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    this.buffer += chunk.toString(this.encoding)

    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine)
        continue

      try {
        const obj = JSON.parse(trimmedLine)
        this.objects.push(obj)

        if (this.objects.length >= this.maxObjects) {
          return callback(new Error(`Maximum object limit ${this.maxObjects} exceeded`))
        }
      }
      catch {
        return callback(new Error(`Invalid JSON line: ${trimmedLine.slice(0, 50)}...`))
      }
    }

    callback()
  }

  _flush(callback: TransformCallback) {
    if (this.buffer.trim()) {
      try {
        const obj = JSON.parse(this.buffer.trim())
        this.objects.push(obj)
      }
      catch {
        return callback(new Error(`Invalid JSON in final line: ${this.buffer.slice(0, 50)}...`))
      }
    }

    try {
      let output: any

      if (this.arrayWrapper) {
        if (this.arrayName) {
          output = { [this.arrayName]: this.objects }
        }
        else {
          output = this.objects
        }
      }
      else {
        output = this.objects.length === 1 ? this.objects[0] : this.objects
      }

      const result = JSON.stringify(output, null, this.space)
      this.push(result)
      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }
}
export function createJSONLToJSONStream(options?: JSONLToJSONOptions) {
  return new JSONLToJSON(options)
}
