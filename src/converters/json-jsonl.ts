import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export interface JSONToJSONLOptions {
  arrayPath?: string
  replacer?: (this: any, key: string, value: any) => any
  encoding?: BufferEncoding
  maxObjectSize?: number
  flatten?: boolean
  rootKey?: string
}

export class JSONToJSONL extends Transform {
  private buffer: string
  private arrayPath: string | null
  private replacer: ((this: any, key: string, value: any) => any) | null
  private encoding: BufferEncoding
  private maxObjectSize: number
  private flatten: boolean
  private rootKey: string | null
  private objectCount: number

  constructor(options: JSONToJSONLOptions = {}) {
    super({ objectMode: false })
    this.buffer = ''
    this.arrayPath = options.arrayPath ?? null
    this.replacer = options.replacer ?? null
    this.encoding = options.encoding ?? 'utf8'
    this.maxObjectSize = options.maxObjectSize ?? Infinity
    this.flatten = options.flatten ?? false
    this.rootKey = options.rootKey ?? null
    this.objectCount = 0
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null
    }, obj)
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
    this.buffer += chunk.toString(this.encoding)

    try {
      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }

  _flush(callback: TransformCallback) {
    if (!this.buffer.trim()) {
      return callback()
    }

    try {
      const parsed = JSON.parse(this.buffer)

      if (this.arrayPath) {
        const targetArray = this.getNestedValue(parsed, this.arrayPath)
        if (!Array.isArray(targetArray)) {
          return callback(new Error(`Path "${this.arrayPath}" does not point to an array`))
        }

        for (const item of targetArray) {
          const line = this.processObject(item)
          this.push(`${line}\n`)
        }
      }
      else if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const line = this.processObject(item)
          this.push(`${line}\n`)
        }
      }
      else {
        const line = this.processObject(parsed)
        this.push(`${line}\n`)
      }

      callback()
    }
    catch (error) {
      callback(error as Error)
    }
  }
}

export function createJSONToJSONLStream(options?: JSONToJSONLOptions) {
  return new JSONToJSONL(options)
}
