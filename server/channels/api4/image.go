// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"net/url"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.APISessionRequiredTrustRequester(getImage)).Methods(http.MethodGet)
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	actualURL := r.URL.Query().Get("url")
	parsedURL, err := url.Parse(actualURL)
	if err != nil {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	} else if parsedURL.Opaque != "" {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest)
		return
	}
	siteURL, err := url.Parse(*c.App.Config().ServiceSettings.SiteURL)
	if err != nil {
		c.Err = model.NewAppError("getImage", "model.config.is_valid.site_url.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if parsedURL.Scheme == "" {
		parsedURL.Scheme = siteURL.Scheme
	}
	if parsedURL.Host == "" {
		parsedURL.Host = siteURL.Host
	}

	if *c.App.Config().ImageProxySettings.Enable {
		// in case image proxy is enabled and we are fetching a remote image (NOT static or served by plugins), pass request to proxy
		if parsedURL.Host != siteURL.Host {
			c.App.ImageProxy().GetImage(w, r, parsedURL.String())
		} else {
			// Otherwise we redirect.
			http.Redirect(w, r, parsedURL.String(), http.StatusFound)
		}
		return
	}

	// When proxy disabled this endpoint should fail as we don't support redirecting to external images any longer (MM-54477).
	c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, "", http.StatusBadRequest)
}
