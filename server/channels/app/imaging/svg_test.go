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

func TestParseSVGDimensionSources(t *testing.T) {
	testCases := []struct {
		name           string
		svg            string
		expectErr      bool
		expectedWidth  int
		expectedHeight int
	}{
		{
			name:           "viewBox only",
			svg:            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256"></svg>`,
			expectedWidth:  512,
			expectedHeight: 256,
		},
		{
			name:           "absolute width and height in pixels without viewBox",
			svg:            `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="480px"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:      "mixed percentage and absolute dimensions without viewBox is not usable",
			svg:       `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="480"></svg>`,
			expectErr: true,
		},
		{
			name:      "degenerate viewBox falls back and fails when no usable dimensions remain",
			svg:       `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 0"></svg>`,
			expectErr: true,
		},
		{
			name:           "comma separated viewBox without spaces",
			svg:            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0,0,800,600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "viewBox preferred over percentage width and height",
			svg:            `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 640 480"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:      "percentage width and height without viewBox is not usable",
			svg:       `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"></svg>`,
			expectErr: true,
		},
		{
			name:      "dimensions in style attribute only are not usable",
			svg:       `<svg xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;"></svg>`,
			expectErr: true,
		},
		{
			name:           "float viewBox is rounded",
			svg:            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100.6 200.4"></svg>`,
			expectedWidth:  101,
			expectedHeight: 200,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			svgInfo, err := ParseSVG(strings.NewReader(tc.svg))
			if tc.expectErr {
				require.Error(t, err)
				require.Equal(t, 0, svgInfo.Width)
				require.Equal(t, 0, svgInfo.Height)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedWidth, svgInfo.Width)
			require.Equal(t, tc.expectedHeight, svgInfo.Height)
		})
	}
}
