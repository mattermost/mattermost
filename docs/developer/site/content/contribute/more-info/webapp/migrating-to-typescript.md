---
title: "Migrate to Typescript"
heading: "Migrate to Typescript - Mattermost"
description: "We introduced Typescript to our codebase to proactively improve the quality, security, and stability of the code."
date: 2020-07-11T23:00:00-04:00
weight: 9
aliases:
  - /contribute/webapp/migrating-to-typescript
---

The Mattermost team wants to proactively improve the quality, security, and stability of {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/webapp" title="the code" >}}, and one way to do this is by introducing the usage of type checking. Thus, we have decided to introduce Typescript in our codebase as it's a mature and feature-rich approach. 

As a first step, we have migrated the {{< newtabref href="https://github.com/mattermost/mattermost-redux" title="mattermost-redux" >}} library to use Typescript, and are now in the process of migrating the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/webapp" title="web app" >}} to use Typescript.

This campaign will help with the migration by converting files written in Javascript to type-safe files written in Typescript.

By completing this campaign, we're looking to:

- Reduce the errors derived from changes.
- Increase the consistency of the code.
- Ensure a more defensive programming in the code.

## Contribute

If you're interested in contributing, please join the {{< newtabref href="https://community.mattermost.com/core/channels/typescript-migration" title="Typescript Migration channel on community.mattermost.com" >}}. You can also check out the {{< newtabref href="https://community.mattermost.com/core/channels/tickets" title="Contributors" >}} channel, where there are several posts mentioning tickets related to this campaign, each containing the hashtag `#typescriptmigration`. You can work on migrating an individual module to Typescript by claiming a ticket that matches {{< newtabref href="https://github.com/mattermost/mattermost/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22Area%2FTechnical+Debt%22+label%3A%22Up+For+Grabs%22+Migrate+to+Typescript" title="this GitHub issue search" >}}.

## Component migration steps

There are a few steps involved with migrating a file to use Typescript. Some of them may not apply to every file and they may change slightly based on the file you're working on. In general, you can follow these steps as a checklist for work that needs to be done on each file.

1. Every React component's set of `props` needs to be converted to a new type. You can use the component's `propTypes` as a template for what `props` a given component can expect. This conversion to Typescript includes maintaining whether a given `prop` is required or not. An optional property in Typescript is noted by including a question mark at the end of the property's name.
2. A component's `state` also needs to be defined using a type. The initial `state` assignment and any call to `setState` will be indicators of what values are present in the component's state.
3. Once a component's `props` and `state` (if any) have been converted, you can define the component as `class MyComponent extends React.PureComponent<Props, State>`. You can omit the `State` portion if the component does not have its own `state`.
4. Avoid use of the `any` type except in test files. The components themselves should be as well-defined as possible.
5. Most objects we used are typed in the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/webapp/platform/types" title="@mattermost/types" >}} library, if you can't find a type you're looking for.
6. Check that the types are all correct using the `make check-types` command.

## Examples

You can see example pull requests here:

- https://github.com/mattermost/mattermost/pull/5840
- https://github.com/mattermost/mattermost/pull/5244
