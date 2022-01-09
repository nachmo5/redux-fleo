// --------------------------------------
// Config -------------------------------
// --------------------------------------

export interface RequestConfig {
  name: string;
  service: Function;
}

export type RefreshHandler = (state: any, action: Action, params: any[]) => boolean;

export interface QueryConfig extends RequestConfig {
  subscribe?: Record<string, Function>;
  refresh?: string[];
  refreshIf?: Record<string, RefreshHandler>;
  defaultValue?: any;
}

export interface MutationConfig extends RequestConfig {}

export interface ConfigLeaf {
  queries: QueryConfig[];
  mutations: MutationConfig[];
}

export interface ConfigBranch extends Record<string, ConfigBranch | ConfigLeaf> {}

export type Config = ConfigBranch | ConfigLeaf;

// --------------------------------------
// Requests -----------------------------
// --------------------------------------

export interface QueryMetadata extends QueryConfig {
  path: string[];
}

export interface MutationMetadata extends MutationConfig {}

export interface RequestsMetadata {
  queries: QueryMetadata[];
  mutations: MutationMetadata[];
}

// --------------------------------------
// Reducer  -----------------------------
// --------------------------------------
export interface Action {
  type: string;
  data?: any;
}

export interface QueryActionPayload {
  cacheKey: string;
  requestId: string;
}

export interface QueryAction extends Action, QueryActionPayload {}

export interface MutationAction extends Action {
  params: any[];
}

export interface BatchAction extends Action {
  data: Action[];
}

export type HandleFunction = (state: any, action: Action, params?: any[]) => any;

export interface QueryHandler {
  event: string;
  handle: HandleFunction;
}

// --------------------------------------
// Hooks  -------------------------------
// --------------------------------------

export interface QueryHookConfig {
  dependencies?: any[];
  disabled?: boolean;
}

export interface StoreSlice {
  path: string[];
  defaultValue: any;
}

export type UseQueryResult = [any, boolean, boolean];
export type UseMultiQueryResult = [any[], boolean, boolean];
export interface UsePaginatedQueryResult {
  loadMore: Function;
  data: any[];
  loading: boolean;
  error: boolean;
  getSentParams: Function;
  clear: Function;
}
