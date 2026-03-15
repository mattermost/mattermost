---
title: "Style and code quality"
heading: "Style and code quality"
description: "Good code quality is important to maintaining the desktop app"
date: 2019-01-22T00:00:00-05:00
weight: 3
aliases:
  - /contribute/desktop/style-and-code-quality
---

We run automated style and type-checking against every new PR that is created and the new code must pass before it can be merged.  
In some rare cases you can override these, but this is strongly discouraged.

#### Linter

We make use of `eslint` to enforce good coding style in the Desktop App.

You can run the linter using the following command:

    npm run lint:js

Outside of the linter, we generally allow for a loose coding style, although the reviewer of the PR has the final say.

#### Type checker

We make use of TypeScript in our application to help reduce errors when coding.

You can run the type checker by running the following command:

    npm run check-types

#### Submitting great PRs

Jesse Hallam has written an excellent blog post entitled "Submitting Great PRs" that can be found {{< newtabref href="https://mattermost.com/blog/submitting-great-prs/" title="here" >}}
