// Copyright 2021 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build go1.17
// +build go1.17

package draw

import (
	"image/draw"
)

// The package documentation, in draw.go, gives the intent of this package:
//
//     This package is a superset of and a drop-in replacement for the
//     image/draw package in the standard library.
//
// "Drop-in replacement" means that we use type aliases in this file.
//
// TODO: move the type aliases to draw.go once Go 1.16 is no longer supported.

// RGBA64Image extends both the Image and image.RGBA64Image interfaces with a
// SetRGBA64 method to change a single pixel. SetRGBA64 is equivalent to
// calling Set, but it can avoid allocations from converting concrete color
// types to the color.Color interface type.
type RGBA64Image = draw.RGBA64Image
