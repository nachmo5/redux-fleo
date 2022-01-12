/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import Lookup from './StorePathLookup';
import {
  createBatchQueryRequest,
  createQueryRequest,
  encodeCacheKey,
  getCleanEvent,
  validateQuery,
} from './helpers';
import {
  MutationAction,
  MutationMetadata,
  QueryActionPayload,
  QueryHookConfig,
  QueryMetadata,
  StoreSlice,
  UseMultiQueryResult,
  UsePaginatedQueryResult,
  UseQueryResult,
} from './typings';
import { STATUS } from './constants';
import { useStateRef } from './hooks';
import get from 'lodash.get';

export default class HookManager {
  queries: Record<string, QueryMetadata>;
  mutations: Record<string, MutationMetadata>;
  rootPath: string[];
  idTracker: Record<string, number>;

  constructor() {
    this.queries = {};
    this.mutations = {};
    this.rootPath = [];
    this.idTracker = {};
  }

  init = (queries: QueryMetadata[], mutations: MutationMetadata[], rootPath: string[]) => {
    this.queries = queries.reduce((a, q) => ({ ...a, [q.name]: q }), {});
    this.mutations = mutations.reduce((a, m) => ({ ...a, [m.name]: m }), {});
    this.rootPath = rootPath;
    this.idTracker = {};
  };

  // -------------------------------------------------
  // Use query ---------------------------------------
  // -------------------------------------------------
  useQuery = (name: string, params: any[] = [], config: QueryHookConfig = {}): UseQueryResult => {
    if (!validateQuery(this.queries, name, params)) throw new Error('Error in useQuery');
    const query = this.queries[name];
    const { dependencies, disabled = false } = config;
    // Generate request data
    const requestId = this.useId(name);
    const cacheKey = encodeCacheKey(params);
    const payload = { requestId, cacheKey };
    // Hooks
    const dispatch = useDispatch();
    const sendRequest = createQueryRequest(dispatch, query, payload);
    // Read store -------------------------------------
    const [data, status] = this.useStoreSlices([
      { path: Lookup.getRequestDataPath(query, cacheKey), defaultValue: query.defaultValue },
      {
        path: Lookup.getRequestStatusPath(query, payload),
        defaultValue: STATUS.LOADING,
      },
    ]);

    // Execute service and dispatch result ------------
    const _dependencies = [disabled, ...(dependencies ? dependencies : [cacheKey])];
    useEffect(() => {
      if (!disabled) {
        sendRequest(...params);
      }
    }, _dependencies);

    // Refresh if status becomes PENDING_REFRESH ------------
    useEffect(() => {
      if (status === STATUS.PENDING_REFRESH) {
        sendRequest(...params);
      }
    }, [status]);

    // Clean up statuses after unmount ----------------------
    useEffect(() => {
      return () => {
        dispatch({ type: getCleanEvent(query), ...payload });
      };
    }, []);
    return [data, disabled ? false : status === STATUS.LOADING, status === STATUS.ERROR];
  };

  // -------------------------------------------------
  // Use multi query ---------------------------------
  // -------------------------------------------------
  useMultiQuery = (
    name: string,
    multiParams: any[][] = [],
    config: QueryHookConfig = {}
  ): UseMultiQueryResult => {
    const flatParams = multiParams.flatMap((e) => e);
    if (!validateQuery(this.queries, name, flatParams)) throw new Error('Error in useMultiQuery');
    const query = this.queries[name];
    const { dependencies, disabled = false } = config;
    // Generate request data
    const requestId = this.useId(name);
    const cacheKeys = multiParams.map(encodeCacheKey);
    const payloads = cacheKeys.map((cacheKey) => ({ requestId, cacheKey }));
    // Hooks
    const dispatch = useDispatch();
    const sendBatchRequest = createBatchQueryRequest(
      dispatch,
      multiParams.map(() => query),
      payloads
    );

    // Read store -------------------------------------
    const slices = this.useStoreSlices([
      // data
      ...payloads.map((payload) => ({
        path: Lookup.getRequestDataPath(query, payload.cacheKey),
        defaultValue: query.defaultValue,
      })),
      // statuses
      ...payloads.map((payload) => ({
        path: Lookup.getRequestStatusPath(query, payload),
        defaultValue: STATUS.LOADING,
      })),
    ]);
    const multiData: any[] = [];
    const statuses: string[] = [];
    slices.forEach((data, index) => {
      if (index <= multiParams.length - 1) multiData.push(data);
      else statuses.push(data);
    });
    // Execute batch and dispatch result ------------
    const _dependencies = [disabled, ...(dependencies ? dependencies : [cacheKeys.join(',')])];
    useEffect(() => {
      if (!disabled && multiParams.length > 0) {
        sendBatchRequest(...multiParams);
      }
    }, _dependencies);

    // Refresh queries with status PENDING_REFRESH <one by one to avoid conflict>------------
    // TODO: optimize this by using a BATCH request
    useEffect(() => {
      const index = statuses.findIndex((status) => status === STATUS.PENDING_REFRESH);
      if (index >= 0) {
        const sendRequest = createQueryRequest(dispatch, query, payloads[index]);
        sendRequest(...multiParams[index]);
      }
    }, [statuses.join(',')]);

    // Clean up statuses after unmount ----------------------
    useEffect(() => {
      return () => {
        dispatch({
          type: '$$BATCH',
          data: payloads.map((payload) => ({ type: getCleanEvent(query), ...payload })),
        });
      };
    }, []);
    return [
      multiData,
      disabled ? false : !!statuses.find((status) => status === STATUS.LOADING),
      !!statuses.find((status) => status === STATUS.ERROR),
    ];
  };

  // ------------------------------------------------------
  // Use paginated query  ---------------------------------
  // ----------------------------------------------------
  usePaginatedQuery = (name: string): UsePaginatedQueryResult => {
    if (!validateQuery(this.queries, name, [])) {
      throw new Error('Error in usePaginatedQuery');
    }
    const query = this.queries[name];
    const [sentRequests, setSentRequests, ref] = useStateRef([]);
    // Read store -------------------------------------
    const slices = this.useStoreSlices([
      // Data
      ...sentRequests.map((sentRequest: QueryActionPayload) => ({
        path: Lookup.getRequestDataPath(query, sentRequest.cacheKey),
        defaultValue: query.defaultValue,
      })),
      // Statuses
      ...sentRequests.map((sentRequest: QueryActionPayload) => ({
        path: Lookup.getRequestStatusPath(query, sentRequest),
        defaultValue: STATUS.LOADING,
      })),
    ]);

    const multiData: any[] = [];
    const statuses: string[] = [];
    slices.forEach((data, index) => {
      if (index <= sentRequests.length - 1) multiData.push(data);
      else statuses.push(data);
    });
    const loading = statuses.reduce((acc, status) => acc || status === STATUS.LOADING, false);
    const error = statuses.reduce((acc, status) => acc || status === STATUS.ERROR, false);
    // Refresh queries with status PENDING_REFRESH <one by one to avoid conflict>------------
    // TODO: optimize this by using a BATCH request
    useEffect(() => {
      const index = statuses.findIndex((status) => status === STATUS.PENDING_REFRESH);
      if (index >= 0) {
        const sendRequest = createQueryRequest(dispatch, query, sentRequests[index]);
        sendRequest(...sentRequests[index].params);
      }
    }, [statuses.join(',')]);
    // Clean up statuses after unmount ----------------------
    useEffect(() => {
      return () => {
        dispatch({
          type: '$$BATCH',
          data: sentRequests.map((sentRequest: QueryActionPayload) => ({
            type: getCleanEvent(query),
            ...sentRequest,
          })),
        });
      };
    }, []);
    // Methods -------------------------------------
    const dispatch = useDispatch();
    const loadMore = (...params: any[]) => {
      const cacheKey = encodeCacheKey(params);
      const requestId = this.getId(name);
      const sendRequest = createQueryRequest(dispatch, query, { cacheKey, requestId });
      setSentRequests((r: any[]) => [...r, { params, requestId, cacheKey }]);
      return sendRequest(...params);
    };

    const clear = () => {
      return new Promise((resolve) => {
        if (sentRequests.length > 0) {
          setSentRequests(() => {
            resolve(true);
            return [];
          });
        } else resolve(true);
      });
    };

    const getSentParams = () => ref.current.map((r: any) => r.params);

    return { data: multiData, loading, error, getSentParams, loadMore, clear };
  };

  useListPaginatedQuery = (name: string, params: any[] = [], config: QueryHookConfig = {}) => {
    // Params are only for the first page, the rest will be handled on loadmore
    const { dependencies = [], disabled = false } = config;
    const { data, loadMore, loading, clear } = this.usePaginatedQuery(name);

    // dependencies reset the result and remove all previous pages
    useEffect(() => {
      (async () => {
        await clear();
        loadMore(...params);
      })();
    }, [disabled, ...dependencies]);

    return { data: [data.flatMap((l) => l), loading], loadMore };
  };
  // ------------------------------------
  // Use Mutation -----------------------
  // ------------------------------------
  useMutation = (name: string) => {
    const mutation = this.mutations[name];
    if (!mutation) {
      throw new Error(`Mutation ${name} not found`);
    }
    const dispatch = useDispatch();

    return async (...params: any[]) => {
      try {
        const result = await mutation.service(...params);
        const action: MutationAction = { type: mutation.name, data: result, params };
        dispatch(action);
        return result;
      } catch (e) {
        // dispatch({ type: getErrorEvent(mutation), params });
        throw e;
      }
    };
  };

  // ------------------------------------
  // Use query request  -----------------
  // ------------------------------------
  useQueryRequest = (name: string) => {
    if (!validateQuery(this.queries, name, [])) {
      throw new Error(`Query ${name} not found`);
    }
    const query = this.queries[name];

    const dispatch = useDispatch();
    const requestId = this.useId(name);

    return (...params: any[]) => {
      const cacheKey = encodeCacheKey(params);
      const sendRequest = createQueryRequest(dispatch, query, { requestId, cacheKey });
      return sendRequest(...params);
    };
  };

  // ------------------------------------
  // Get service  -----------------------
  // ------------------------------------
  getService = (name: string) => {
    if (this.queries[name]) {
      return this.queries[name].service;
    } else if (this.mutations[name]) {
      return this.mutations[name].service;
    }
    throw new Error(`No service found for ${name}`);
  };

  // -------------------------------
  // Helpers -----------------------
  // -------------------------------
  useStoreSlices = (slices: StoreSlice[]): any[] =>
    useSelector(
      (store) =>
        slices.map((slice) => get(store, [...this.rootPath, ...slice.path], slice.defaultValue)),
      (a, b) => a.reduce((acc, scope, sidx) => acc && shallowEqual(scope, b[sidx]), true)
    );

  getId = (prefix: string) => {
    const count = (this.idTracker[prefix] || 0) + 1;
    this.idTracker[prefix] = count;
    return prefix + '_' + count;
  };

  useId = (prefix: string = '') => {
    const [id] = useState(() => this.getId(prefix));
    useEffect(() => {
      return () => {
        this.idTracker[prefix] = this.idTracker[prefix] - 1;
      };
    }, [prefix]);
    return id;
  };
}
