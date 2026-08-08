/**
 * Raw Supabase Database API (PostgREST)
 * Replaces @supabase/supabase-js database methods with direct PostgREST calls
 */

import { getValidAccessToken } from './raw-auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface QueryOptions {
  select?: string;
  filters?: Record<string, any>;
  order?: { column: string; ascending?: boolean; foreignTable?: string };
  limit?: number;
  offset?: number;
  single?: boolean;
}

interface DbResponse<T> {
  data: T | null;
  error: Error | null;
  count?: number;
}

/**
 * Get authorization headers, refreshing the access token first if it's expired.
 *
 * This is async on purpose. It used to read `getSession()` synchronously, which
 * returns null for an expired session — so the Authorization header silently
 * fell back to the anon key. Requests then ran as ANONYMOUS instead of failing,
 * and RLS returned empty result sets that looked like missing data rather than
 * an expired login. getValidAccessToken() refreshes instead.
 */
async function getHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();

  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Build query string from filters
 */
function buildQueryString(options: QueryOptions = {}): string {
  const params = new URLSearchParams();
  
  // SELECT specific columns
  if (options.select) {
    params.append('select', options.select);
  }
  
  // Filters (e.g., { id: 'eq.123', name: 'ilike.*test*' })
  if (options.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      params.append(key, value);
    });
  }
  
  // Ordering
  if (options.order) {
    const direction = options.order.ascending !== false ? 'asc' : 'desc';
    const column = options.order.foreignTable 
      ? `${options.order.foreignTable}(${options.order.column})`
      : options.order.column;
    params.append('order', `${column}.${direction}`);
  }
  
  // Pagination
  if (options.limit !== undefined) {
    params.append('limit', String(options.limit));
  }
  
  if (options.offset !== undefined) {
    params.append('offset', String(options.offset));
  }
  
  return params.toString();
}

/**
 * SELECT query
 * @example select('users', { select: 'id,name', filters: { 'id': 'eq.123' } })
 */
export async function select<T = any>(
  table: string,
  options: QueryOptions = {}
): Promise<DbResponse<T>> {
  try {
    const queryString = buildQueryString(options);
    const url = `${SUPABASE_URL}/rest/v1/${table}${queryString ? `?${queryString}` : ''}`;
    
    const headers = await getHeaders();
    if (!options.single) {
      headers['Prefer'] = 'return=representation';
    }
    
    const res = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`SELECT failed: ${res.status} - ${error}`);
    }

    let data = await res.json();
    
    // Handle single row
    if (options.single) {
      data = data[0] || null;
      if (!data) {
        throw new Error('No rows returned');
      }
    }

    return { data, error: null };
  } catch (error: any) {
    // Silence "No rows returned" error logging as it's a common expected condition
    if (error.message !== 'No rows returned') {
      console.error(`[RawDb] SELECT ${table} error:`, error);
    }
    return { data: null, error };
  }
}

/**
 * INSERT query
 * @example insert('users', { name: 'John', email: 'john@example.com' })
 */
export async function insert<T = any>(
  table: string,
  data: any | any[],
  options: { returning?: boolean } = {}
): Promise<DbResponse<T>> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers = await getHeaders();

    if (options.returning !== false) {
      headers['Prefer'] = 'return=representation';
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`INSERT failed: ${res.status} - ${error}`);
    }

    const result = options.returning !== false ? await res.json() : null;
    return { data: result, error: null };
  } catch (error: any) {
    console.error(`[RawDb] INSERT ${table} error:`, error);
    return { data: null, error };
  }
}

/**
 * UPDATE query
 * @example update('users', { name: 'Jane' }, { 'id': 'eq.123' })
 */
export async function update<T = any>(
  table: string,
  data: any,
  filters: Record<string, string>,
  options: { returning?: boolean } = {}
): Promise<DbResponse<T>> {
  try {
    const queryString = buildQueryString({ filters });
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryString}`;
    const headers = await getHeaders();

    if (options.returning !== false) {
      headers['Prefer'] = 'return=representation';
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`UPDATE failed: ${res.status} - ${error}`);
    }

    const result = options.returning !== false ? await res.json() : null;
    return { data: result, error: null };
  } catch (error: any) {
    console.error(`[RawDb] UPDATE ${table} error:`, error);
    return { data: null, error };
  }
}

/**
 * DELETE query
 * @example remove('users', { 'id': 'eq.123' })
 */
export async function remove(
  table: string,
  filters: Record<string, string>
): Promise<DbResponse<null>> {
  try {
    const queryString = buildQueryString({ filters });
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryString}`;

    const res = await fetch(url, {
      method: 'DELETE',
      headers: await getHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`DELETE failed: ${res.status} - ${error}`);
    }

    return { data: null, error: null };
  } catch (error: any) {
    console.error(`[RawDb] DELETE ${table} error:`, error);
    return { data: null, error };
  }
}

/**
 * Call a Postgres function (RPC)
 * @example rpc('award_points', { user_uuid: '123', point_amount: 10 })
 */
export async function rpc<T = any>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<DbResponse<T>> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`RPC failed: ${res.status} - ${error}`);
    }

    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    return { data, error: null };
  } catch (error: any) {
    console.error(`[RawDb] RPC ${functionName} error:`, error);
    return { data: null, error };
  }
}

/**
 * Helper for complex filters
 */
export const filter = {
  eq: (value: any) => `eq.${value}`,
  neq: (value: any) => `neq.${value}`,
  gt: (value: any) => `gt.${value}`,
  gte: (value: any) => `gte.${value}`,
  lt: (value: any) => `lt.${value}`,
  lte: (value: any) => `lte.${value}`,
  like: (value: string) => `like.${value}`,
  ilike: (value: string) => `ilike.${value}`,
  is: (value: null) => `is.null`,
  in: (values: any[]) => `in.(${values.join(',')})`,
  or: (conditions: string) => `or.(${conditions})`,
  and: (conditions: string) => `and.(${conditions})`,
};

/**
 * Query builder for fluent API (optional convenience)
 */
export class QueryBuilder<T> {
  private table: string;
  private options: QueryOptions = {};

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*') {
    this.options.select = columns;
    return this;
  }

  eq(column: string, value: any) {
    if (!this.options.filters) this.options.filters = {};
    this.options.filters[column] = filter.eq(value);
    return this;
  }

  neq(column: string, value: any) {
    if (!this.options.filters) this.options.filters = {};
    this.options.filters[column] = filter.neq(value);
    return this;
  }

  ilike(column: string, value: string) {
    if (!this.options.filters) this.options.filters = {};
    this.options.filters[column] = filter.ilike(value);
    return this;
  }

  is(column: string, value: null) {
    if (!this.options.filters) this.options.filters = {};
    this.options.filters[column] = filter.is(value);
    return this;
  }

  order(column: string, ascending: boolean = true) {
    this.options.order = { column, ascending };
    return this;
  }

  limit(count: number) {
    this.options.limit = count;
    return this;
  }

  offset(count: number) {
    this.options.offset = count;
    return this;
  }

  single() {
    this.options.single = true;
    return this;
  }

  async execute(): Promise<DbResponse<T[] | T>> {
    if (this.options.single) {
      const result = await select<T>(this.table, this.options);
      return result as DbResponse<T>;
    }
    return select<T>(this.table, this.options);
  }
}

/**
 * Create a query builder
 * @example from('users').select('id,name').eq('id', '123').execute()
 */
export function from<T = any>(table: string): QueryBuilder<T> {
  return new QueryBuilder<T>(table);
}
