# gifresize [![GoDoc](https://godoc.org/willnorris.com/go/gifresize?status.svg)](https://godoc.org/willnorris.com/go/gifresize) [![Apache 2.0 License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat)](LICENSE)

gifresize is a simple go package for transforming animated GIFs.

Import using:

```go
import "willnorris.com/go/gifresize"
```

Then call `gifresize.Process` with the source io.Reader and destination
io.Writer as well as the transformation to be applied to each frame in the GIF.
See [example/main.go][] for a simple example.

[example/main.go]: ./example/main.go
