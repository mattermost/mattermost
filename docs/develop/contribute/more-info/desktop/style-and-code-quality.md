---
title: "Style and code quality"
sidebar_position: 3
---

We run automated style and type-checking against every new PR that is created and the new code must pass before it can be merged.  
In some rare cases you can override these, but this is strongly discouraged.

#### Linter

We make use of `eslint` to enforce good coding style in the Desktop App.

You can run the linter using the following command:

```text
npm run lint:js
```

Outside of the linter, we generally allow for a loose coding style, although the reviewer of the PR has the final say.

#### Type checker

We make use of TypeScript in our application to help reduce errors when coding.

You can run the type checker by running the following command:

```text
npm run check-types
```

#### Submitting great PRs

Jesse Hallam has written an excellent blog post entitled "Submitting Great PRs" that can be found [here](https://mattermost.com/blog/submitting-great-prs/)
