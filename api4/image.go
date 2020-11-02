// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"net/url"
	"regexp"

	"github.com/mattermost/mattermost-server/v5/model"
)

var protocolRelativeURLRegex = regexp.MustCompile(`^(\\|\/){2}.+`) // can be any one of //, \\, /\, or \/

func (api *API) InitImage() {
	api.BaseRoutes.Image.Handle("", api.ApiSessionRequiredTrustRequester(getImage)).Methods("GET")
}

func getImage(c *Context, w http.ResponseWriter, r *http.Request) {
	actualURL := r.URL.Query().Get("url")
	if protocolRelativeURLRegex.MatchString(actualURL) {
		scheme := "http"
		if *c.App.Config().ServiceSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
			scheme = "https"
		}
		actualURL = scheme + "://" + actualURL[2:]
	}
	parsedURL, err := url.Parse(actualURL)
	if err != nil {
		c.Err = model.NewAppError("getImage", "api.image.get.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	// in case image proxy is enabled and we are fetching a remote image (NOT static or served by plugins), pass request to proxy
	if *c.App.Config().ImageProxySettings.Enable && parsedURL.IsAbs() {
		c.App.ImageProxy().GetImage(w, r, actualURL)
	} else {
		http.Redirect(w, r, actualURL, http.StatusFound)
	}
}
