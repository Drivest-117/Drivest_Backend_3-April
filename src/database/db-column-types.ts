export const DB_AWARE_TIMESTAMP_TYPE =
  process.env.NODE_ENV === 'test' ? 'datetime' : 'timestamptz';

export const DB_AWARE_JSON_TYPE =
  process.env.NODE_ENV === 'test' ? 'simple-json' : 'jsonb';
