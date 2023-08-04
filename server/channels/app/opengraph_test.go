// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"github.com/mattermost/mattermost/server/public/model"
	"html/template"
	"strings"
	"testing"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		for i := 0; i < b.N; i++ {
			r := forceHTMLEncodingToUTF8(strings.NewReader(HTML), ContentType)

			og := opengraph.NewOpenGraph()
			og.ProcessHTML(r)
		}
	})

	b.Run("without converting", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			og := opengraph.NewOpenGraph()
			og.ProcessHTML(strings.NewReader(HTML))
		}
	})
}

func TestMakeOpenGraphURLsAbsolute(t *testing.T) {
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
	og := opengraph.NewOpenGraph()
	og.Title = "Test&#39;s are the best.&copy;"
	og.Description = "Test&#39;s are the worst.&copy;"

	openGraphDecodeHTMLEntities(og)

	assert.Equal(t, og.Title, "Test's are the best.©")
	assert.Equal(t, og.Description, "Test's are the worst.©")
}

func TestParseOpenGraphMetadata(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	opengraphPage := `<html prefix="og: https://ogp.me/ns#">
<head>
    <meta property="og:title" content="{{.Title}}" />
    <meta property="og:type" content="video.movie" />
</head></html>
`
	sizeOfJsonExceptTitle := 169
	type Title struct {
		Title string
	}

	tmpl, err := template.New("Test").Parse(opengraphPage)
	assert.NoError(t, err)

	page := new(bytes.Buffer)
	title := Title{Title: model.NewRandomString(openGraphMetadataCacheEntrySizeLimit - sizeOfJsonExceptTitle + 1)}
	err = tmpl.Execute(page, title)
	assert.NoError(t, err)

	_, _, err = th.App.parseOpenGraphMetadata("https://example.com", page, "")
	assert.Error(t, err)
	assert.Equal(t, err.Error(), "opengraph data exceeds cache entry size limit")

	page.Reset()
	title.Title = title.Title[1:]
	err = tmpl.Execute(page, title)
	assert.NoError(t, err)

	_, _, err = th.App.parseOpenGraphMetadata("https://example.com", page, "")
	assert.NoError(t, err)
}
