import { Reducer } from 'redux';
import HookManager from './HookManager';
import ReducerFactory from './ReducerFactory';
import { Config, ConfigBranch, ConfigLeaf, QueryConfig, RequestsMetadata } from './typings';

export default class Fleo {
  hooksManager: HookManager;

  constructor() {
    this.hooksManager = new HookManager();
  }

  /**
   *
   * @param config   queries and mutations
   * @param rootPath path of fleo store relative to redux store
   * @returns redux reducer
   */
  createReducer(config: Config, rootPath: string[] = []): Reducer {
    this.validateConfig(config);
    const { queries, mutations } = this.flattenConfig(config);
    this.hooksManager.init(queries, mutations, rootPath);
    return ReducerFactory.create(queries);
  }

  private flattenConfig = (config: Config, path: string[] = []): RequestsMetadata => {
    // case: Config is a leaf
    if (config.queries || config.mutations) {
      const { queries, mutations } = config as ConfigLeaf;
      return {
        queries: (queries || []).map((query: QueryConfig) => ({
          ...query,
          path: [...path, query.name],
        })),
        mutations: mutations || [],
      };
    }
    // case: Config is a branch
    const configBranch = config as ConfigBranch;
    return Object.keys(configBranch).reduce(
      (acc: RequestsMetadata, key: string) => {
        const subConfig: RequestsMetadata = this.flattenConfig(configBranch[key], [...path, key]);
        return {
          queries: [...acc.queries, ...subConfig.queries],
          mutations: [...acc.mutations, ...subConfig.mutations],
        };
      },
      { queries: [], mutations: [] }
    );
  };

  private validateConfig = (config: Config) => {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid fleo configuration');
    }
  };
}
