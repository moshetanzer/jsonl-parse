import type { TransformCallback } from 'node:stream'
import { Transform } from 'node:stream'

export interface JSONLValidatorOptions {
  encoding?: BufferEncoding
  maxLineLength?: number
  maxObjects?: number
  strictMode?: boolean
  allowEmptyLines?: boolean
  schema?: JSONLSchema
}

export interface JSONLSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  required?: string[]
  properties?: Record<string, JSONLSchema>
  items?: JSONLSchema
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  minimum?: number
  maximum?: number
  enum?: any[]
}

export interface ValidationError {
  line: number
  column?: number
  message: string
  value?: any
  schema?: JSONLSchema
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  totalLines: number
  validLines: number
  invalidLines: number
}

export class JSONLValidator extends Transform {
  private encoding: BufferEncoding
  private maxLineLength: number
  private maxObjects: number
  private strictMode: boolean
  private allowEmptyLines: boolean
  private schema: JSONLSchema | null
  private buffer: string
  private lineNumber: number
  private errors: ValidationError[]
  private validLines: number
  private invalidLines: number

  constructor(options: JSONLValidatorOptions = {}) {
    super({ objectMode: false })
    this.encoding = options.encoding ?? 'utf8'
    this.maxLineLength = options.maxLineLength ?? 1024 * 1024
    this.maxObjects = options.maxObjects ?? Infinity
    this.strictMode = options.strictMode ?? false
    this.allowEmptyLines = options.allowEmptyLines ?? true
    this.schema = options.schema ?? null
    this.buffer = ''
    this.lineNumber = 0
    this.errors = []
    this.validLines = 0
    this.invalidLines = 0
  }

  private validateSchema(value: any, schema: JSONLSchema, path = ''): ValidationError[] {
    const errors: ValidationError[] = []

    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value
      if (actualType !== schema.type) {
        errors.push({
          line: this.lineNumber,
          message: `Expected type ${schema.type}, got ${actualType}`,
          value,
          schema,
        })
        return errors
      }
    }

    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({
        line: this.lineNumber,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        value,
        schema,
      })
    }

    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({
          line: this.lineNumber,
          message: `String length ${value.length} is less than minimum ${schema.minLength}`,
          value,
          schema,
        })
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({
          line: this.lineNumber,
          message: `String length ${value.length} exceeds maximum ${schema.maxLength}`,
          value,
          schema,
        })
      }
      if (schema.pattern && !schema.pattern.test(value)) {
        errors.push({
          line: this.lineNumber,
          message: `String does not match pattern ${schema.pattern}`,
          value,
          schema,
        })
      }
    }

    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({
          line: this.lineNumber,
          message: `Number ${value} is less than minimum ${schema.minimum}`,
          value,
          schema,
        })
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({
          line: this.lineNumber,
          message: `Number ${value} exceeds maximum ${schema.maximum}`,
          value,
          schema,
        })
      }
    }

    if (schema.type === 'object' && typeof value === 'object' && value !== null) {
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in value)) {
            errors.push({
              line: this.lineNumber,
              message: `Missing required field: ${requiredField}`,
              value,
              schema,
            })
          }
        }
      }

      if (schema.properties) {
        for (const [key, propertySchema] of Object.entries(schema.properties)) {
          if (key in value) {
            const fieldPath = path ? `${path}.${key}` : key
            errors.push(...this.validateSchema(value[key], propertySchema, fieldPath))
          }
        }
      }
    }

    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          const itemPath = `${path}[${index}]`
          errors.push(...this.validateSchema(item, schema.items!, itemPath))
        })
      }
    }

    return errors
  }

  private validateLine(line: string): ValidationError[] {
    const errors: ValidationError[] = []

    if (line.length > this.maxLineLength) {
      errors.push({
        line: this.lineNumber,
        message: `Line length ${line.length} exceeds maximum ${this.maxLineLength}`,
      })
    }

    if (this.strictMode) {
      if (line.includes('\n') || line.includes('\r')) {
        errors.push({
          line: this.lineNumber,
          message: 'Line contains newline characters',
        })
      }
      if (line !== line.trim()) {
        errors.push({
          line: this.lineNumber,
          message: 'Line has leading or trailing whitespace',
        })
      }
    }

    try {
      const parsed = JSON.parse(line.trim())

      if (this.schema) {
        errors.push(...this.validateSchema(parsed, this.schema))
      }
    }
    catch (parseError) {
      const error = parseError as SyntaxError
      const match = error.message.match(/at position (\d+)/)
      const column = match ? Number.parseInt(match[1]) : undefined

      errors.push({
        line: this.lineNumber,
        column,
        message: `Invalid JSON: ${error.message}`,
        value: line,
      })
    }

    return errors
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
    this.buffer += chunk.toString(this.encoding)

    const lines = this.buffer.split(/\r?\n/)
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      this.lineNumber++

      if (this.lineNumber > this.maxObjects) {
        this.emit('error', new Error(`Maximum object limit ${this.maxObjects} exceeded`))
        return
      }

      const trimmedLine = line.trim()

      if (!trimmedLine) {
        if (!this.allowEmptyLines) {
          this.errors.push({
            line: this.lineNumber,
            message: 'Empty lines not allowed',
          })
          this.invalidLines++
        }
        continue
      }

      const lineErrors = this.validateLine(line) // Pass original line for strict mode validation

      if (lineErrors.length > 0) {
        this.errors.push(...lineErrors)
        this.invalidLines++
      }
      else {
        this.validLines++
      }
    }

    callback()
  }

  _flush(callback: TransformCallback) {
    if (this.buffer.trim()) {
      this.lineNumber++

      if (this.lineNumber > this.maxObjects) {
        this.emit('error', new Error(`Maximum object limit ${this.maxObjects} exceeded`))
        return
      }

      const lineErrors = this.validateLine(this.buffer) // Pass original buffer

      if (lineErrors.length > 0) {
        this.errors.push(...lineErrors)
        this.invalidLines++
      }
      else {
        this.validLines++
      }
    }

    const result: ValidationResult = {
      valid: this.errors.length === 0,
      errors: this.errors,
      totalLines: this.lineNumber,
      validLines: this.validLines,
      invalidLines: this.invalidLines,
    }

    this.push(JSON.stringify(result))
    callback()
  }
}

export function createJSONLValidatorStream(options?: JSONLValidatorOptions) {
  return new JSONLValidator(options)
}

export function validateJSONL(input: string, options?: JSONLValidatorOptions): ValidationResult {
  const validator = new JSONLValidator(options)
  let result: ValidationResult | null = null

  validator.on('data', (data) => {
    result = JSON.parse(data.toString())
  })

  validator.write(input)
  validator.end()

  return result!
}
