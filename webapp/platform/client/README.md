# Mattermost Client

[![npm version](https://img.shields.io/npm/v/@mattermost/client?style=flat)](https://www.npmjs.com/package/@mattermost/client)

This package contains the JavaScript/TypeScript client for [Mattermost](https://github.com/mattermost/mattermost). It's used by [the Mattermost web app](https://github.com/mattermost/mattermost/tree/master/webapp/channels) and related projects.

## Installation

### JavaScript

```sh
$ npm install @mattermost/client
```

### TypeScript

```sh
$ npm install @mattermost/client @mattermost/types
```

## Usage

To use the client, create an instance of `Client4`, set the server URL, and log in, and then you can start making requests.

```js
import {Client4} from '@mattermost/client';

const client = new Client4();
client4.setUrl('https://mymattermostserver.example.com');

client4.login('username', 'password').then((user) => {
    // ...
});
```

If you already have a session token or a user access token, you can call `Client4.setToken` instead of logging in.

```js
import {Client4} from '@mattermost/client';

const client = new Client4();
client4.setUrl('https://mymattermostserver.example.com');

client4.setToken('accesstoken');
```

If needed, methods exist to set other headers such as the User-Agent (`Client4.setUserAgent`), the CSRF token (`Client4.setCSRF`), or any extra headers you wish to include (`Client4.setHeader`).

Methods of `Client4` which make requests to the server return a `Promise` which does the following:

- On success, the promise resolves to a `ClientResponse<T>` object which contains the the [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) (`response`), a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) of headers (`headers`), and the data sent from the server (`data`).
- On an error, the promise rejects with a `ClientError` which contains the error message and the URL being requested. If the error happened on the server, the status code and an error ID (`server_error_id`) are included.

```js
let user;
try {
    user = (await client.getUser('userid')).data;
} catch (e) {
    console.error(`An error occurred when making a request to ${e.url}: ${e.message}`);
}
```

## Compilation and Packaging

As a member of Mattermost with write access to our NPM organization, you can build and publish this package by running the following commands:

```bash
npm run build --workspace=platform/client
npm publish --workspace=platform/client
```

Make sure to increment the version number in `package.json` first! You can add `-0`, `-1`, etc for pre-release versions.
