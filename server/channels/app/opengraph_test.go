// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strings"
	"testing"

	"github.com/dyatlov/go-opengraph/opengraph"
	ogImage "github.com/dyatlov/go-opengraph/opengraph/types/image"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func BenchmarkForceHTMLEncodingToUTF8(b *testing.B) {
	HTML := `
		<html>
			<head>
				<meta property="og:url" content="https://example.com/apps/mattermost">
				<meta property="og:image" content="https://images.example.com/image.png">
			</head>
		</html>
	`
	ContentType := "text/html; utf-8"

	b.Run("with converting", func(b *testing.B) {
		for b.Loop() {
			r := forceHTMLEncodingToUTF8(strings.NewReader(HTML), ContentType)

			og := opengraph.NewOpenGraph()
			err := og.ProcessHTML(r)
			require.NoError(b, err)
		}
	})

	b.Run("without converting", func(b *testing.B) {
		for b.Loop() {
			og := opengraph.NewOpenGraph()
			err := og.ProcessHTML(strings.NewReader(HTML))
			require.NoError(b, err)
		}
	})
}

func TestMakeOpenGraphURLsAbsolute(t *testing.T) {
	mainHelper.Parallel(t)
	for name, tc := range map[string]struct {
		HTML       string
		RequestURL string
		URL        string
		ImageURL   string
	}{
		"absolute URLs": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="https://example.com/apps/mattermost">
						<meta property="og:image" content="https://images.example.com/image.png">
					</head>
				</html>`,
			RequestURL: "https://example.com",
			URL:        "https://example.com/apps/mattermost",
			ImageURL:   "https://images.example.com/image.png",
		},
		"URLs starting with /": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
						<meta property="og:image" content="/image.png">
					</head>
				</html>`,
			RequestURL: "http://example.com",
			URL:        "http://example.com/apps/mattermost",
			ImageURL:   "http://example.com/image.png",
		},
		"HTTPS URLs starting with /": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
						<meta property="og:image" content="/image.png">
					</head>
				</html>`,
			RequestURL: "https://example.com",
			URL:        "https://example.com/apps/mattermost",
			ImageURL:   "https://example.com/image.png",
		},
		"missing image URL": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
					</head>
				</html>`,
			RequestURL: "http://example.com",
			URL:        "http://example.com/apps/mattermost",
			ImageURL:   "",
		},
		"relative URLs": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="index.html">
						<meta property="og:image" content="../resources/image.png">
					</head>
				</html>`,
			RequestURL: "http://example.com/content/index.html",
			URL:        "http://example.com/content/index.html",
			ImageURL:   "http://example.com/resources/image.png",
		},
	} {
		t.Run(name, func(t *testing.T) {
			og := opengraph.NewOpenGraph()
			err := og.ProcessHTML(strings.NewReader(tc.HTML))
			require.NoError(t, err)

			makeOpenGraphURLsAbsolute(og, tc.RequestURL)

			assert.Equalf(t, og.URL, tc.URL, "incorrect url, expected %v, got %v", tc.URL, og.URL)

			if len(og.Images) > 0 {
				assert.Equalf(t, og.Images[0].URL, tc.ImageURL, "incorrect image url, expected %v, got %v", tc.ImageURL, og.Images[0].URL)
			} else {
				assert.Empty(t, tc.ImageURL, "missing image url, expected %v, got nothing", tc.ImageURL)
			}
		})
	}
}

func TestOpenGraphDecodeHTMLEntities(t *testing.T) {
	mainHelper.Parallel(t)
	og := opengraph.NewOpenGraph()
	og.Title = "Test&#39;s are the best.&copy;"
	og.Description = "Test&#39;s are the worst.&copy;"

	openGraphDecodeHTMLEntities(og)

	assert.Equal(t, og.Title, "Test's are the best.©")
	assert.Equal(t, og.Description, "Test's are the worst.©")
}

func TestIsSVGURL(t *testing.T) {
	mainHelper.Parallel(t)
	testCases := []struct {
		name     string
		url      string
		expected bool
	}{
		{
			name:     "empty URL",
			url:      "",
			expected: false,
		},
		{
			name:     "PNG image",
			url:      "https://example.com/image.png",
			expected: false,
		},
		{
			name:     "JPEG image",
			url:      "https://example.com/image.jpg",
			expected: false,
		},
		{
			name:     "SVG image lowercase",
			url:      "https://example.com/image.svg",
			expected: true,
		},
		{
			name:     "SVG image uppercase",
			url:      "https://example.com/image.SVG",
			expected: true,
		},
		{
			name:     "SVG image mixed case",
			url:      "https://example.com/image.Svg",
			expected: true,
		},
		{
			name:     "SVGZ compressed SVG",
			url:      "https://example.com/image.svgz",
			expected: true,
		},
		{
			name:     "SVG with query parameters",
			url:      "https://example.com/image.svg?v=123",
			expected: true,
		},
		{
			name:     "SVG with fragment",
			url:      "https://example.com/image.svg#section",
			expected: true,
		},
		{
			name:     "path containing svg but not extension",
			url:      "https://example.com/svg/image.png",
			expected: false,
		},
		{
			name:     "filename containing svg but different extension",
			url:      "https://example.com/mysvgfile.png",
			expected: false,
		},
		{
			name:     "relative SVG path",
			url:      "/images/icon.svg",
			expected: true,
		},
		{
			name:     "invalid URL",
			url:      "://invalid",
			expected: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := model.IsSVGImageURL(tc.url)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestFilterSVGImagesFromOpenGraph(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("nil OpenGraph", func(t *testing.T) {
		result := filterSVGImagesFromOpenGraph(nil)
		assert.Nil(t, result)
	})

	t.Run("empty images", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{}
		result := filterSVGImagesFromOpenGraph(og)
		assert.Empty(t, result.Images)
	})

	t.Run("filter SVG by URL extension", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/image.png"},
			{URL: "https://example.com/icon.svg"},
			{URL: "https://example.com/photo.jpg"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		require.Len(t, result.Images, 2)
		assert.Equal(t, "https://example.com/image.png", result.Images[0].URL)
		assert.Equal(t, "https://example.com/photo.jpg", result.Images[1].URL)
	})

	t.Run("filter SVG by SecureURL extension", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{SecureURL: "https://example.com/banner.png"},
			{SecureURL: "https://example.com/icon.svg"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		require.Len(t, result.Images, 1)
		assert.Equal(t, "https://example.com/banner.png", result.Images[0].SecureURL)
	})

	t.Run("filter SVG by MIME type", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/image.png", Type: "image/png"},
			{URL: "https://example.com/image", Type: "image/svg+xml"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		require.Len(t, result.Images, 1)
		assert.Equal(t, "https://example.com/image.png", result.Images[0].URL)
	})

	t.Run("filter SVGZ compressed images", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/image.png"},
			{URL: "https://example.com/compressed.svgz"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		require.Len(t, result.Images, 1)
		assert.Equal(t, "https://example.com/image.png", result.Images[0].URL)
	})

	t.Run("filter all images when all are SVG", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/image1.svg"},
			{URL: "https://example.com/image2.svg"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		assert.Empty(t, result.Images)
	})

	t.Run("skip nil images in slice", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/image.png"},
			nil,
			{URL: "https://example.com/photo.jpg"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		require.Len(t, result.Images, 2)
	})

	t.Run("preserve non-image OpenGraph fields", func(t *testing.T) {
		og := opengraph.NewOpenGraph()
		og.Title = "Test Title"
		og.Description = "Test Description"
		og.URL = "https://example.com"
		og.Images = []*ogImage.Image{
			{URL: "https://example.com/icon.svg"},
		}
		result := filterSVGImagesFromOpenGraph(og)
		assert.Equal(t, "Test Title", result.Title)
		assert.Equal(t, "Test Description", result.Description)
		assert.Equal(t, "https://example.com", result.URL)
		assert.Empty(t, result.Images)
	})
}
