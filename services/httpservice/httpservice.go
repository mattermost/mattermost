// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package httpservice

import (
	"net"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/services/configservice"
)

// HTTPService wraps the functionality for making http requests to provide some improvements to the default client
// behaviour.
type HTTPService interface {
	// MakeClient returns an http client constructed with a RoundTripper as returned by MakeTransport.
	MakeClient(trustURLs bool) *http.Client

	// MakeTransport returns a RoundTripper that is suitable for making requests to external resources. The default
	// implementation provides:
	// - A shorter timeout for dial and TLS handshake (defined as constant "ConnectTimeout")
	// - A timeout for end-to-end requests (defined as constant "RequestTimeout")
	// - A Mattermost-specific user agent header
	// - Additional security for untrusted and insecure connections
	MakeTransport(trustURLs bool) http.RoundTripper
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
