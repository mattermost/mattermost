// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"encoding/xml"
	"io"
	"math"
	"strconv"
	"strings"
	"unicode"

	"github.com/pkg/errors"
)

// SVGInfo holds information for a SVG image.
type SVGInfo struct {
	Width  int
	Height int
}

// ParseSVG returns information for the given SVG input data. Dimensions are read from the root
// element's width and height attributes, falling back to its viewBox when those don't declare an
// absolute size.
func ParseSVG(svgReader io.Reader) (SVGInfo, error) {
	decoder := xml.NewDecoder(svgReader)

	for {
		token, err := decoder.Token()
		if err != nil {
			return SVGInfo{}, err
		}

		root, ok := token.(xml.StartElement)
		if !ok {
			continue
		}

		var width, height, viewBox string
		for _, attr := range root.Attr {
			switch attr.Name.Local {
			case "width":
				width = attr.Value
			case "height":
				height = attr.Value
			case "viewBox":
				viewBox = attr.Value
			}
		}

		parsedWidth, widthOK := parseAbsoluteLength(width)
		parsedHeight, heightOK := parseAbsoluteLength(height)
		if widthOK && heightOK {
			return SVGInfo{Width: parsedWidth, Height: parsedHeight}, nil
		}

		if parsedWidth, parsedHeight, ok := parseViewBox(viewBox); ok {
			return SVGInfo{Width: parsedWidth, Height: parsedHeight}, nil
		}

		return SVGInfo{}, errors.New("unable to extract SVG dimensions")
	}
}

// parseAbsoluteLength converts an SVG length attribute into pixels. Only unit-less and px lengths
// are absolute: relative ones such as width="100%" or width="10em" are sized against a viewport
// that isn't known here, so they carry no usable dimension.
func parseAbsoluteLength(value string) (int, bool) {
	return parsePositiveNumber(strings.TrimSuffix(strings.ToLower(strings.TrimSpace(value)), "px"))
}

// parseViewBox returns the width and height declared by a viewBox attribute, whose four values may
// be separated by whitespace, commas, or both.
func parseViewBox(value string) (int, int, bool) {
	values := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || unicode.IsSpace(r)
	})
	if len(values) != 4 {
		return 0, 0, false
	}

	width, widthOK := parsePositiveNumber(values[2])
	height, heightOK := parsePositiveNumber(values[3])
	if !widthOK || !heightOK {
		return 0, 0, false
	}

	return width, height, true
}

// parsePositiveNumber parses a number of pixels, rejecting anything that can't describe a
// renderable size. A zero width or height means the SVG isn't rendered at all, so it is no more
// usable than a missing one.
func parsePositiveNumber(value string) (int, bool) {
	number, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(number) || math.IsInf(number, 0) {
		return 0, false
	}

	pixels := int(math.Round(number))
	if pixels <= 0 {
		return 0, false
	}

	return pixels, true
}
