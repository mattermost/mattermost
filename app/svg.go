// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/xml"
	"io"
	"regexp"
	"strconv"

	"github.com/pkg/errors"
)

type SVGInfo struct {
	Width  int
	Height int
}

func parseSVG(svgReader io.Reader) (SVGInfo, error) {
	var parsedSVG struct {
		Width   string `xml:"width,attr,omitempty"`
		Height  string `xml:"height,attr,omitempty"`
		ViewBox string `xml:"viewBox,attr,omitempty"`
	}
	svgInfo := SVGInfo{
		Width:  0,
		Height: 0,
	}
	viewBoxPattern := regexp.MustCompile("^([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)$")
	dimensionPattern := regexp.MustCompile("(?i)^([0-9]+)(?:px)?$")

	// decode provided SVG
	if err := xml.NewDecoder(svgReader).Decode(&parsedSVG); err != nil {
		return svgInfo, err
	}

	// prefer viewbox for SVG dimensions over width/height
	if viewBoxMatches := viewBoxPattern.FindStringSubmatch(parsedSVG.ViewBox); len(viewBoxMatches) == 5 {
		svgInfo.Width, _ = strconv.Atoi(viewBoxMatches[3])
		svgInfo.Height, _ = strconv.Atoi(viewBoxMatches[4])
	} else if len(parsedSVG.Width) > 0 && len(parsedSVG.Height) > 0 {
		widthMatches := dimensionPattern.FindStringSubmatch(parsedSVG.Width)
		heightMatches := dimensionPattern.FindStringSubmatch(parsedSVG.Height)
		if len(widthMatches) == 2 && len(heightMatches) == 2 {
			svgInfo.Width, _ = strconv.Atoi(widthMatches[1])
			svgInfo.Height, _ = strconv.Atoi(heightMatches[1])
		}
	}

	// if width and/or height are still zero, create new error
	if svgInfo.Width == 0 || svgInfo.Height == 0 {
		return svgInfo, errors.New("unable to extract SVG dimensions")
	}
	return svgInfo, nil
}
