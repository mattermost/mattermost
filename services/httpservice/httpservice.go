// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package httpservice

import (
	"net"
	"strings"

	"github.com/mattermost/mattermost-server/services/configservice"
)

// Wraps the functionality for creating a new http.Client to encapsulate that and allow it to be mocked when testing
type HTTPService interface {
	MakeClient(trustURLs bool) *Client
	Close()
}

type HTTPServiceImpl struct {
	configService configservice.ConfigService
}

func MakeHTTPService(configService configservice.ConfigService) HTTPService {
	return &HTTPServiceImpl{configService}
}

func (h *HTTPServiceImpl) MakeClient(trustURLs bool) *Client {
	insecure := h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections

	if trustURLs {
		return NewHTTPClient(insecure, nil, nil)
	}

	allowHost := func(host string) bool {
		if h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections) {
			if host == allowed {
				return true
			}
		}
		return false
	}

	allowIP := func(ip net.IP) bool {
		if !IsReservedIP(ip) {
			return true
		}
		if h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections) {
			if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
				return true
			}
		}
		return false
	}

	return NewHTTPClient(insecure, allowHost, allowIP)
}

func (h *HTTPServiceImpl) Close() {
	// Does nothing, but allows this to be overridden when mocking the service
}
