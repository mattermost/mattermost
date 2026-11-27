// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

var errBlockedExternalImage = errors.New("external image blocked by image proxy configuration")

func (a *App) isExternalImageBlocked() bool {
	return a.Config().ImageProxySettings.IsBlockMode()
}

func hasImageFileExtension(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	trimmedPath := strings.TrimRight(parsed.Path, "/")
	switch strings.ToLower(path.Ext(trimmedPath)) {
	case ".png", ".apng", ".jpg", ".jpeg", ".jfif", ".pjpeg", ".gif", ".webp", ".bmp", ".ico", ".svg", ".svgz", ".tiff", ".tif", ".avif", ".heic", ".heif", ".jxl", ".jp2":
		return true
	default:
		return false
	}
}

// checkBlockedRedirect applies the block-mode redirect policy for link metadata fetches: it rejects
// redirects to the image proxy, to external URLs that look like images, and from an internal URL to
// an external one.
func checkBlockedRedirect(req *http.Request, via []*http.Request, siteURL string) error {
	targetURL := req.URL.String()
	if model.IsImageProxyURL(targetURL, siteURL) {
		return fmt.Errorf("%w: redirect target %q is image proxy", errBlockedExternalImage, req.URL.Redacted())
	}
	if model.IsExternalImageURL(targetURL, siteURL) {
		if hasImageFileExtension(targetURL) {
			return fmt.Errorf("%w: redirect to external image %q is blocked", errBlockedExternalImage, req.URL.Redacted())
		}
		if len(via) > 0 && !model.IsExternalImageURL(via[len(via)-1].URL.String(), siteURL) {
			return fmt.Errorf("%w: redirect from internal URL to external target %q is blocked", errBlockedExternalImage, req.URL.Redacted())
		}
	}
	return nil
}
