// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/utils"
)

// Wraps the functionality for creating a new http.Client to encapsulate that and allow it to be mocked when testing
type HTTPService interface {
	MakeClient(trustURLs bool) *http.Client
	Close()
}

type HTTPServiceImpl struct {
	app *App
}

func MakeHTTPService(app *App) HTTPService {
	return &HTTPServiceImpl{app}
}

func (h *HTTPServiceImpl) MakeClient(trustURLs bool) *http.Client {
	insecure := h.app.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *h.app.Config().ServiceSettings.EnableInsecureOutgoingConnections

	if trustURLs {
		return utils.NewHTTPClient(insecure, nil, nil)
	}

	allowHost := func(host string) bool {
		if h.app.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*h.app.Config().ServiceSettings.AllowedUntrustedInternalConnections) {
			if host == allowed {
				return true
			}
		}
		return false
	}

	allowIP := func(ip net.IP) bool {
		if !utils.IsReservedIP(ip) {
			return true
		}
		if h.app.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*h.app.Config().ServiceSettings.AllowedUntrustedInternalConnections) {
			if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
				return true
			}
		}
		return false
	}

	return utils.NewHTTPClient(insecure, allowHost, allowIP)
}

func (h *HTTPServiceImpl) Close() {
	// Does nothing, but allows this to be overridden when mocking the service
}
