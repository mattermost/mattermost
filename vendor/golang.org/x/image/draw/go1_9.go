// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.9 go1.8.typealias

package draw

import (
	"image/draw"
)

// We use type aliases (new in Go 1.9) for the exported names from the standard
// library's image/draw package. This is not merely syntactic sugar for
//
//	type Drawer draw.Drawer
//
// as aliasing means that the types in this package, such as draw.Image and
// draw.Op, are identical to the corresponding draw.Image and draw.Op types in
// the standard library. In comparison, prior to Go 1.9, the code in go1_8.go
// defines new types that mimic the old but are different types.
//
// The package documentation, in draw.go, explicitly gives the intent of this
// package:
//
//	This package is a superset of and a drop-in replacement for the
//	image/draw package in the standard library.
//
// Drop-in replacement means that I can replace all of my "image/draw" imports
// with "golang.org/x/image/draw", to access additional features in this
// package, and no further changes are required. That's mostly true, but not
// completely true unless we use type aliases.
//
// Without type aliases, users might need to import both "image/draw" and
// "golang.org/x/image/draw" in order to convert from two conceptually
// equivalent but different (from the compiler's point of view) types, such as
// from one draw.Op type to another draw.Op type, to satisfy some other
// interface or function signature.

// Drawer contains the Draw method.
type Drawer = draw.Drawer

// Image is an image.Image with a Set method to change a single pixel.
type Image = draw.Image

// Op is a Porter-Duff compositing operator.
type Op = draw.Op

const (
	// Over specifies ``(src in mask) over dst''.
	Over Op = draw.Over
	// Src specifies ``src in mask''.
	Src Op = draw.Src
)

// Quantizer produces a palette for an image.
type Quantizer = draw.Quantizer
