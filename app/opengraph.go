// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/url"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/mlog"
	"golang.org/x/net/html/charset"
)

func (a *App) GetOpenGraphMetadata(requestURL string) *opengraph.OpenGraph {
	og := opengraph.NewOpenGraph()

	res, err := a.HTTPClient(false).Get(requestURL)
	if err != nil {
		mlog.Error(fmt.Sprintf("GetOpenGraphMetadata request failed for url=%v with err=%v", requestURL, err.Error()))
		return og
	}
	defer consumeAndClose(res)

	contentType := res.Header.Get("Content-Type")
	body := forceHTMLEncodingToUTF8(res.Body, contentType)

	if err := og.ProcessHTML(body); err != nil {
		mlog.Error(fmt.Sprintf("GetOpenGraphMetadata processing failed for url=%v with err=%v", requestURL, err.Error()))
	}

	makeOpenGraphURLsAbsolute(og, requestURL)

	// The URL should be the link the user provided in their message, not a redirected one.
	if og.URL != "" {
		og.URL = requestURL
	}

	return og
}

func forceHTMLEncodingToUTF8(body io.Reader, contentType string) io.Reader {
	r, err := charset.NewReader(body, contentType)
	if err != nil {
		mlog.Error(fmt.Sprintf("forceHTMLEncodingToUTF8 failed to convert for contentType=%v with err=%v", contentType, err.Error()))
		return body
	}
	return r
}

func makeOpenGraphURLsAbsolute(og *opengraph.OpenGraph, requestURL string) {
	parsedRequestURL, err := url.Parse(requestURL)
	if err != nil {
		mlog.Warn(fmt.Sprintf("makeOpenGraphURLsAbsolute failed to parse url=%v", requestURL))
		return
	}

	makeURLAbsolute := func(resultURL string) string {
		if resultURL == "" {
			return resultURL
		}

		parsedResultURL, err := url.Parse(resultURL)
		if err != nil {
			mlog.Warn(fmt.Sprintf("makeOpenGraphURLsAbsolute failed to parse result url=%v", resultURL))
			return resultURL
		}

		if parsedResultURL.IsAbs() {
			return resultURL
		}

		return parsedRequestURL.ResolveReference(parsedResultURL).String()
	}

	og.URL = makeURLAbsolute(og.URL)

	for _, image := range og.Images {
		image.URL = makeURLAbsolute(image.URL)
		image.SecureURL = makeURLAbsolute(image.SecureURL)
	}

	for _, audio := range og.Audios {
		audio.URL = makeURLAbsolute(audio.URL)
		audio.SecureURL = makeURLAbsolute(audio.SecureURL)
	}

	for _, video := range og.Videos {
		video.URL = makeURLAbsolute(video.URL)
		video.SecureURL = makeURLAbsolute(video.SecureURL)
	}
}
