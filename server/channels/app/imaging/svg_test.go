// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseSVG(t *testing.T) {
	testCases := []struct {
		name           string
		svg            string
		expectedWidth  int
		expectedHeight int
		expectError    bool
	}{
		{
			name:           "unit-less width and height",
			svg:            `<svg width="640" height="480"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:           "width and height in px",
			svg:            `<svg width="640px" height="480px"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:           "width and height in uppercase px",
			svg:            `<svg width="640PX" height="480PX"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:           "fractional width and height",
			svg:            `<svg width="640.4" height="479.6"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:           "absolute width and height take precedence over the viewBox",
			svg:            `<svg viewBox="0 0 800 600" width="640" height="480"></svg>`,
			expectedWidth:  640,
			expectedHeight: 480,
		},
		{
			name:           "viewBox separated by spaces",
			svg:            `<svg viewBox="0 0 800 600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "viewBox separated by commas",
			svg:            `<svg viewBox="0,0,800,600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "viewBox separated by commas and spaces",
			svg:            `<svg viewBox="0, 0, 800, 600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "fractional viewBox dimensions",
			svg:            `<svg viewBox="0 0 800.4 599.6"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "percentage width and height fall back to the viewBox",
			svg:            `<svg width="100%" height="100%" viewBox="0 0 800 600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "sub-pixel width and height fall back to the viewBox",
			svg:            `<svg width="0.4" height="0.4" viewBox="0 0 800 600"></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:           "dimensions are only read from the root element",
			svg:            `<?xml version="1.0"?><!DOCTYPE svg><!-- comment --><svg viewBox="0 0 800 600"><svg width="10" height="10"></svg></svg>`,
			expectedWidth:  800,
			expectedHeight: 600,
		},
		{
			name:        "percentage width and height without a viewBox",
			svg:         `<svg width="100%" height="100%"></svg>`,
			expectError: true,
		},
		{
			name:        "font relative width and height without a viewBox",
			svg:         `<svg width="10em" height="20rem"></svg>`,
			expectError: true,
		},
		{
			name:        "viewport relative width and height without a viewBox",
			svg:         `<svg width="50vw" height="50vh"></svg>`,
			expectError: true,
		},
		{
			// Absolute in CSS, but converting physical units is beyond what previews need
			name:        "physical width and height without a viewBox",
			svg:         `<svg width="10cm" height="5in"></svg>`,
			expectError: true,
		},
		{
			name:        "keyword width and height without a viewBox",
			svg:         `<svg width="auto" height="auto"></svg>`,
			expectError: true,
		},
		{
			name:        "no width, height or viewBox",
			svg:         `<svg xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%"/></svg>`,
			expectError: true,
		},
		{
			name:        "width without a height",
			svg:         `<svg width="640"></svg>`,
			expectError: true,
		},
		{
			name:        "height without a width",
			svg:         `<svg height="480"></svg>`,
			expectError: true,
		},
		{
			name:        "zero width",
			svg:         `<svg width="0" height="480"></svg>`,
			expectError: true,
		},
		{
			name:        "zero height",
			svg:         `<svg width="640" height="0"></svg>`,
			expectError: true,
		},
		{
			name:        "zero viewBox dimensions",
			svg:         `<svg viewBox="0 0 0 0"></svg>`,
			expectError: true,
		},
		{
			name:        "negative width and height",
			svg:         `<svg width="-640" height="-480"></svg>`,
			expectError: true,
		},
		{
			name:        "non-finite width and height",
			svg:         `<svg width="NaN" height="Inf"></svg>`,
			expectError: true,
		},
		{
			name:        "width and height beyond the int range",
			svg:         `<svg width="1e300" height="1e300"></svg>`,
			expectError: true,
		},
		{
			name:        "viewBox beyond the int range",
			svg:         `<svg viewBox="0 0 1e300 1e300"></svg>`,
			expectError: true,
		},
		{
			name:        "viewBox with too few values",
			svg:         `<svg viewBox="0 0 800"></svg>`,
			expectError: true,
		},
		{
			name:        "viewBox with too many values",
			svg:         `<svg viewBox="0 0 800 600 900"></svg>`,
			expectError: true,
		},
		{
			name:        "no root element",
			svg:         `<?xml version="1.0" encoding="utf-8"?>`,
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			svgInfo, err := ParseSVG(strings.NewReader(tc.svg))

			if tc.expectError {
				require.Error(t, err)
				require.Zero(t, svgInfo.Width)
				require.Zero(t, svgInfo.Height)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tc.expectedWidth, svgInfo.Width)
			require.Equal(t, tc.expectedHeight, svgInfo.Height)
		})
	}
}
