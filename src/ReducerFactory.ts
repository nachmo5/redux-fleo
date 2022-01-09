import get from 'lodash.get';
import Lookup from './StorePathLookup';
import {
  decodeCacheKey,
  getCleanEvent,
  getErrorEvent,
  getLoadingEvent,
  injectValue,
} from './helpers';
import {
  Action,
  BatchAction,
  HandleFunction,
  QueryAction,
  QueryHandler,
  QueryMetadata,
} from './typings';
import { STATUS } from './constants';

const { LOADING, DONE, ERROR, PENDING_REFRESH } = STATUS;

export default class ReducerFactory {
  static create = (queries: QueryMetadata[]): HandleFunction => {
    // Generate query handlers
    const queryHandlers = queries.flatMap(ReducerFactory.generateQueryHandlers);
    // group by event (event => handleFunction[] )
    const eventHandlers: Record<string, HandleFunction[]> = queryHandlers.reduce(
      (hacc: Record<string, HandleFunction[]>, handler: QueryHandler) => {
        const { event, handle } = handler;
        const old = hacc[event] || [];
        return { ...hacc, [event]: [...old, handle] };
      },
      {}
    );

    // Final reducer
    const rootReducer = (state = {}, action: Action): any => {
      if (action.type === '$$BATCH') {
        const subActions = (action as BatchAction).data || [];
        return subActions.reduce(rootReducer, state);
      }
      return (eventHandlers[action.type] || []).reduce(
        (newState, handle) => handle(newState, action),
        state
      );
    };
    return rootReducer;
  };

  /*
    Takes one query and generate multiple handlers
  */
  static generateQueryHandlers = (query: QueryMetadata): QueryHandler[] => [
    // Success Handler
    {
      event: query.name,
      handle: (state, action) => {
        const updatedState = injectValue(
          state,
          Lookup.getRequestStatusPath(query, action as QueryAction),
          DONE
        );
        return injectValue(
          updatedState,
          Lookup.getRequestDataPath(query, (action as QueryAction).cacheKey),
          action.data
        );
      },
    },
    // Loading Handler
    {
      event: getLoadingEvent(query),
      handle: (state, action) =>
        injectValue(state, Lookup.getRequestStatusPath(query, action as QueryAction), LOADING),
    },
    // Error Handler
    {
      event: getErrorEvent(query),
      handle: (state, action) =>
        injectValue(state, Lookup.getRequestStatusPath(query, action as QueryAction), ERROR),
    },
    // Clean Handler: removes the status for action.requestId from the store
    {
      event: getCleanEvent(query),
      handle: (state, action) => {
        if (!get(state, Lookup.getRequestStatusPath(query, action as QueryAction))) return state;

        const queryStatusPath = Lookup.getQueryStatusPath(query, (action as QueryAction).cacheKey);

        const currentStatuses: Record<string, string> = get(state, queryStatusPath);
        // Instead of just setting it to undefined, we'll remove the record completely with reduce
        const newStatuses = Object.keys(currentStatuses).reduce(
          (acc: Record<string, string>, requestId: string) =>
            requestId === (action as QueryAction).requestId
              ? acc
              : { ...acc, [requestId]: currentStatuses[requestId] },
          {}
        );
        return injectValue(state, queryStatusPath, newStatuses);
      },
    },
    // Refresh Handlers: Map<string, (state,action,params)=>Boolean>
    // loop through all statuses of a query and set them to PENDING_REFRESH
    ...Object.keys({
      ...(query.refresh || []).reduce((acc, event) => ({ ...acc, [event]: null }), {}),
      ...(query.refreshIf || {}),
    }).map(
      (event): QueryHandler => ({
        event,
        handle: (state, action) => {
          let newState = { ...state };
          // Loop through requests
          const cacheKeys = Object.keys(get(state, Lookup.getQueryPath(query), {}));
          for (let i = 0; i < cacheKeys.length; i += 1) {
            const cacheKey = cacheKeys[i];
            const requestIds = Object.keys(
              get(state, Lookup.getQueryStatusPath(query, cacheKey), {})
            );
            const data = get(newState, Lookup.getRequestDataPath(query, cacheKey));
            // Loop through statuses
            for (let j = 0; j < requestIds.length; j += 1) {
              const requestId = requestIds[j];
              const shouldUpdate = (query.refreshIf || {})[event] || (() => true);
              if (shouldUpdate(data, action, decodeCacheKey(cacheKey))) {
                newState = injectValue(
                  newState,
                  Lookup.getRequestStatusPath(query, { requestId, cacheKey }),
                  PENDING_REFRESH
                );
              }
            }
          }
          return newState;
        },
      })
    ),
    // Subscribe handlers: For each request (cacheKey), update the state using subscribe handler
    ...Object.keys(query.subscribe || {}).map(
      (event: string): QueryHandler => ({
        event,
        handle: (state, action) => {
          const queryStore = get(state, Lookup.getQueryPath(query), {});
          return Object.keys(queryStore).reduce((newState, cacheKey: string) => {
            const handleSubscribe = (query.subscribe || {})[event];
            return injectValue(
              newState,
              Lookup.getRequestDataPath(query, cacheKey),
              // Apply the mini reducer provided in subscribe
              handleSubscribe(
                get(newState, Lookup.getRequestDataPath(query, cacheKey), query.defaultValue),
                action,
                decodeCacheKey(cacheKey)
              )
            );
          }, state);
        },
      })
    ),
  ];
}
