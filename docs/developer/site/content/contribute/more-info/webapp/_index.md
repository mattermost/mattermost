---
title: "Web app"
heading: "Contribute to the Mattermost web app"
description: "The Mattermost web app is written in JavaScript using React and Redux."
date: "2018-03-19T12:01:23-04:00"
weight: 1
aliases:
  - /contribute/webapp
---

The Mattermost web app is written in JavaScript using {{< newtabref href="https://react.dev/" title="React" >}} and {{< newtabref href="https://redux.js.org/" title="Redux" >}}.

## Repository

It is located in the `webapp` directory of the {{< newtabref href="https://github.com/mattermost/mattermost" title="main Mattermost repository" >}}.

https://github.com/mattermost/mattermost/tree/master/webapp

## Help Wanted

{{< newtabref href="https://mattermost.com/pl/help-wanted-mattermost-webapp/" title="Find help wanted tickets here" >}}.

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
    * `client` - The JavaScript client for Mattermost's REST API, available on NPM as {{< newtabref href="https://www.npmjs.com/package/@mattermost/client" title="@mattermost/client" >}}
    * `components` - A work-in-progress package containing UI components designed to be used by different parts of Mattermost
    * `types` - The TypeScript types used by Mattermost, available on NPM as {{< newtabref href="https://www.npmjs.com/package/@mattermost/types" title="@mattermost/types" >}}

### Important libraries and technologies

- {{< newtabref href="https://reactjs.org/" title="React" >}} - React is a user interface library used for React apps. Its key feature is that it uses a variation of JavaScript called JSX to declaratively define interfaces using HTML-like syntax.
- {{< newtabref href="https://redux.js.org/" title="Redux" >}} - Redux is a state management library used for JavaScript apps. Its key features are a centralized data store for the entire app and a pattern for predictably modifying and displaying that application state. Notably, we're not using Redux Toolkit since a large portion of our Redux code predates its existence.
- {{< newtabref href="https://github.com/reduxjs/redux-thunk" title="Redux Thunk" >}} - Redux Thunk is a middleware for Redux that's used to write async actions and logic that interacts more closely with the Redux store.
- {{< newtabref href="https://react-redux.js.org/" title="React Redux" >}} - React Redux is the library used to connect React components to a Redux store.
 
## Legacy Notes

Note that the webapp was previously located at https://github.com/mattermost/mattermost-webapp/. You may find additional history in this repository that was not migrated back to https://github.com/mattermost/mattermost when forming the monorepo.
