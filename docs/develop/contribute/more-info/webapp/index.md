---
title: "Web app"
sidebar_position: 1
---

The Mattermost web app is written in JavaScript using [React](https://react.dev/) and [Redux](https://redux.js.org/).

## Repository

It is located in the `webapp` directory of the [main Mattermost repository](https://github.com/mattermost/mattermost).

https://github.com/mattermost/mattermost/tree/master/webapp

## Help Wanted

[Find help wanted tickets here](https://mattermost.com/pl/help-wanted-mattermost-webapp/).

## Package structure

The web app is set up as a monorepo which has the code broken up into multiple packages. The main packages in the web app are:

* `channels` - The main web app which contains Channels, the System Console, login/signup pages, and most of the core infrastructure for the app.
    * `src/`. Key folders include:
        * `actions` - Contains Redux actions which make up much of the view logic for the web app
        * `components` - Contains UI components and views written using React
        * `i18n` - Contains the localization files for the web app
        * `packages/mattermost-redux` - Contains most of the Redux logic used for handling data from the server
        * `plugins` - Contains the plugin framework, utility functions and components
        * `reducers` - Contains Redux reducers used for view state
        * `selectors` - Contains Redux selectors used for view state
        * `tests` - Contains setup code and mocks used for unit testing
        * `utils` - Contains many widely-used utility functions
* `platform` - Packages used by the web app and related projects
    * `client` - The JavaScript client for Mattermost's REST API, available on NPM as [@mattermost/client](https://www.npmjs.com/package/@mattermost/client)
    * `components` - A work-in-progress package containing UI components designed to be used by different parts of Mattermost
    * `types` - The TypeScript types used by Mattermost, available on NPM as [@mattermost/types](https://www.npmjs.com/package/@mattermost/types)

### Important libraries and technologies

- [React](https://reactjs.org/) - React is a user interface library used for React apps. Its key feature is that it uses a variation of JavaScript called JSX to declaratively define interfaces using HTML-like syntax.
- [Redux](https://redux.js.org/) - Redux is a state management library used for JavaScript apps. Its key features are a centralized data store for the entire app and a pattern for predictably modifying and displaying that application state. Notably, we're not using Redux Toolkit since a large portion of our Redux code predates its existence.
- [Redux Thunk](https://github.com/reduxjs/redux-thunk) - Redux Thunk is a middleware for Redux that's used to write async actions and logic that interacts more closely with the Redux store.
- [React Redux](https://react-redux.js.org/) - React Redux is the library used to connect React components to a Redux store.
 
## Legacy Notes

Note that the webapp was previously located at https://github.com/mattermost/mattermost-webapp/. You may find additional history in this repository that was not migrated back to https://github.com/mattermost/mattermost when forming the monorepo.
