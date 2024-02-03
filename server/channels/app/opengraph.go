// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"html"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/adampresley/gofavigrab/parser"
	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/dyatlov/go-opengraph/opengraph/types/image"
	"golang.org/x/net/html/charset"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	MaxOpenGraphResponseSize   = 1024 * 1024 * 50
	openGraphMetadataCacheSize = 10000
)

func (a *App) GetOpenGraphMetadata(requestURL string) ([]byte, error) {
	if !*a.Config().ServiceSettings.EnableLinkPreviews || !a.isLinkAllowedForPreview(requestURL) {
		return nil, model.NewAppError("GetOpenGraphMetadata", "app.channels.opengraph.error", nil, "", http.StatusForbidden)
	}

	var ogJSONGeneric []byte
	err := a.Srv().openGraphDataCache.Get(requestURL, &ogJSONGeneric)
	if err == nil {
		return ogJSONGeneric, nil
	}

	res, err := a.HTTPService().MakeClient(false).Get(requestURL)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	graph := a.parseOpenGraphMetadata(requestURL, res.Body, res.Header.Get("Content-Type"))

	ogJSON, err := graph.ToJSON()
	if err != nil {
		return nil, err
	}
	err = a.Srv().openGraphDataCache.SetWithExpiry(requestURL, ogJSON, 1*time.Hour)
	if err != nil {
		return nil, err
	}

	return ogJSON, nil
}

func (a *App) parseOpenGraphMetadata(requestURL string, body io.Reader, contentType string) *opengraph.OpenGraph {
	og := opengraph.NewOpenGraph()
	body = forceHTMLEncodingToUTF8(io.LimitReader(body, MaxOpenGraphResponseSize), contentType)

	html, err := io.ReadAll(body)
	if err != nil {
		mlog.Warn("Problem reading HTTP body content")
		return nil
	}
	if err := og.ProcessHTML(bytes.NewReader(html)); err != nil {
		mlog.Warn("parseOpenGraphMetadata processing failed", mlog.String("requestURL", requestURL), mlog.Err(err))
	}

	fav, _ := parseLinkFavicon(requestURL, html)

	if fav != "" {
		og.Images = append(og.Images, &image.Image{
			URL:       fav,
			SecureURL: "",
			Type:      "image/x-mm-icon",
			Width:     0,
			Height:    0,
		})
	}

	makeOpenGraphURLsAbsolute(og, requestURL)

	openGraphDecodeHTMLEntities(og)

	// If image proxy enabled modify open graph data to feed though proxy
	if toProxyURL := a.ImageProxyAdder(); toProxyURL != nil {
		og = openGraphDataWithProxyAddedToImageURLs(og, toProxyURL)
	}

	// The URL should be the link the user provided in their message, not a redirected one.
	if og.URL != "" {
		og.URL = requestURL
	}

	return og
}

func parseLinkFavicon(requestURL string, html []byte) (string, error) {
	htmlParser := parser.NewHTMLParser(string(html))

	url, err := htmlParser.GetFaviconURL()
	if err != nil {
		mlog.Warn("Problem reading the HTTP body content: favicon")
		return "", err
	}

	return url, nil
}

func forceHTMLEncodingToUTF8(body io.Reader, contentType string) io.Reader {
	r, err := charset.NewReader(body, contentType)
	if err != nil {
		mlog.Warn("forceHTMLEncodingToUTF8 failed to convert", mlog.String("contentType", contentType), mlog.Err(err))
		return body
	}
	return r
}

func makeOpenGraphURLsAbsolute(og *opengraph.OpenGraph, requestURL string) {
	parsedRequestURL, err := url.Parse(requestURL)
	if err != nil {
		mlog.Warn("makeOpenGraphURLsAbsolute failed to parse url", mlog.String("requestURL", requestURL), mlog.Err(err))
		return
	}

	makeURLAbsolute := func(resultURL string) string {
		if resultURL == "" {
			return resultURL
		}

		parsedResultURL, err := url.Parse(resultURL)
		if err != nil {
			mlog.Warn("makeOpenGraphURLsAbsolute failed to parse result", mlog.String("requestURL", requestURL), mlog.Err(err))
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

func openGraphDataWithProxyAddedToImageURLs(ogdata *opengraph.OpenGraph, toProxyURL func(string) string) *opengraph.OpenGraph {
	for _, image := range ogdata.Images {
		var url string
		if image.SecureURL != "" {
			url = image.SecureURL
		} else {
			url = image.URL
		}

		image.URL = ""
		image.SecureURL = toProxyURL(url)
	}

	return ogdata
}

func openGraphDecodeHTMLEntities(og *opengraph.OpenGraph) {
	og.Title = html.UnescapeString(og.Title)
	og.Description = html.UnescapeString(og.Description)
}
