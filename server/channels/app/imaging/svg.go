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

// ParseSVG returns dimensions from viewBox or absolute width/height attributes.
func ParseSVG(svgReader io.Reader) (SVGInfo, error) {
	svgInfo := SVGInfo{}

	decoder := xml.NewDecoder(svgReader)

	for {
		token, err := decoder.Token()
		if err != nil {
			return svgInfo, err
		}

		start, ok := token.(xml.StartElement)
		if !ok {
			continue
		}

		var (
			viewBoxWidth, viewBoxHeight int
			hasViewBox                  bool
			attrWidth, attrHeight       int
			hasWidth, hasHeight         bool
		)

		for _, attr := range start.Attr {
			switch attr.Name.Local {
			case "viewBox":
				if w, h, valid := parseViewBox(attr.Value); valid {
					viewBoxWidth, viewBoxHeight, hasViewBox = w, h, true
				}
			case "width":
				if v, valid := parseAbsoluteLength(attr.Value); valid {
					attrWidth, hasWidth = v, true
				}
			case "height":
				if v, valid := parseAbsoluteLength(attr.Value); valid {
					attrHeight, hasHeight = v, true
				}
			}
		}

		if hasViewBox {
			svgInfo.Width = viewBoxWidth
			svgInfo.Height = viewBoxHeight
			return svgInfo, nil
		}

		if hasWidth && hasHeight {
			svgInfo.Width = attrWidth
			svgInfo.Height = attrHeight
			return svgInfo, nil
		}

		return svgInfo, errors.New("unable to extract SVG dimensions")
	}
}

func parseViewBox(value string) (int, int, bool) {
	fields := strings.FieldsFunc(value, func(r rune) bool {
		return r == ',' || unicode.IsSpace(r)
	})
	if len(fields) != 4 {
		return 0, 0, false
	}

	width, widthOK := parseDimension(fields[2])
	height, heightOK := parseDimension(fields[3])
	if !widthOK || !heightOK || width <= 0 || height <= 0 {
		return 0, 0, false
	}

	return width, height, true
}

func parseAbsoluteLength(value string) (int, bool) {
	value = strings.TrimSpace(value)
	if value == "" || strings.HasSuffix(value, "%") {
		return 0, false
	}

	length, ok := parseDimension(strings.TrimSuffix(value, "px"))
	if !ok || length <= 0 {
		return 0, false
	}

	return length, true
}

func parseDimension(value string) (int, bool) {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, false
	}

	return int(math.Round(parsed)), true
}
