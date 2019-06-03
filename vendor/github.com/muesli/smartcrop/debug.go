/*
 * Copyright (c) 2014 Christian Muehlhaeuser
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 *	Authors:
 *		Christian Muehlhaeuser <muesli@gmail.com>
 *		Michael Wendland <michael@michiwend.com>
 *		Bjørn Erik Pedersen <bjorn.erik.pedersen@gmail.com>
 */

/*
Package smartcrop implements a content aware image cropping library based on
Jonas Wagner's smartcrop.js https://github.com/jwagner/smartcrop.js
*/
package smartcrop

import (
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
)

func debugOutput(debug bool, img *image.RGBA, debugType string) {
	if debug {
		writeImage("png", img, "./smartcrop_"+debugType+".png")
	}
}

func writeImage(imgtype string, img image.Image, name string) error {
	if err := os.MkdirAll(filepath.Dir(name), 0755); err != nil {
		panic(err)
	}

	switch imgtype {
	case "png":
		return writeImageToPng(img, name)
	case "jpeg":
		return writeImageToJpeg(img, name)
	}

	return errors.New("Unknown image type")
}

func writeImageToJpeg(img image.Image, name string) error {
	fso, err := os.Create(name)
	if err != nil {
		return err
	}
	defer fso.Close()

	return jpeg.Encode(fso, img, &jpeg.Options{Quality: 100})
}

func writeImageToPng(img image.Image, name string) error {
	fso, err := os.Create(name)
	if err != nil {
		return err
	}
	defer fso.Close()

	return png.Encode(fso, img)
}

func drawDebugCrop(topCrop Crop, o *image.RGBA) {
	width := o.Bounds().Dx()
	height := o.Bounds().Dy()

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			r, g, b, _ := o.At(x, y).RGBA()
			r8 := float64(r >> 8)
			g8 := float64(g >> 8)
			b8 := uint8(b >> 8)

			imp := importance(topCrop, x, y)

			if imp > 0 {
				g8 += imp * 32
			} else if imp < 0 {
				r8 += imp * -64
			}

			nc := color.RGBA{uint8(bounds(r8)), uint8(bounds(g8)), b8, 255}
			o.SetRGBA(x, y, nc)
		}
	}
}
