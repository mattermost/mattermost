// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"encoding/xml"
	"fmt"
	"io"
	"strings"

	"github.com/pkg/errors"
)

// SVGInfo holds information for a SVG image.
type SVGInfo struct {
	Width  int
	Height int
}

// ParseSVG returns information for the given SVG input data.
func ParseSVG(svgReader io.Reader) (SVGInfo, error) {
	svgInfo := SVGInfo{
		Width:  0,
		Height: 0,
	}

	decoder := xml.NewDecoder(svgReader)

	for {
		token, err := decoder.Token()
		if err != nil {
			return svgInfo, err
		}
		switch t := token.(type) {
		case xml.StartElement:
			for _, attr := range t.Attr {
				if attr.Name.Local == "viewBox" {
					values := strings.Fields(attr.Value)
					if len(values) == 4 {
						width := 0
						_, widthErr := fmt.Sscan(values[2], &width)

						height := 0
						_, heightErr := fmt.Sscan(values[3], &height)

						if widthErr != nil || heightErr != nil {
							return svgInfo, err
						}

						svgInfo.Width = width
						svgInfo.Height = height

						return svgInfo, nil
					}
				}
				if attr.Name.Local == "width" {
					width := 0
					_, err := fmt.Sscan(attr.Value, &width)

					if err != nil {
						return svgInfo, err
					}

					svgInfo.Width = width
				}
				if attr.Name.Local == "height" {
					height := 0
					_, err := fmt.Sscan(attr.Value, &height)

					if err != nil {
						return svgInfo, err
					}

					svgInfo.Height = height
				}
			}

			if svgInfo.Width == 0 || svgInfo.Height == 0 {
				return svgInfo, errors.New("unable to extract SVG dimensions")
			}

			return svgInfo, nil
		}
	}
}
