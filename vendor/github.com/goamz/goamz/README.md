# goamz - An Amazon Library for Go

[![Build Status](http://travis-ci.org/goamz/goamz.png?branch=master)](https://travis-ci.org/goamz/goamz)

The _goamz_ package enables Go programs to interact with Amazon Web Services.

This is a fork of the version [developed within Canonical](https://wiki.ubuntu.com/goamz) with additional functionality and services from [a number of contributors](https://github.com/goamz/goamz/contributors)!

The API of AWS is very comprehensive, though, and goamz doesn't even scratch the surface of it. That said, it's fairly well tested, and is the foundation in which further calls can easily be integrated. We'll continue extending the API as necessary - Pull Requests are _very_ welcome!

The following packages are available at the moment:

```
github.com/goamz/goamz/autoscaling
github.com/goamz/goamz/aws
github.com/goamz/goamz/cloudformation
github.com/goamz/goamz/cloudfront
github.com/goamz/goamz/cloudwatch
github.com/goamz/goamz/dynamodb
github.com/goamz/goamz/ecs
github.com/goamz/goamz/ec2
github.com/goamz/goamz/elb
github.com/goamz/goamz/iam
github.com/goamz/goamz/rds
github.com/goamz/goamz/route53
github.com/goamz/goamz/s3
github.com/goamz/goamz/sqs
github.com/goamz/goamz/sts

github.com/goamz/goamz/exp/mturk
github.com/goamz/goamz/exp/sdb
github.com/goamz/goamz/exp/sns
```

Packages under `exp/` are still in an experimental or unfinished/unpolished state.

## API documentation

The API documentation is currently available at:

[http://godoc.org/github.com/goamz/goamz](http://godoc.org/github.com/goamz/goamz)

## How to build and install goamz

Just use `go get` with any of the available packages. For example:

* `$ go get github.com/goamz/goamz/ec2`
* `$ go get github.com/goamz/goamz/s3`

## Running tests

To run tests, first install gocheck with:

`$ go get gopkg.in/check.v1`

Then run go test as usual:

`$ go test github.com/goamz/goamz/...`

_Note:_ running all tests with the command `go test ./...` will currently fail as tests do not tear down their HTTP listeners.

If you want to run integration tests (costs money), set up the EC2 environment variables as usual, and run:

$ gotest -i
