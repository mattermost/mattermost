# gosaml2

[![Build Status](https://travis-ci.org/russellhaering/gosaml2.svg?branch=master)](https://travis-ci.org/russellhaering/gosaml2)
[![GoDoc](https://godoc.org/github.com/russellhaering/gosaml2?status.svg)](https://godoc.org/github.com/russellhaering/gosaml2)

SAML 2.0 implemementation for Service Providers based on [etree](https://github.com/beevik/etree)
and [goxmldsig](https://github.com/russellhaering/goxmldsig), a pure Go
implementation of XML digital signatures.

## Installation

Install `gosaml2` into your `$GOPATH` using `go get`:

```
go get github.com/russellhaering/gosaml2
```

## Example

See [demo.go](s2example/demo.go).

## Supported Identity Providers

This library is meant to be a generic SAML implementation. If you find a
standards compliant identity provider that it doesn't work with please
submit a bug or pull request.

The following identity providers have been tested:

* Okta
* Auth0
* Shibboleth
* Ipsilon
* OneLogin
