---
title: "Add new dependencies"
heading: "Add new dependencies in Mattermost"
description: "If you need to add a new dependency to the project, it is important to add them in the right way. Find out how."
date: 2018-05-20T11:35:32-04:00
weight: 4
aliases:
  - /contribute/mobile/developer-setup/dependencies
---

If you need to add a new dependency to the project, it is important to add them in the right way. Instructions for adding different types of dependencies are described below.

#### JavaScript only

If you need to add a new JavaScript dependency that is not related to React Native, **use npm, not yarn**. Be sure to save the exact version number to avoid conflicts in the future.

```sh
$ npm i --save-exact <package-name>
```

If the dependency is only for development
```sh
$ npm i --save-exact --save-dev <package-name>
```

#### React Native

As with [JavaScript only](#javascript-only), **use npm** to add your dependency and include an exact version.

If the library contains iOS native code, make sure to run:

```sh
$ npm run pod-install
```

Most of the time linking the library to React Native is done automatically, but at times some libraries need to be manually linked. In this case follow the library's documentation.
