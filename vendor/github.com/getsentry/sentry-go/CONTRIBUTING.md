## Community

The public-facing channels for support and development of Sentry SDKs can be found on [Discord](https://discord.gg/Ww9hbqr).

## Testing

```console
$ go test
```

### Watch mode

Use: https://github.com/cespare/reflex

```console
$ reflex -g '*.go' -d "none" -- sh -c 'printf "\n"; go test'
```

### With data race detection

```console
$ go test -race
```

### Coverage
```console
$ go test -race -coverprofile=coverage.txt -covermode=atomic && go tool cover -html coverage.txt
```

## Linting

```console
$ golangci-lint run
```

## Release

1. Update `CHANGELOG.md` with new version in `vX.X.X` format title and list of changes.

    The command below can be used to get a list of changes since the last tag, with the format used in `CHANGELOG.md`:

    ```console
    $ git log --no-merges --format=%s $(git describe --abbrev=0).. | sed 's/^/- /'
    ```

2. Commit with `misc: vX.X.X changelog` commit message and push to `master`.

3. Let [`craft`](https://github.com/getsentry/craft) do the rest:

    ```console
    $ craft prepare X.X.X
    $ craft publish X.X.X
    ```
