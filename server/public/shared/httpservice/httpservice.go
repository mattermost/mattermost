// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"fmt"
	"net"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
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

type getConfig interface {
	Config() *model.Config
}

type HTTPServiceImpl struct {
	configService getConfig

	RequestTimeout time.Duration
}

func splitFields(c rune) bool {
	return unicode.IsSpace(c) || c == ','
}

func MakeHTTPService(configService getConfig) HTTPService {
	return &HTTPServiceImpl{
		configService,
		RequestTimeout,
	}
}

type pluginAPIConfigServiceAdapter struct {
	pluginAPIConfigService plugin.API
}

func (p *pluginAPIConfigServiceAdapter) Config() *model.Config {
	return p.pluginAPIConfigService.GetConfig()
}

func MakeHTTPServicePlugin(configService plugin.API) HTTPService {
	return MakeHTTPService(&pluginAPIConfigServiceAdapter{configService})
}

func (h *HTTPServiceImpl) MakeClient(trustURLs bool) *http.Client {
	return &http.Client{
		Transport: h.MakeTransport(trustURLs),
		Timeout:   h.RequestTimeout,
	}
}

// isAllowedInternalHost reports whether host appears verbatim in a
// space/comma-separated AllowedUntrustedInternalConnections value.
func isAllowedInternalHost(host, allowedUntrustedInternalConnections string) bool {
	return slices.Contains(strings.FieldsFunc(allowedUntrustedInternalConnections, splitFields), host)
}

// checkInternalIP returns nil if ip may be dialed, or an error if it is a
// reserved-range or self-assigned IP not covered by a CIDR entry in the
// space/comma-separated AllowedUntrustedInternalConnections value.
func checkInternalIP(ip net.IP, allowedUntrustedInternalConnections string) error {
	reservedIP := IsReservedIP(ip)

	ownIP, err := IsOwnIP(ip)
	if err != nil {
		// If there is an error getting the self-assigned IPs, default to the secure option
		return fmt.Errorf("unable to determine if IP is own IP: %w", err)
	}

	// If it's not a reserved IP and it's not self-assigned IP, accept the IP
	if !reservedIP && !ownIP {
		return nil
	}

	// Otherwise it needs to be explicitly added to AllowedUntrustedInternalConnections
	for _, allowed := range strings.FieldsFunc(allowedUntrustedInternalConnections, splitFields) {
		if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
			return nil
		}
	}

	if reservedIP {
		return fmt.Errorf("IP %s is in a reserved range and not in AllowedUntrustedInternalConnections", ip)
	}
	return fmt.Errorf("IP %s is a self-assigned IP and not in AllowedUntrustedInternalConnections", ip)
}

// NewTransportForInternalConnections returns a transport that applies the same
// AllowedUntrustedInternalConnections filtering as MakeTransport, but takes the
// allowlist as a static value instead of reading it from a config service. It is
// for callers that have the allowlist string but not an HTTPService.
func NewTransportForInternalConnections(insecure bool, allowedUntrustedInternalConnections string) *MattermostTransport {
	allowHost := func(host string) bool {
		return isAllowedInternalHost(host, allowedUntrustedInternalConnections)
	}

	allowIP := func(ip net.IP) error {
		return checkInternalIP(ip, allowedUntrustedInternalConnections)
	}

	return NewTransport(insecure, allowHost, allowIP)
}

func (h *HTTPServiceImpl) MakeTransport(trustURLs bool) *MattermostTransport {
	insecure := h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections != nil && *h.configService.Config().ServiceSettings.EnableInsecureOutgoingConnections

	if trustURLs {
		return NewTransport(insecure, nil, nil)
	}

	// The allowlist is read inside the closures so a long-lived client picks up
	// config changes on each dial.
	allowHost := func(host string) bool {
		return isAllowedInternalHost(host, model.SafeDereference(h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections))
	}

	allowIP := func(ip net.IP) error {
		return checkInternalIP(ip, model.SafeDereference(h.configService.Config().ServiceSettings.AllowedUntrustedInternalConnections))
	}

	return NewTransport(insecure, allowHost, allowIP)
}
