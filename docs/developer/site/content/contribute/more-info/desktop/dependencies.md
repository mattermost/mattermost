---
title: "Dependencies"
heading: "Manage dependencies in the desktop app"
description: "Work with other libraries in the desktop app"
date: 2019-01-22T00:00:00-05:00
weight: 3
aliases:
  - /contribute/desktop/dependencies
---

The Desktop App uses `npm` to manage its dependencies.

We usually try to keep each major dependency version locked such that we don't accidentally introduce any bugs or breaking changes by upgrading.

All dependencies are locked using a `package-lock.json` file to ensure that we don't change the package versions used to build unless explicitly upgrading the package. Thus if a PR contains changes to `package-lock.json` without explicitly changing a dependency, we will usually ask the contributor to revert those changes.

## Electron

The most important dependency for the Desktop App is Electron, and is usually the library that can have the most impact on how the Desktop App works. The Electron dependency also contains the Chromium driver.

Generally we try to use the **latest possible version** of Electron where applicable to ensure we have the latest security fixes and are using the latest possible version of Chromium to maintain compatibility with the Web App.

#### Upgrading

For **patch** releases of the Desktop App, we will generally upgrade Electron to the latest **patch version**.

For **major and minor version** releases of the Desktop App, we will upgrade to the latest **major version**.
* This will usually require QA testing to ensure that nothing has broken between versions.

#### Bug fixes

Sometimes, it's necessary to upgrade the Electron version in order to resolve a bug in the app caused by the framework. If this is the case, please change the dependency according to the above guidelines, and the PR will be merged and released as per the same guidelines.

## Other dependencies

We try to keep the majority of dependencies up-to-date as much as possible, with a few exceptions:
- **React:** We generally keep the same version of `react` in the Desktop App for as long as possible, unless an upgrade or a new feature is required. Since the Desktop App doesn't rely too heavily on `react`, it's better for us to avoid introducing potential breaking changes unless something urgently needs to change.
- **Webpack:** Upgrading `webpack` requires us to change our configuration significantly, so we generally keep it the same unless we need to make a change.
