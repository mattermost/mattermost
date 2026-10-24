// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httptools

import (
	"errors"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
)

func MakeClient(pluginAPI *pluginapi.Client) *http.Client {
	return &http.Client{
		Transport: MakeTransport(pluginAPI),
		Timeout:   30 * time.Second,
	}
}

func splitFields(c rune) bool {
	return unicode.IsSpace(c) || c == ','
}

// Copy paste with adaptations from sercvices/httpservice/httpservice.go in the future that package will be adapted
// to be used by the suite and this should be replaced.
func MakeTransport(pluginAPI *pluginapi.Client) *httpservice.MattermostTransport {
	insecure := pluginAPI.Configuration.GetConfig().ServiceSettings.EnableInsecureOutgoingConnections != nil && *pluginAPI.Configuration.GetConfig().ServiceSettings.EnableInsecureOutgoingConnections

	allowHost := func(host string) bool {
		if pluginAPI.Configuration.GetConfig().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.FieldsFunc(*pluginAPI.Configuration.GetConfig().ServiceSettings.AllowedUntrustedInternalConnections, splitFields) {
			if host == allowed {
				return true
			}
		}
		return false
	}

	allowIP := func(ip net.IP) error {
		reservedIP := httpservice.IsReservedIP(ip)
		ownIP, err := httpservice.IsOwnIP(ip)

		// If there is an error getting the self-assigned IPs, default to the secure option
		if err != nil {
			return errors.New("unable to determine if IP is own IP")
		}

		// If it's not a reserved IP and it's not self-assigned IP, accept the IP
		if !reservedIP && !ownIP {
			return nil
		}

		if pluginAPI.Configuration.GetConfig().ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return errors.New("IP is reserved or own IP and AllowedUntrustedInternalConnections is not configured")
		}

		// In the case it's the self-assigned IP, enforce that it needs to be explicitly added to the AllowedUntrustedInternalConnections
		for _, allowed := range strings.FieldsFunc(*pluginAPI.Configuration.GetConfig().ServiceSettings.AllowedUntrustedInternalConnections, splitFields) {
			if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
				return nil
			}
		}
		return errors.New("IP is not in AllowedUntrustedInternalConnections")
	}

	return httpservice.NewTransport(insecure, allowHost, allowIP)
}
