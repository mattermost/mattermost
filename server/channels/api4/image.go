// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"cmp"
	"net/http"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.APISessionRequiredTrustRequester(getImage)).Methods(http.MethodGet)
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	cfg := c.App.Config()
	isBlockMode := cfg.ImageProxySettings.IsBlockMode()

	actualURL := r.URL.Query().Get("url")
	if isBlockMode && actualURL == "" {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest)
		return
	}
	parsedURL, err := url.Parse(actualURL)
	if err != nil {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if parsedURL.Opaque != "" {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest)
		return
	}
	siteURLStr := *cfg.ServiceSettings.SiteURL
	siteURL, err := url.Parse(siteURLStr)
	if err != nil {
		c.Err = model.NewAppError("getImage", "model.config.is_valid.site_url.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if isBlockMode && siteURL.Scheme != "" && siteURL.Host != "" {
		siteBase := *siteURL
		siteBase.Path = strings.TrimRight(siteURL.Path, "/") + "/"
		parsedURL = siteBase.ResolveReference(parsedURL)
	} else {
		parsedURL.Scheme = cmp.Or(parsedURL.Scheme, siteURL.Scheme)
		if parsedURL.Host == "" {
			parsedURL.Host = siteURL.Host
		}
	}

	if *cfg.ImageProxySettings.Enable {
		var isExternal bool
		if isBlockMode {
			isExternal = model.IsExternalImageURL(actualURL, siteURLStr)
		} else {
			isExternal = parsedURL.Host != siteURL.Host
		}

		if isExternal {
			c.App.ImageProxy().GetImage(w, r, parsedURL.String())
		} else {
			http.Redirect(w, r, parsedURL.String(), http.StatusFound)
		}
		return
	}

	// When proxy disabled this endpoint should fail as we don't support redirecting to external images any longer (MM-54477).
	c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest)
}
