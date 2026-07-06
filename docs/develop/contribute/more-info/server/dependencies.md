---
title: "Dependencies"
sidebar_position: 5
---


The Mattermost server uses [Go modules](https://github.com/golang/go/wiki/Modules) to manage dependencies.

## Add or update a new dependency

Adding a dependency is easy. All you have to do is import the dependency in the code and recompile. The dependency will be automatically added for you. Updating uses the same procedure.

Before committing the code with your new dependency added, be sure to run `go mod tidy` to maintain a consistent format and `go mod vendor` to synchronize the vendor directory.

If you want to add or update to a specific version of a dependency you can use a command of the form:
```bash
go get -u github.com/pkg/errors@v0.8.1
go mod tidy
go mod vendor
```

If you just want whatever the latest version is, you can leave off the `@version` tag.

## Remove a dependency

Be sure you have enabled go modules support. After removing all references to the dependency in the code, you run:
```bash
go mod tidy
go mod vendor
```
to remove it from the `go.mod` file and the `vendor` directory.
