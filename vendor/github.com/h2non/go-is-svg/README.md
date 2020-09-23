# go-is-svg [![Build Status](https://travis-ci.org/h2non/go-is-svg.png)](https://travis-ci.org/h2non/go-is-svg) [![GoDoc](https://godoc.org/github.com/h2non/go-is-svg?status.svg)](https://godoc.org/github.com/h2non/go-is-svg) [![Coverage Status](https://coveralls.io/repos/github/h2non/go-is-svg/badge.svg?branch=master)](https://coveralls.io/github/h2non/go-is-svg?branch=master) [![Go Report Card](https://goreportcard.com/badge/github.com/h2non/go-is-svg)](https://goreportcard.com/report/github.com/h2non/go-is-svg)

Tiny package to verify if a given file buffer is an SVG image in Go (golang).

See also [filetype](https://github.com/h2non/filetype) package for binary files type inference.

## Installation

```bash
go get -u github.com/h2non/go-is-svg
```

## Example

```go
package main

import (
	"fmt"
	"io/ioutil"

	svg "github.com/h2non/go-is-svg"
)

func main() {
	buf, err := ioutil.ReadFile("_example/example.svg")
	if err != nil {
		fmt.Printf("Error: %s\n", err)
		return
	}

	if svg.Is(buf) {
		fmt.Println("File is an SVG")
	} else {
		fmt.Println("File is NOT an SVG")
	}
}
```

Run example:
```bash
go run _example/example.go
```

## License

MIT - Tomas Aparicio
