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
// resize srcImage to size = 128x128px using the Lanczos filter
dstImage128 := imaging.Resize(srcImage, 128, 128, imaging.Lanczos)

// resize srcImage to width = 800px preserving the aspect ratio
dstImage800 := imaging.Resize(srcImage, 800, 0, imaging.Lanczos)

// scale down srcImage to fit the 800x600px bounding box
dstImageFit := imaging.Fit(srcImage, 800, 600, imaging.Lanczos)

// resize and crop the srcImage to fill the 100x100px area
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

Original image. Will be resized from 512x512px to 128x128px. 

![srcImage](http://disintegration.github.io/imaging/in_lena_bw_512.png)

Filter | Resize result
---|---
`imaging.NearestNeighbor` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_nearest.png) 
`imaging.Box` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_box.png)
`imaging.Linear` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_linear.png)
`imaging.MitchellNetravali` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_mitchell.png)
`imaging.CatmullRom` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_catrom.png)
`imaging.Gaussian` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_gaussian.png)
`imaging.Lanczos` | ![dstImage](http://disintegration.github.io/imaging/out_resize_down_lanczos.png)

**Resize functions comparison**

Original image:

![srcImage](http://disintegration.github.io/imaging/in.jpg)

Resize the image to width=100px and height=100px:

```go
dstImage := imaging.Resize(srcImage, 100, 100, imaging.Lanczos)
```
![dstImage](http://disintegration.github.io/imaging/out-comp-resize.jpg) 

Resize the image to width=100px preserving the aspect ratio:

```go
dstImage := imaging.Resize(srcImage, 100, 0, imaging.Lanczos)
```
![dstImage](http://disintegration.github.io/imaging/out-comp-fit.jpg) 

Resize the image to fit the 100x100px boundng box preserving the aspect ratio:

```go
dstImage := imaging.Fit(srcImage, 100, 100, imaging.Lanczos)
```
![dstImage](http://disintegration.github.io/imaging/out-comp-fit.jpg) 

Resize and crop the image with a center anchor point to fill the 100x100px area:

```go
dstImage := imaging.Fill(srcImage, 100, 100, imaging.Center, imaging.Lanczos)
```
![dstImage](http://disintegration.github.io/imaging/out-comp-fill.jpg) 

### Gaussian Blur
```go
dstImage := imaging.Blur(srcImage, 0.5)
```

Sigma parameter allows to control the strength of the blurring effect.

Original image | Sigma = 0.5 | Sigma = 1.5
---|---|---
![srcImage](http://disintegration.github.io/imaging/in_lena_bw_128.png) | ![dstImage](http://disintegration.github.io/imaging/out_blur_0.5.png) | ![dstImage](http://disintegration.github.io/imaging/out_blur_1.5.png)

### Sharpening
```go
dstImage := imaging.Sharpen(srcImage, 0.5)
```

Uses gaussian function internally. Sigma parameter allows to control the strength of the sharpening effect.

Original image | Sigma = 0.5 | Sigma = 1.5
---|---|---
![srcImage](http://disintegration.github.io/imaging/in_lena_bw_128.png) | ![dstImage](http://disintegration.github.io/imaging/out_sharpen_0.5.png) | ![dstImage](http://disintegration.github.io/imaging/out_sharpen_1.5.png)

### Gamma correction
```go
dstImage := imaging.AdjustGamma(srcImage, 0.75)
```

Original image | Gamma = 0.75 | Gamma = 1.25
---|---|---
![srcImage](http://disintegration.github.io/imaging/in_lena_bw_128.png) | ![dstImage](http://disintegration.github.io/imaging/out_gamma_0.75.png) | ![dstImage](http://disintegration.github.io/imaging/out_gamma_1.25.png)

### Contrast adjustment
```go
dstImage := imaging.AdjustContrast(srcImage, 20)
```

Original image | Contrast = 20 | Contrast = -20
---|---|---
![srcImage](http://disintegration.github.io/imaging/in_lena_bw_128.png) | ![dstImage](http://disintegration.github.io/imaging/out_contrast_p20.png) | ![dstImage](http://disintegration.github.io/imaging/out_contrast_m20.png)

### Brightness adjustment
```go
dstImage := imaging.AdjustBrightness(srcImage, 20)
```

Original image | Brightness = 20 | Brightness = -20
---|---|---
![srcImage](http://disintegration.github.io/imaging/in_lena_bw_128.png) | ![dstImage](http://disintegration.github.io/imaging/out_brightness_p20.png) | ![dstImage](http://disintegration.github.io/imaging/out_brightness_m20.png)


### Complete code example
Here is the code example that loads several images, makes thumbnails of them
and combines them together side-by-side.

```go
package main

import (
    "image"
    "image/color"
    
    "github.com/disintegration/imaging"
)

func main() {

    // input files
    files := []string{"01.jpg", "02.jpg", "03.jpg"}

    // load images and make 100x100 thumbnails of them
    var thumbnails []image.Image
    for _, file := range files {
        img, err := imaging.Open(file)
        if err != nil {
            panic(err)
        }
        thumb := imaging.Thumbnail(img, 100, 100, imaging.CatmullRom)
        thumbnails = append(thumbnails, thumb)
    }

    // create a new blank image
    dst := imaging.New(100*len(thumbnails), 100, color.NRGBA{0, 0, 0, 0})

    // paste thumbnails into the new image side by side
    for i, thumb := range thumbnails {
        dst = imaging.Paste(dst, thumb, image.Pt(i*100, 0))
    }

    // save the combined image to file
    err := imaging.Save(dst, "dst.jpg")
    if err != nil {
        panic(err)
    }
}
```
