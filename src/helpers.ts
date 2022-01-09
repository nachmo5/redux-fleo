import { Dispatch } from 'redux';
import { QueryAction, QueryActionPayload, QueryMetadata, RequestConfig } from './typings';

export const injectValue = (
  object: Record<string, any>,
  path: string[] = [],
  value: any
): Record<string, any> => {
  if (path.length === 0) return object;
  if (path.length === 1) {
    return { ...object, [path[0]]: value };
  }
  const [firstField, ...rest] = path;
  const subObject = injectValue(object[firstField] || {}, rest, value);
  return { ...object, [firstField]: subObject };
};

export const encodeCacheKey = (params: any[]): string => JSON.stringify(params || []);

export const decodeCacheKey = (cacheKey: string): any[] => JSON.parse(cacheKey);

export const getLoadingEvent = (query: RequestConfig) => `${query.name}.loading`;
export const getErrorEvent = (query: RequestConfig) => `${query.name}.error`;
export const getCleanEvent = (query: RequestConfig) => `${query.name}.clean`;

export const createQueryRequest = (
  dispatch: Dispatch,
  query: QueryMetadata,
  payload: QueryActionPayload
) => {
  return async (...params: any[]) => {
    dispatch({ type: getLoadingEvent(query), ...payload });
    try {
      const result = await query.service(...params);
      dispatch({ type: query.name, ...payload, data: result });
    } catch (e) {
      dispatch({ type: getErrorEvent(query), ...payload });
    }
  };
};

export const createBatchQueryRequest =
  (dispatch: Dispatch, queries: QueryMetadata[], payloads: QueryActionPayload[]) =>
  async (...multiParams: any[][]) => {
    // one loading action for all queries
    dispatch({
      type: '$$BATCH',
      data: queries.map((query, qidx) => ({ type: getLoadingEvent(query), ...payloads[qidx] })),
    });
    // Call All services
    const results = await Promise.allSettled(
      queries.map((query, qidx) => query.service(...multiParams[qidx]))
    );
    // Dispatch success/error for called services
    const actions: QueryAction[] = [];
    results.forEach((result, ridx) => {
      const query = queries[ridx];
      const payload = payloads[ridx];
      if (result.status === 'fulfilled') {
        actions.push({ type: query.name, ...payload, data: result.value });
      } else {
        actions.push({ type: getErrorEvent(query), ...payload });
      }
    });
    dispatch({ type: '$$BATCH', data: actions });
  };

export const validateQuery = (
  queries: Record<string, QueryMetadata>,
  queryName: string,
  params: any[] = []
) => {
  if (!Array.isArray(params)) {
    return console.error(`Attention! params should be an ARRAY (query ${queryName})`);
  }
  const query = queries[queryName];
  if (!query) {
    return console.error(`Attention! query ${queryName} does not exist, check your config`);
  }
  const { path, service } = query;
  if (!service || typeof service !== 'function') {
    return console.error(
      `Attention! ${path.join('/')}/${queryName} service is not defined properly`
    );
  }
  return true;
};
