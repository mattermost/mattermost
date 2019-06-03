smartcrop
=========

smartcrop finds good image crops for arbitrary sizes. It is a pure Go implementation, based on Jonas Wagner's [smartcrop.js](https://github.com/jwagner/smartcrop.js)

![Example](./examples/gopher.jpg)
Image: [https://www.flickr.com/photos/usfwspacific/8182486789](https://www.flickr.com/photos/usfwspacific/8182486789) by Washington Dept of Fish and Wildlife, originally licensed under [CC-BY-2.0](https://creativecommons.org/licenses/by/2.0/) when the image was imported back in September 2014

![Example](./examples/goodtimes.jpg)
Image: [https://www.flickr.com/photos/endogamia/5682480447](https://www.flickr.com/photos/endogamia/5682480447) by Leon F. Cabeiro (N. Feans), licensed under [CC-BY-2.0](https://creativecommons.org/licenses/by/2.0/)

## Installation

Make sure you have a working Go environment (Go 1.4 or higher is required).
See the [install instructions](http://golang.org/doc/install.html).

To install smartcrop, simply run:

    go get github.com/muesli/smartcrop

To compile it from source:

    cd $GOPATH/src/github.com/muesli/smartcrop
    go get -u -v
    go build && go test -v

## Example
```go
package main

import (
	"fmt"
	"image"
	_ "image/png"
	"os"

	"github.com/muesli/smartcrop"
	"github.com/muesli/smartcrop/nfnt"
)

func main() {
	f, _ := os.Open("image.png")
	img, _, _ := image.Decode(f)

	analyzer := smartcrop.NewAnalyzer(nfnt.NewDefaultResizer())
	topCrop, _ := analyzer.FindBestCrop(img, 250, 250)

	// The crop will have the requested aspect ratio, but you need to copy/scale it yourself
	fmt.Printf("Top crop: %+v\n", topCrop)

	type SubImager interface {
		SubImage(r image.Rectangle) image.Image
	}
	croppedimg := img.(SubImager).SubImage(topCrop)
	// ...
}
```

Also see the test cases in smartcrop_test.go for further working examples.

## Sample Data
You can find a bunch of test images for the algorithm [here](https://github.com/muesli/smartcrop-samples).

## Development
Join us on IRC: irc.freenode.net/#smartcrop

[![GoDoc](https://godoc.org/github.com/golang/gddo?status.svg)](https://godoc.org/github.com/muesli/smartcrop)
[![Build Status](https://travis-ci.org/muesli/smartcrop.svg?branch=master)](https://travis-ci.org/muesli/smartcrop)
[![Coverage Status](https://coveralls.io/repos/github/muesli/smartcrop/badge.svg?branch=master)](https://coveralls.io/github/muesli/smartcrop?branch=master)
[![Go ReportCard](http://goreportcard.com/badge/muesli/smartcrop)](http://goreportcard.com/report/muesli/smartcrop)
