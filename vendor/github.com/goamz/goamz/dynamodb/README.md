# Running integration tests

## against DynamoDB local

To download and launch DynamoDB local:

```sh
$ make
```

To test:

```sh
$ go test -v -amazon
```

## against real DynamoDB server on us-east

_WARNING_: Some dangerous operations such as `DeleteTable` will be performed during the tests. Please be careful.

To test:

```sh
$ go test -v -amazon -local=false
```

_Note_: Running tests against real DynamoDB will take several minutes.
