# PSD/PSB(Photoshop) file reader for Go programming language

It works almost well but it is still in development.

## License

MIT License

Copyright (c) 2016 oov

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## How to use

### Example1

Simple psd -> png conversion.

```go
package main

import (
	"image"
	"image/png"
	"os"

	_ "github.com/oov/psd"
)

func main() {
	file, err := os.Open("image.psd")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		panic(err)
	}

	out, err := os.Create("image.png")
	if err != nil {
		panic(err)
	}
	err = png.Encode(out, img)
	if err != nil {
		panic(err)
	}
}
```

### Example2

Extract all layer images.

```go
package main

import (
	"fmt"
	"image/png"
	"os"

	"github.com/oov/psd"
)

func processLayer(filename string, layerName string, l *psd.Layer) error {
	if len(l.Layer) > 0 {
		for i, ll := range l.Layer {
			if err := processLayer(
				fmt.Sprintf("%s_%03d", filename, i),
				layerName+"/"+ll.Name, &ll); err != nil {
				return err
			}
		}
	}
	if !l.HasImage() {
		return nil
	}
	fmt.Printf("%s -> %s.png\n", layerName, filename)
	out, err := os.Create(fmt.Sprintf("%s.png", filename))
	if err != nil {
		return err
	}
	defer out.Close()
	return png.Encode(out, l.Picker)
}

func main() {
	file, err := os.Open("image.psd")
	if err != nil {
		panic(err)
	}
	defer file.Close()

	img, _, err := psd.Decode(file, &psd.DecodeOptions{SkipMergedImage: true})
	if err != nil {
		panic(err)
	}
	for i, layer := range img.Layer {
		if err = processLayer(fmt.Sprintf("%03d", i), layer.Name, &layer); err != nil {
			panic(err)
		}
	}
}
```

# Current status

It is not implemented any blending functions because layer composition isn't covered by this package at present.

- [Image Resource Section](http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_69883) is parsed but [Image resource IDs](http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_38034) are not defined as constant.
- [Global layer mask info](http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_17115) is not parsed.
- [Layer blending ranges data](http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_21332) is not parsed.
- [Additional Layer Information](http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_pgfId-1049436) is parsed but keys are almost not defined as constant.

## Color Modes

### Implemented

- Bitmap 1bit
- Grayscale 8bit
- Grayscale 16bit
- Grayscale 32bit
- Indexed
- RGB 8bit
- RGB 16bit
- RGB 32bit
- CMYK 8bit
- CMYK 16bit

### Not implemented

- CMYK 32bit
- Multichannel
- Duotone
- Lab

## Supported Compression Methods

- Raw
- RLE(PackBits)
- ZIP without prediction (not tested)
- ZIP with prediction
