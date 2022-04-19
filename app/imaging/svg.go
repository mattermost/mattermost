// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"encoding/xml"
	"io"
	"fmt"
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
						_, err := fmt.Sscan(values[2], &width)

						if err != nil {
							svgInfo.Width = width
						}

						height := 0
						_, err = fmt.Sscan(values[3], &height)

						if err != nil {
							svgInfo.Height = height
						}

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

	// 	viewBoxPattern := regexp.MustCompile("^([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)$")
	// 	dimensionPattern := regexp.MustCompile("(?i)^([0-9]+)(?:px)?$")

	// prefer viewbox for SVG dimensions over width/height
	// 	if viewBoxMatches := viewBoxPattern.FindStringSubmatch(parsedSVG.ViewBox); len(viewBoxMatches) == 5 {
	// 		svgInfo.Width, _ = strconv.Atoi(viewBoxMatches[3])
	// 		svgInfo.Height, _ = strconv.Atoi(viewBoxMatches[4])
	// 	} else if parsedSVG.Width != "" && parsedSVG.Height != "" {
	// 		widthMatches := dimensionPattern.FindStringSubmatch(parsedSVG.Width)
	// 		heightMatches := dimensionPattern.FindStringSubmatch(parsedSVG.Height)
	// 		if len(widthMatches) == 2 && len(heightMatches) == 2 {
	// 			svgInfo.Width, _ = strconv.Atoi(widthMatches[1])
	// 			svgInfo.Height, _ = strconv.Atoi(heightMatches[1])
	// 		}
	// 	}
	//
	// 	// if width and/or height are still zero, create new error
	// 	if svgInfo.Width == 0 || svgInfo.Height == 0 {
	// 		return svgInfo, errors.New("unable to extract SVG dimensions")
	// 	}
	// 	return svgInfo, nil

	// commented out the above code since IMO this is not needed anymore with the approach using decoder.Token(),
	// but for the case it is still valid to do it I just commented it out

	return svgInfo, errors.New("unable to extract SVG dimensions")
}
