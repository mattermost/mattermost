// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package webp implements a decoder for WEBP images.
//
// WEBP is defined at:
// https://developers.google.com/speed/webp/docs/riff_container
//
// It requires Go 1.6 or later.
package webp // import "golang.org/x/image/webp"

// This blank Go file, other than the package clause, exists so that this
// package can be built for Go 1.5 and earlier. (The other files in this
// package are all marked "+build go1.6" for the NYCbCrA types introduced in Go
// 1.6). There is no functionality in a blank package, but some image
// manipulation programs might still underscore import this package for the
// side effect of registering the WEBP format with the standard library's
// image.RegisterFormat and image.Decode functions. For example, that program
// might contain:
//
//	// Underscore imports to register some formats for image.Decode.
//	import _ "image/gif"
//	import _ "image/jpeg"
//	import _ "image/png"
//	import _ "golang.org/x/image/webp"
//
// Such a program will still compile for Go 1.5 (due to this placeholder Go
// file). It will simply not be able to recognize and decode WEBP (but still
// handle GIF, JPEG and PNG).
