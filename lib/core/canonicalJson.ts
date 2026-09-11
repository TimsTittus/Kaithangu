function canonicalValue(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonicalJson: non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(',')}]`;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalValue(record[k])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
}

/**
 * Deterministic JSON: object keys sorted (by UTF-16 code units), no whitespace.
 * Only null, booleans, finite numbers, strings, arrays and plain objects are
 * allowed; anything else (undefined, bigint, Date, NaN) throws.
 */
export function canonicalJson(value: unknown): string {
  return canonicalValue(value);
}
