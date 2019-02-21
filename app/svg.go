// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/xml"
	"regexp"
	"strconv"

	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

func parseSVGDimensions(fileInfo *model.FileInfo, svgData []byte) error {
	var svgInfo struct {
		XMLName xml.Name `xml:"svg"`
		Width   string   `xml:"width,attr,omitempty"`
		Height  string   `xml:"height,attr,omitempty"`
		ViewBox string   `xml:"viewBox,attr,omitempty"`
	}

	if err := xml.Unmarshal(svgData, &svgInfo); err != nil {
		return err
	}

	viewBoxPattern := regexp.MustCompile("^([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)[, ]+([0-9]+)$")
	dimensionPattern := regexp.MustCompile("(?i)^([0-9]+)(?:px)?$")
	var width = 0
	var height = 0

	// prefer viewbox for SVG dimensions over width/height
	if viewBoxMatches := viewBoxPattern.FindStringSubmatch(svgInfo.ViewBox); len(viewBoxMatches) == 5 {
		width, _ = strconv.Atoi(viewBoxMatches[3])
		height, _ = strconv.Atoi(viewBoxMatches[4])
	} else if len(svgInfo.Width) > 0 && len(svgInfo.Height) > 0 {
		widthMatches := dimensionPattern.FindStringSubmatch(svgInfo.Width)
		heightMatches := dimensionPattern.FindStringSubmatch(svgInfo.Height)
		if len(widthMatches) == 2 && len(heightMatches) == 2 {
			width, _ = strconv.Atoi(widthMatches[1])
			height, _ = strconv.Atoi(heightMatches[1])
		}
	}

	// set width/height if both have successfully been extracted
	if width > 0 && height > 0 {
		fileInfo.Width = width
		fileInfo.Height = height
	} else {
		return errors.New("unable to extract SVG dimensions")
	}
	return nil
}
