[![GoDoc](https://godoc.org/github.com/go-ldap/ldap?status.svg)](https://godoc.org/github.com/go-ldap/ldap)
[![Build Status](https://travis-ci.org/go-ldap/ldap.svg)](https://travis-ci.org/go-ldap/ldap)

# Basic LDAP v3 functionality for the GO programming language.

## Features:

 - Connecting to LDAP server (non-TLS, TLS, STARTTLS)
 - Binding to LDAP server
 - Searching for entries
 - Filter Compile / Decompile
 - Paging Search Results
 - Modify Requests / Responses
 - Add Requests / Responses
 - Delete Requests / Responses
 - Modify DN Requests / Responses

## Examples:

 - search
 - modify

## Go Modules:

`go get github.com/go-ldap/ldap/v3`

As go-ldap was v2+ when Go Modules came out, updating to Go Modules would be considered a breaking change.

To maintain backwards compatability, we ultimately decided to use subfolders (as v3 was already a branch).
Whilst this duplicates the code, we can move toward implementing a backwards-compatible versioning system that allows for code reuse.
The alternative would be to increment the version number, however we believe that this would confuse users as v3 is in line with LDAPv3 (RFC-4511)
https://tools.ietf.org/html/rfc4511


For more info, please visit the pull request that updated to modules.
https://github.com/go-ldap/ldap/pull/247

To install with `GOMODULE111=off`, use `go get github.com/go-ldap/ldap`
https://golang.org/cmd/go/#hdr-Legacy_GOPATH_go_get

As always, we are looking for contributors with great ideas on how to best move forward.


## Contributing:

Bug reports and pull requests are welcome!

Before submitting a pull request, please make sure tests and verification scripts pass:
```
make all
```

To set up a pre-push hook to run the tests and verify scripts before pushing:
```
ln -s ../../.githooks/pre-push .git/hooks/pre-push
```

---
The Go gopher was designed by Renee French. (http://reneefrench.blogspot.com/)
The design is licensed under the Creative Commons 3.0 Attributions license.
Read this article for more details: http://blog.golang.org/gopher
