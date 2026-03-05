---
title: "Redux"
heading: "Redux"
description: "The Mattermost web app uses Redux as its state management library."
date: "2020-04-01T12:00:00-04:00"
weight: 8
aliases:
  - /contribute/webapp/redux
---

The Mattermost web app uses {{< newtabref href="https://redux.js.org/" title="Redux" >}} as its state management library. Its key features are a centralized data store for the entire app and a pattern for predictably modifying and displaying that application state. Notably, we're not using Redux Toolkit since a large portion of our Redux code predates its existence.

In addition to Redux itself, we also use:
- {{< newtabref href="https://react-redux.js.org/" title="React Redux" >}} to connect React components to the Redux store using higher-order components like `connect` or hooks like `useSelector`.
- {{< newtabref href="https://github.com/reduxjs/redux-thunk" title="Redux Thunk" >}} to write async actions and logic that interacts more closely with the Redux store.

Currently, the different packages in the web app use Redux in varying amounts. The bulk of our Redux code is in `channels` where it's split between logic that's more view-oriented, located at the root of its `src` directory, and logic that's more server-oriented, located in `channels/src/packages/mattermost-redux`.
