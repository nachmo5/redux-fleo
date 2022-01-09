import { QueryActionPayload, QueryMetadata } from './typings';

/*
Our store looks like this
{
    subStore: {
      query.name1: {
        [cacheKey1]:{
            data,
            status:{
                requestId1: DONE,
                requestId2: LOADING
            }
        },
        [cacheKey2]:{
            data,
            status:{
                requestId3: PENDING_REFRESH,
                requestId4: PENDING_REFRESH
            }
        }
      },
      query.name2:{}
    }
}
*/

export default class StorePathLookup {
  static getQueryPath = (query: QueryMetadata) => query.path;

  // ----------------------
  // Status ---------------
  // ----------------------

  static getQueryStatusPath = (query: QueryMetadata, cacheKey: string): string[] => [
    ...this.getQueryPath(query),
    cacheKey,
    'status',
  ];

  static getRequestStatusPath = (query: QueryMetadata, payload: QueryActionPayload): string[] => [
    ...this.getQueryStatusPath(query, payload.cacheKey),
    payload.requestId,
  ];

  // ----------------------
  // Data -----------------
  // ----------------------
  static getRequestDataPath = (query: QueryMetadata, cacheKey: string) => [
    ...this.getQueryPath(query),
    cacheKey,
    'data',
  ];
}
