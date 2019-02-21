// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func generateSVGString(width int, height int, useViewBox bool, useDimensions bool, useAlternateFormat bool) string {
	var (
		viewBoxAttribute = ""
		widthAttribute   = ""
		heightAttribute  = ""
	)
	if useViewBox == true && useAlternateFormat == true {
		viewBoxAttribute = fmt.Sprintf(` viewBox="0, 0, %d, %d"`, width, height)
	} else if useViewBox == true {
		viewBoxAttribute = fmt.Sprintf(` viewBox="0 0 %d %d"`, width, height)
	}
	if useDimensions == true && width > 0 && height > 0 {
		widthAttribute = fmt.Sprintf(` width="%d"`, width)
		heightAttribute = fmt.Sprintf(` height="%d"`, height)
		if useAlternateFormat == true {
			widthAttribute = widthAttribute + "px"
			heightAttribute = heightAttribute + "px"
		}
	}
	return fmt.Sprintf(`<svg%s%s%s></svg>`, widthAttribute, heightAttribute, viewBoxAttribute)
}

func TestParseValidSVGData(t *testing.T) {
	var width, height int = 300, 300
	validSVGs := []string{
		generateSVGString(width, height, true, true, false),  // properly formed viewBox, width & height
		generateSVGString(width, height, true, true, true),   // properly formed viewBox, width & height; alternate format
		generateSVGString(width, height, false, true, false), // missing viewBox, properly formed width & height
		generateSVGString(width, height, false, true, true),  // missing viewBox, properly formed width & height; alternate format
	}
	var fileInfo model.FileInfo
	for index, svg := range validSVGs {
		fileInfo = model.FileInfo{}
		if err := parseSVGDimensions(&fileInfo, []byte(svg)); err != nil {
			t.Errorf("Should be able to parse SVG at index %d, but was not able to: err = %v", index, err)
		} else {
			if fileInfo.Width != width {
				t.Errorf("Expecting a width of %d for SVG at index %d, but it was %d instead.", width, index, fileInfo.Width)
			}

			if fileInfo.Height != height {
				t.Errorf("Expecting a height of %d for SVG at index %d, but it was %d instead.", height, index, fileInfo.Height)
			}
		}
	}
}

func TestParseInvalidSVGData(t *testing.T) {
	var width, height int = 300, 300
	invalidSVGs := []string{
		generateSVGString(width, height, false, false, false), // missing viewBox, width & height
		generateSVGString(width, 0, false, true, false),       // missing viewBox, malformed width & height
		generateSVGString(300, 0, false, true, false),         // missing viewBox, malformed height, properly formed width
	}
	var fileInfo model.FileInfo
	for index, svg := range invalidSVGs {
		fileInfo = model.FileInfo{}
		if err := parseSVGDimensions(&fileInfo, []byte(svg)); err == nil {
			t.Errorf("Should not be able to parse SVG at index %d, but was definitely able to!", index)
		}
	}
}
