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

### Rest Client

To use this client, create an instance of `Client4`, set the server URL, and log in, and then you can start making requests.

```js
import {Client4} from '@mattermost/client';

const client = new Client4();
client.setUrl('https://mymattermostserver.example.com');

client.login('username', 'password').then((user) => {
    // ...
});
```

If you already have a session token or a user access token, you can call `Client4.setToken` instead of logging in.

```js
import {Client4} from '@mattermost/client';

const client = new Client4();
client.setUrl('https://mymattermostserver.example.com');

client.setToken('accesstoken');
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

### WebSocket Client

To use the WebSocket client, create an instance of `WebSocketClient` and then call its `initialize` method with the connection URL and an optional session token or user access token. After that, you can call the client's `addMessageListener` method to register a listener which will be called whenever a WebSocket message is received from the server.

```js
import {WebSocketClient} from '@mattermost/client';

// If you already have an instance of Client4, you can call its getWebSocketUrl method to get this URL
const connectionUrl = 'https://mymattermostserver.example.com/api/v4/websocket';

// In a browser, the token may be passed automatically from a cookie
const authToken = process.env.TOKEN;

const wsClient = new WebSocketClient();
wsClient.initialize(connectionUrl, authToken);

wsClient.addMessageListener((msg) => {
    if (msg.event === 'posted') {
        console.log('New post received', JSON.parse(msg.data.post));
    }
});
```

#### Node.js

Note that `WebSocketClient` expects `globalThis.WebSocket` to be defined as it was originally written for use in the Mattermost web app. If you're using it in a Node.js environment, you should set `globalThis.WebSocket` before instantiating the `WebSocketClient`.

```js
import WebSocket from 'ws';

if (!globalThis.WebSocket) {
    globalThis.WebSocket = WebSocket;
}

const wsClient = new WebSocketClient();
```

This can also be done using dynamic imports if you're using them.

```js
if (!globalThis.WebSocket) {
    const {WebSocket} = await import('ws');
    globalThis.WebSocket = WebSocket;
}

const wsClient = new WebSocketClient();
```

## Compilation and Packaging

As a member of Mattermost with write access to our NPM organization, you can build and publish this package by running the following commands:

```bash
npm run build --workspace=platform/client
npm publish --workspace=platform/client
```

Make sure to increment the version number in `package.json` first! You can add `-0`, `-1`, etc for pre-release versions.
