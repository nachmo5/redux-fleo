# redux-fleo

> 

[![NPM](https://img.shields.io/npm/v/redux-fleo.svg)](https://www.npmjs.com/package/redux-fleo) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)



redux-fleo is a framework that offers a declarative way to manage asynchronous state in your React redux application. 
It automates everything related to asynchronous data: tracking requests, updating the store, refreshing you components and more.

- Very easy to use with minimal code
- Can be plugged anywhere in your redux store without disturbing your existing app
- Handles triggering api calls 
- Tracks loading and error status
- Handles side effects with optimistic updates
- Automates refetching data
- Uses batch actions to limit multiple renders and improve performance


## Installation

```bash
npm install redux-fleo
```

## Definitions
**Request**:  An HTTP request call to a source of data (database, backend server…)

**Query**:    A request that reads data from a source. 

**Mutation**: A request that updates the data on a source.

**Service**: The function that will send the request and return its result. It can use any client (axios, fetch, xhr…)


## Getting started

### I. Defining your configuration

A configuration is an object that defines your queries and mutations.
It can be flat: defining the queries and mutations directly. Or it can be multi leveled, in order to separate your store into multiple slices.

**Flat config**:
```js
const flatConfig = {
 queries: [
   {
     name: 'user.fetchMany',
     defaultValue: [],
     service: () => client.get('/users'),
   },
   {
     name: 'users.fetchOne',
     service: (id) => client.get(`/users/${id}`),
   },
 ],
 mutations: [
   {
     name: 'user.create',
     service: (data) => client.post('/users', data),
   },
 ],
};
```

**Multi level config**:
```js
const multiLevelConfig = {
 product: {
   queries: [],
   mutations: [
     {
       name: 'product.create',
       service: (data) => client.post('/products', data),
     },
   ],
 },
 customer: {
   queries: [
     {
       name: 'customer.fetchMany',
       defaultValue: [],
       service: () => client.get('/customers'),
     },
   ],
   mutations: [],
 },
};

```

### II. Plugging the fleo reducer into your store
redux-fleo provides the static function ```Fleo.createReducer```, which creates a reducer from a configuration. This reducer can be plugged directly into your redux store as a root reducer or as a slice reducer. 

**Fleo reducer as root reducer:**

```js
import { createStore } from 'redux';
import Fleo from 'redux-fleo';
 
const config = { 
	queries: [/* your queries */], 
	mutations: [/* your mutations */] 
};
const store = createStore(Fleo.createReducer(config));
```

**Fleo reducer in a redux slice:**

```js
import { configureStore } from '@reduxjs/toolkit';
import Fleo from 'redux-fleo';
 
const config = { queries: [], mutations: [] };
const store = configureStore({
 reducer: {
   posts: postsReducer,
   comments: commentsReducer,
   fleo: Fleo.createReducer(config, ['fleo']),
 },
});

```

*NB: if redux-fleo’s reducer is not your only reducer, you must provide a path as a second argument to the function ```Fleo.createReducer```*


### III. Using redux-fleo hooks

redux-fleo offers a varierty of hooks to simplify interacting with your requests and with the store. These hooks handle triggering your service, updating the store with the result and returning the updated store.


We will use the configuration below in the coming examples:
```js
const config = {
	queries:[
		{
			name: 'user.fetchByFilters',
			defaultValue: [],
			service: (gender, situation) => {
				const filters = { gender, situation };
				return axios.post("/users", filters).then(({data})=> data);
			}
		},
		{
			name: 'user.fetchOne',
			service: (id) => client.get(`/users/${id}`)
		},
		{
			name: 'customer.fetchByCity',
			defaultValue: [],
			service: (page, city)=> {
				return client.get(`/customers?page=${page}&city=${city}`)
			}
		}
	],
	mutations: [
		{
			name: 'user.create',
			service: (data) => client.post('/users', data)
		}
	]
}

```

### useQuery: Fetching data with a single request

useQuery is a hook that takes the name of a query and a list of parameters.
After the component is mounted, it will call the service declared in your configuration by matching the name of the query.
It returns the result of the query along with the status.
If the list of parameters change, the hook will call the service again to refetch the data.


**Example**:

```js
import { useQuery } from 'redux-fleo'
const UserList = () => {
 const [users, loading, error] = useQuery('user.fetchByFilters', ['F', 'married']);
 if (loading) {
   return <div>Loading...</div>;
 }
 if (error) {
   return <div>Error!</div>;
 }
 return (
   <div>
     {users.map((user) => (
       <div key={user.id}>{user.name}</div>
     ))}
   </div>
 );
};
```


### useMultiQuery: Fetching data with multiple parallel requests

Sometimes we need to send multiple requests at the same time, but unfortunately we can’t use React hooks inside of loops.
useMultiQuery takes the name of a query, a matrix of parameters (an array of an array), and sends multiple requests in parallel with each parameters.


**Example**:

```js
import { useMultiQuery } from 'redux-fleo'
const UsersListByIds = (props) => {
 const { ids } = props;
 const parametersMatrix = ids.map((id) => [id]);
 const [users, loading, error] = useMultiQuery('user.fetchOne', parametersMatrix);
 if (loading) {
   return <div>Loading...</div>;
 }
 if (error) {
   return <div>Error!</div>;
 }
 return (
   <div>
     {users.map((user) => (
       <div key={user.id}>{user.name}</div>
     ))}
   </div>
 );
};
```


### usePaginatedQuery: Fetching paginated data

usePaginatedQuery returns many useful variables to implement pagination, the most important ones are:

- ```loadMore``` is a function that will call your service and append its the result to the store. 
- ```data``` is an array that have 3 informations. The first is an array that contains the result of every call made by loadMore. The second and the third is the loading and error status of all calls.
- ```clear``` is a function that will reset the data, it is used when you want to redo the pagination when a dependency changes.


```js
import { usePaginatedQuery } from 'redux-fleo'
const UserPaginatedList = (props) => {
 const { city } = props;
 const { loadMore, data, clear, loading, error } = usePaginatedQuery('customer.fetchMany');
 
 React.useEffect(() => {
   clear();
   loadMore({ page: 1, city  });
 }, [city]);
 
 if (loading) {
   return <div>Loading...</div>;
 }
 if (error) {
   return <div>Error!</div>;
 }
 return (
   <div>
     <button onClick={() => 
      loadMore({ page: users.length / 10 + 1, city })}
      >
        Load more
     </button>
     {users.map((user) => (
       <div key={user.id}>{user.name}</div>
     ))}
   </div>
 );
};

```

### useMutation: Updating your data

useMutation returns a function that will call your service and dispatch its result in a redux action.

```js
import { useMutation } from 'redux-fleo'
const UserCreate = () => {
 const createUser = useMutation('user.create');
 return <button onClick={() => createUser({ name: `john` })}>Create user</button>;
};

```


## Updating data after a mutation
### Injecting mutation data to the store
Usually when we send out a mutation (create, update, delete…) we want to update the result of the queries that are affected by the change without making another call to the server.
In order to do that, we will use redux-fleo’s configuration object to specify how we want to update our queries results using the attribute ```subscribe```.

```js
const config = {
 queries: [
   {
     name: 'user.fetchMany',
     defaultValue: [],
     service: () => client.get('/users'),
     subscribe: {
       'user.create': (state, action) => [...state, action.data],
     },
   },
 ],
 mutations: [
   {
     name: 'user.create',
     service: (data) => client.post('/users', data),
   },
 ],
};

```

```subscribe``` is javascript object, each key represent a mutation name ( or any redux action ), and each corresponding value is a localized reducers that will only update a portion of the store. 

Due to the configuration above, each time a user is created, every query 'user.fetchMany' will have its store updated to add the new user, and every components connected to the store (via redux-fleo hooks) will be updated automatically.

### Refetching query data after a mutation

Sometimes, the result of the mutation does not have enough data to update our queries results, in this case we are obligated to refetch the whole query.
The configuration offers two attributes:
- ```refresh```  will trigger a refetch of the query when a mutation ( or any redux action ) is dispatched, every components will recall the service.
- ```refreshIf``` like refresh, but takes a function that will return a boolean to determine if the component should resend the request or not

```js
const config = {
 queries: [
   {
     name: 'user.fetchMany',
     defaultValue: [],
     service: () => client.get('/users'),
     refresh: ['rates.cancel','SOME_REDUX_ACTION'],
	 refreshIf: {
		 'user.sendNotification': (state, action) => {
			return Boolean(state.find(user=> user.id === action.params[0]))
		 }
	 }
   },
 ],
 mutations: [
   {
     name: 'rates.cancel',
     service: () => client.post('/rates/cancel'),
   },
	{
     name: 'user.sendNotification',
     service: (userId) => client.post(`/users/${userId}/notifications`),
   },
 ],
};

```

Every time the mutation 'rates.cancel' is called or 'SOME_REDUX_ACTION' is dispatched, all components connected to this query via redux-fleo hooks will refetch their data and update themselves. 
Every time the mutation 'user.sendNotification' is called, only the components that satisfies the condition of the callback will refetch their data.


## Hooks API

### useQuery
```js

const config = { queries: [
	{ name: "myquery", service: (a,c)=> {}, defaultValue: 3 } 
]}

const MyComponent = (props) => {
const [
	data, // result of the query, as long as request is not over, value = defaultValue
	loading, // boolean 
	error  // boolean
] = useQuery('myquery', ['a', {'c':'c'}], {disabled: true, dependencies: []})

/*
'myquery'          : name of the query
['a', {'c':'c'}]   : params with which the service will be called
                     => service('a', {'c': c})
{                  : optional config
disabled: true,    : as long as disabled is true, the query will not fire
	                 when it becomes false, the query will fire automatically
					 you can use this if you want to wait for something before call
dependencies       : by default, the depdendencies are the params
                     each time they change, the query will be called again
					 you can introduce your own depdendencies with this

}					 
```

### useMultiQuery
```js

const config = { queries: [
	{ name: "mymultiquery", service: (a, b)=> {}, defaultValue: 3 } 
]}

const MyComponent = (props) => {
const [
	data, // array of results of each of the request calls
	loading, // boolean 
	error  // boolean
] = useMultiQuery(
	'mymultiquery', [['a1', 'b1'], ['a2', 'b2']],
	{ disabled: true, dependencies: []})

/*
'mymultiquery'                 : name of the query
[['a1', 'b1'], ['a2', 'b2']]   : array of params of each request
                               => service('a1', 'b1') service('a2', 'b2')
{                              : optional config
disabled: true,                : as long as disabled is true, the query will not fire
	                           when it becomes false, the query will fire automatically
					           you can use this if you want to wait for something before call
dependencies                   : by default, the depdendencies are the params
                               each time they change, the query will be called again
				               you can introduce your own depdendencies with this

}					 
```


### usePaginatedQuery

```js
const config = { queries: [
	{ name: "myquery", service: (page)=> page, defaultValue: 3 } 
]}
const { 
	loadMore, // function that calls the service and appends its result to data 
	data,  //  array of results of every page  [1, 2]
	loading, // boolean
	error,  // boolean
	clear,  // function that clears the results (after clear data is [])
	getSentParams // function that returns an array of previous called parameters with loadMore 
} = usePaginatedQuery('myquery');

useEffect(()=>{
	loadMore(1);
	loadMore(2);
}, [])
```

## License

MIT © [nachmo5](https://github.com/nachmo5)
