# Imaging

[![GoDoc](https://godoc.org/github.com/disintegration/imaging?status.svg)](https://godoc.org/github.com/disintegration/imaging)
[![Build Status](https://travis-ci.org/disintegration/imaging.svg?branch=master)](https://travis-ci.org/disintegration/imaging)
[![Coverage Status](https://coveralls.io/repos/github/disintegration/imaging/badge.svg?branch=master)](https://coveralls.io/github/disintegration/imaging?branch=master)

Package imaging provides basic image manipulation functions (resize, rotate, flip, crop, etc.). 
This package is based on the standard Go image package and works best along with it. 

Image manipulation functions provided by the package take any image type 
that implements `image.Image` interface as an input, and return a new image of 
`*image.NRGBA` type (32bit RGBA colors, not premultiplied by alpha).

## Installation

Imaging requires Go version 1.2 or greater.

    go get -u github.com/disintegration/imaging
    
## Documentation

http://godoc.org/github.com/disintegration/imaging

## Usage examples

A few usage examples can be found below. See the documentation for the full list of supported functions. 

### Image resizing

```go
// Resize srcImage to size = 128x128px using the Lanczos filter.
dstImage128 := imaging.Resize(srcImage, 128, 128, imaging.Lanczos)

// Resize srcImage to width = 800px preserving the aspect ratio.
dstImage800 := imaging.Resize(srcImage, 800, 0, imaging.Lanczos)

// Scale down srcImage to fit the 800x600px bounding box.
dstImageFit := imaging.Fit(srcImage, 800, 600, imaging.Lanczos)

// Resize and crop the srcImage to fill the 100x100px area.
dstImageFill := imaging.Fill(srcImage, 100, 100, imaging.Center, imaging.Lanczos)
```

Imaging supports image resizing using various resampling filters. The most notable ones:
- `NearestNeighbor` - Fastest resampling filter, no antialiasing.
- `Box` - Simple and fast averaging filter appropriate for downscaling. When upscaling it's similar to NearestNeighbor.
- `Linear` - Bilinear filter, smooth and reasonably fast.
- `MitchellNetravali` - А smooth bicubic filter.
- `CatmullRom` - A sharp bicubic filter. 
- `Gaussian` - Blurring filter that uses gaussian function, useful for noise removal.
- `Lanczos` - High-quality resampling filter for photographic images yielding sharp results, but it's slower than cubic filters.

The full list of supported filters:  NearestNeighbor, Box, Linear, Hermite, MitchellNetravali, CatmullRom, BSpline, Gaussian, Lanczos, Hann, Hamming, Blackman, Bartlett, Welch, Cosine. Custom filters can be created using ResampleFilter struct.

**Resampling filters comparison**

The original image.

![srcImage](testdata/lena_512.png)

The same image resized from 512x512px to 128x128px using different resampling filters.
From faster (lower quality) to slower (higher quality):

Filter                    | Resize result
--------------------------|---------------------------------------------
`imaging.NearestNeighbor` | ![dstImage](testdata/out_resize_nearest.png) 
`imaging.Linear`          | ![dstImage](testdata/out_resize_linear.png)
`imaging.CatmullRom`      | ![dstImage](testdata/out_resize_catrom.png)
`imaging.Lanczos`         | ![dstImage](testdata/out_resize_lanczos.png)


### Gaussian Blur

```go
dstImage := imaging.Blur(srcImage, 0.5)
```

Sigma parameter allows to control the strength of the blurring effect.

Original image                     | Sigma = 0.5                            | Sigma = 1.5
-----------------------------------|----------------------------------------|---------------------------------------
![srcImage](testdata/lena_128.png) | ![dstImage](testdata/out_blur_0.5.png) | ![dstImage](testdata/out_blur_1.5.png)

### Sharpening

```go
dstImage := imaging.Sharpen(srcImage, 0.5)
```

`Sharpen` uses gaussian function internally. Sigma parameter allows to control the strength of the sharpening effect.

Original image                     | Sigma = 0.5                               | Sigma = 1.5
-----------------------------------|-------------------------------------------|------------------------------------------
![srcImage](testdata/lena_128.png) | ![dstImage](testdata/out_sharpen_0.5.png) | ![dstImage](testdata/out_sharpen_1.5.png)

### Gamma correction

```go
dstImage := imaging.AdjustGamma(srcImage, 0.75)
```

Original image                     | Gamma = 0.75                             | Gamma = 1.25
-----------------------------------|------------------------------------------|-----------------------------------------
![srcImage](testdata/lena_128.png) | ![dstImage](testdata/out_gamma_0.75.png) | ![dstImage](testdata/out_gamma_1.25.png)

### Contrast adjustment

```go
dstImage := imaging.AdjustContrast(srcImage, 20)
```

Original image                     | Contrast = 10                              | Contrast = -10
-----------------------------------|--------------------------------------------|-------------------------------------------
![srcImage](testdata/lena_128.png) | ![dstImage](testdata/out_contrast_p10.png) | ![dstImage](testdata/out_contrast_m10.png)

### Brightness adjustment

```go
dstImage := imaging.AdjustBrightness(srcImage, 20)
```

Original image                     | Brightness = 10                              | Brightness = -10
-----------------------------------|----------------------------------------------|---------------------------------------------
![srcImage](testdata/lena_128.png) | ![dstImage](testdata/out_brightness_p10.png) | ![dstImage](testdata/out_brightness_m10.png)

## Example code

```go
package main

import (
	"image"
	"image/color"
	"log"

	"github.com/disintegration/imaging"
)

func main() {
	// Open the test image.
	src, err := imaging.Open("testdata/lena_512.png")
	if err != nil {
		log.Fatalf("Open failed: %v", err)
	}

	// Crop the original image to 350x350px size using the center anchor.
	src = imaging.CropAnchor(src, 350, 350, imaging.Center)

	// Resize the cropped image to width = 256px preserving the aspect ratio.
	src = imaging.Resize(src, 256, 0, imaging.Lanczos)

	// Create a blurred version of the image.
	img1 := imaging.Blur(src, 2)

	// Create a grayscale version of the image with higher contrast and sharpness.
	img2 := imaging.Grayscale(src)
	img2 = imaging.AdjustContrast(img2, 20)
	img2 = imaging.Sharpen(img2, 2)

	// Create an inverted version of the image.
	img3 := imaging.Invert(src)

	// Create an embossed version of the image using a convolution filter.
	img4 := imaging.Convolve3x3(
		src,
		[9]float64{
			-1, -1, 0,
			-1, 1, 1,
			0, 1, 1,
		},
		nil,
	)

	// Create a new image and paste the four produced images into it.
	dst := imaging.New(512, 512, color.NRGBA{0, 0, 0, 0})
	dst = imaging.Paste(dst, img1, image.Pt(0, 0))
	dst = imaging.Paste(dst, img2, image.Pt(0, 256))
	dst = imaging.Paste(dst, img3, image.Pt(256, 0))
	dst = imaging.Paste(dst, img4, image.Pt(256, 256))

	// Save the resulting image using JPEG format.
	err = imaging.Save(dst, "testdata/out_example.jpg")
	if err != nil {
		log.Fatalf("Save failed: %v", err)
	}
}
```

Output:

![dstImage](testdata/out_example.jpg)