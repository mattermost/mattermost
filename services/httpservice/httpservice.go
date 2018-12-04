// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package httpservice

import (
	"net"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/services/configservice"
)

// HTTPService wraps the functionality for creating a new http.Client to provide some improvements to the default client
// behaviour and allow it to be mocked when testing. The default implementation uses a Transport with the same settings
// as the default Transport with the following modifications:
// - A shorter timeout for dial and TLS handshake (defined as the constant "connectTimeout")
// - A timeout for end-to-end requests (defined as constant "requestTimeout")
type HTTPService interface {
	MakeClient(trustURLs bool) *http.Client
	MakeTransport(trustURLs bool) http.RoundTripper
	Close()
}

type HTTPServiceImpl struct {
	configService configservice.ConfigService
}

func MakeHTTPService(configService configservice.ConfigService) HTTPService {
	return &HTTPServiceImpl{configService}
}

func (h *HTTPServiceImpl) MakeClient(trustURLs bool) *http.Client {
	return NewHTTPClient(h.MakeTransport(trustURLs))
}

func (h *HTTPServiceImpl) MakeTransport(trustURLs bool) http.RoundTripper {
	insecure := h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections

	if trustURLs {
		return NewTransport(insecure, nil, nil)
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

	return NewTransport(insecure, allowHost, allowIP)
}

func (h *HTTPServiceImpl) Close() {
	// Does nothing, but allows this to be overridden when mocking the service
}
