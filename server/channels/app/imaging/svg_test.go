// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

//nolint:unparam
func generateSVGData(width int, height int, useViewBox bool, useDimensions bool, useAlternateFormat bool) io.Reader {
	var (
		viewBoxAttribute = ""
		widthAttribute   = ""
		heightAttribute  = ""
	)
	if useViewBox == true {
		separator := " "
		if useAlternateFormat == true {
			separator = ", "
		}
		viewBoxAttribute = fmt.Sprintf(` viewBox="0%s0%s%d%s%d"`, separator, separator, width, separator, height)
	}
	if useDimensions == true && width > 0 && height > 0 {
		units := ""
		if useAlternateFormat == true {
			units = "px"
		}
		widthAttribute = fmt.Sprintf(` width="%d%s"`, width, units)
		heightAttribute = fmt.Sprintf(` height="%d%s"`, height, units)
	}
	svgString := fmt.Sprintf(`<svg%s%s%s></svg>`, widthAttribute, heightAttribute, viewBoxAttribute)
	return strings.NewReader(svgString)
}

func TestParseValidSVGData(t *testing.T) {
	var width, height int = 300, 300
	validSVGs := []io.Reader{
		generateSVGData(width, height, true, true, false),  // properly formed viewBox, width & height
		generateSVGData(width, height, true, true, true),   // properly formed viewBox, width & height; alternate format
		generateSVGData(width, height, false, true, false), // missing viewBox, properly formed width & height
		generateSVGData(width, height, false, true, true),  // missing viewBox, properly formed width & height; alternate format
	}
	for index, svg := range validSVGs {
		svgInfo, err := ParseSVG(svg)
		if err != nil {
			t.Errorf("Should be able to parse SVG attributes at index %d, but was not able to: err = %v", index, err)
		} else {
			if svgInfo.Width != width {
				t.Errorf("Expecting a width of %d for SVG at index %d, but it was %d instead.", width, index, svgInfo.Width)
			}

			if svgInfo.Height != height {
				t.Errorf("Expecting a height of %d for SVG at index %d, but it was %d instead.", height, index, svgInfo.Height)
			}
		}
	}
}

func TestParseInvalidSVGData(t *testing.T) {
	var width, height int = 300, 300
	invalidSVGs := []io.Reader{
		generateSVGData(width, height, false, false, false), // missing viewBox, width & height
		generateSVGData(width, 0, false, true, false),       // missing viewBox, malformed width & height
		generateSVGData(width, 0, false, true, false),       // missing viewBox, malformed height, properly formed width
	}
	for index, svg := range invalidSVGs {
		_, err := ParseSVG(svg)
		if err == nil {
			t.Errorf("Should not be able to parse SVG attributes at index %d, but was definitely able to!", index)
		}
	}
}

func TestParseProcInstOnlySVGData(t *testing.T) {
	svg := strings.NewReader("<?xml version='1.0' encoding='utf-8'?>")
	svgInfo, err := ParseSVG(svg)
	require.Error(t, err)
	require.Equal(t, 0, svgInfo.Width)
	require.Equal(t, 0, svgInfo.Height)
}
