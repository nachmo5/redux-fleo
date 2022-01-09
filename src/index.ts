import Fleo from './Fleo';

const instance = new Fleo();

export const useQuery = instance.hooksManager.useQuery;
export const useMultiQuery = instance.hooksManager.useMultiQuery;
export const useMutation = instance.hooksManager.useMutation;
export const useQueryRequest = instance.hooksManager.useQueryRequest;
export const usePaginatedQuery = instance.hooksManager.usePaginatedQuery;
export const useListPaginatedQuery = instance.hooksManager.useListPaginatedQuery;

export default instance;
