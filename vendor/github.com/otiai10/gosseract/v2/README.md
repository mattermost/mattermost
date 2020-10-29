# gosseract OCR
[![Build Status](https://travis-ci.org/otiai10/gosseract.svg?branch=master)](https://travis-ci.org/otiai10/gosseract)
[![codecov](https://codecov.io/gh/otiai10/gosseract/branch/master/graph/badge.svg)](https://codecov.io/gh/otiai10/gosseract)
[![Go Report Card](https://goreportcard.com/badge/github.com/otiai10/gosseract)](https://goreportcard.com/report/github.com/otiai10/gosseract)
[![GoDoc](https://godoc.org/github.com/otiai10/gosseract?status.svg)](https://godoc.org/github.com/otiai10/gosseract)

Golang OCR package, by using Tesseract C++ library.

# OCR Server

Do you just want OCR server, or see the working example of this package? Yes, there is already-made server application, which is seriously easy to deploy!

👉 https://github.com/otiai10/ocrserver

# Example

```go
package main

import (
	"fmt"
	"github.com/otiai10/gosseract"
)

func main() {
	client := gosseract.NewClient()
	defer client.Close()
	client.SetImage("path/to/image.png")
	text, _ := client.Text()
	fmt.Println(text)
	// Hello, World!
}
```

# Install

1. [tesseract-ocr](https://github.com/tesseract-ocr/tesseract/wiki), including library and headers
2. `go get -t github.com/otiai10/gosseract`

Check [Dockerfile](https://github.com/otiai10/gosseract/blob/master/Dockerfile) for more detail of installation, or you can just try by `docker run -it --rm otiai10/gosseract`.

# Test

In case you have [tesseract-ocr](https://github.com/tesseract-ocr/tesseract/wiki) on your local, you can just hit

```
% go test .
```

Otherwise, if you **DON'T** want to install tesseract-ocr on your local, kick `./test/runtime` which is using Docker and Vagrant to test the source code on some runtimes.

```
% ./test/runtime --driver docker
% ./test/runtime --driver vagrant
```

Check [./test/runtimes](https://github.com/otiai10/gosseract/tree/master/test/runtimes) for more information about runtime tests.

# Issues

- [https://github.com/otiai10/gosseract/issues](https://github.com/otiai10/gosseract/issues?utf8=%E2%9C%93&q=is%3Aissue)
