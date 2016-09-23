// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:generate genbasicfont -size=16 -pkg=inconsolata -hinting=full -var=regular8x16 -fontfile=http://www.levien.com/type/myfonts/inconsolata/InconsolataGo-Regular.ttf
//go:generate genbasicfont -size=16 -pkg=inconsolata -hinting=full -var=bold8x16 -fontfile=http://www.levien.com/type/myfonts/inconsolata/InconsolataGo-Bold.ttf

// The genbasicfont program is github.com/golang/freetype/example/genbasicfont

// Package inconsolata provides pre-rendered bitmap versions of the Inconsolata
// font family.
//
// Inconsolata is copyright Raph Levien and Cyreal. This package is licensed
// under Go's BSD-style license (https://golang.org/LICENSE) with their
// permission.
//
// Inconsolata's home page is at
// http://www.levien.com/type/myfonts/inconsolata.html
package inconsolata // import "golang.org/x/image/font/inconsolata"

import (
	"golang.org/x/image/font/basicfont"
)

// Regular8x16 is a regular weight, 8x16 font face.
var Regular8x16 *basicfont.Face = &regular8x16

// Bold8x16 is a bold weight, 8x16 font face.
var Bold8x16 *basicfont.Face = &bold8x16
