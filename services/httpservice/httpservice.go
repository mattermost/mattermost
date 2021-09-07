// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"net"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost-server/v6/services/configservice"
)

// HTTPService wraps the functionality for making http requests to provide some improvements to the default client
// behaviour.
type HTTPService interface {
	// MakeClient returns an http client constructed with a RoundTripper as returned by MakeTransport.
	MakeClient(trustURLs bool) *http.Client

	// MakeTransport returns a RoundTripper that is suitable for making requests to external resources. The default
	// implementation provides:
	// - A shorter timeout for dial and TLS handshake (defined as constant "ConnectTimeout")
	// - A timeout for end-to-end requests
	// - A Mattermost-specific user agent header
	// - Additional security for untrusted and insecure connections
	MakeTransport(trustURLs bool) *MattermostTransport
}

type HTTPServiceImpl struct {
	configService configservice.ConfigService

	RequestTimeout time.Duration
}

func splitFields(c rune) bool {
	return unicode.IsSpace(c) || c == ','
}

func MakeHTTPService(configService configservice.ConfigService) HTTPService {
	return &HTTPServiceImpl{
		configService,
		RequestTimeout,
	}
}

func (h *HTTPServiceImpl) MakeClient(trustURLs bool) *http.Client {
	return &http.Client{
		Transport: h.MakeTransport(trustURLs),
		Timeout:   h.RequestTimeout,
	}
}

func (h *HTTPServiceImpl) MakeTransport(trustURLs bool) *MattermostTransport {
	insecure := h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections

	if trustURLs {
		return NewTransport(insecure, nil, nil)
	}

	allowHost := func(host string) bool {
		if h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.FieldsFunc(*h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections, splitFields) {
			if host == allowed {
				return true
			}
		}
		return false
	}

	allowIP := func(ip net.IP) bool {
		reservedIP := IsReservedIP(ip)
		ownIP, err := IsOwnIP(ip)

		// If there is an error getting the self-assigned IPs, default to the secure option
		if err != nil {
			return false
		}

		// If it's not a reserved IP and it's not self-assigned IP, accept the IP
		if !reservedIP && !ownIP {
			return true
		}

		if h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}

		// In the case it's the self-assigned IP, enforce that it needs to be explicitly added to the AllowedUntrustedInternalConnections
		for _, allowed := range strings.FieldsFunc(*h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections, splitFields) {
			if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
				return true
			}
		}
		return false
	}

	return NewTransport(insecure, allowHost, allowIP)
}
