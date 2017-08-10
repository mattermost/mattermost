// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	connectTimeout = 3 * time.Second
	requestTimeout = 30 * time.Second
)

var secureHttpClient *http.Client
var secureUntrustedHttpClient *http.Client
var insecureHttpClient *http.Client
var insecureUntrustedHttpClient *http.Client

// HttpClient returns a variation the default implementation of Client.
// It uses a Transport with the same settings as the default Transport
// but with the following modifications:
// - shorter timeout for dial and TLS handshake (defined as constant
//   "connectTimeout")
// - timeout for the end-to-end request (defined as constant
//   "requestTimeout")
// - skipping server certificate check if specified in "config.json"
//   via "ServiceSettings.EnableInsecureOutgoingConnections"
func HttpClient(trustURLs bool) *http.Client {
	insecure := Cfg.ServiceSettings.EnableInsecureOutgoingConnections != nil && *Cfg.ServiceSettings.EnableInsecureOutgoingConnections
	switch {
	case insecure && trustURLs:
		return insecureHttpClient
	case insecure:
		return insecureUntrustedHttpClient
	case trustURLs:
		return secureHttpClient
	default:
		return secureUntrustedHttpClient
	}
}

var reservedIPRanges []*net.IPNet

func isReserved(ip net.IP) bool {
	for _, ipRange := range reservedIPRanges {
		if ipRange.Contains(ip) {
			return true
		}
	}
	return false
}

func init() {
	for _, cidr := range []string{
		// See https://tools.ietf.org/html/rfc6890
		"0.0.0.0/8",      // This host on this network
		"10.0.0.0/8",     // Private-Use
		"127.0.0.0/8",    // Loopback
		"169.254.0.0/16", // Link Local
		"172.16.0.0/12",  // Private-Use Networks
		"192.168.0.0/16", // Private-Use Networks
		"::/128",         // Unspecified Address
		"::1/128",        // Loopback Address
		"fc00::/7",       // Unique-Local
		"fe80::/10",      // Linked-Scoped Unicast
	} {
		_, parsed, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		reservedIPRanges = append(reservedIPRanges, parsed)
	}

	allowHost := func(host string) bool {
		if Cfg.ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*Cfg.ServiceSettings.AllowedUntrustedInternalConnections) {
			if host == allowed {
				return true
			}
		}
		return false
	}

	allowIP := func(ip net.IP) bool {
		if !isReserved(ip) {
			return true
		}
		if Cfg.ServiceSettings.AllowedUntrustedInternalConnections == nil {
			return false
		}
		for _, allowed := range strings.Fields(*Cfg.ServiceSettings.AllowedUntrustedInternalConnections) {
			if _, ipRange, err := net.ParseCIDR(allowed); err == nil && ipRange.Contains(ip) {
				return true
			}
		}
		return false
	}

	secureHttpClient = createHttpClient(false, nil, nil)
	insecureHttpClient = createHttpClient(true, nil, nil)

	secureUntrustedHttpClient = createHttpClient(false, allowHost, allowIP)
	insecureUntrustedHttpClient = createHttpClient(true, allowHost, allowIP)
}

type DialContextFunction func(ctx context.Context, network, addr string) (net.Conn, error)

var AddressForbidden error = errors.New("address forbidden")

func dialContextFilter(dial DialContextFunction, allowHost func(host string) bool, allowIP func(ip net.IP) bool) DialContextFunction {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(addr)
		if err != nil {
			return nil, err
		}

		if allowHost != nil && allowHost(host) {
			return dial(ctx, network, addr)
		}

		ips, err := net.LookupIP(host)
		if err != nil {
			return nil, err
		}

		var firstErr error
		for _, ip := range ips {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
			}

			if allowIP == nil || !allowIP(ip) {
				continue
			}

			conn, err := dial(ctx, network, net.JoinHostPort(ip.String(), port))
			if err == nil {
				return conn, nil
			}
			if firstErr == nil {
				firstErr = err
			}
		}
		if firstErr == nil {
			return nil, AddressForbidden
		}
		return nil, firstErr
	}
}

func createHttpClient(enableInsecureConnections bool, allowHost func(host string) bool, allowIP func(ip net.IP) bool) *http.Client {
	dialContext := (&net.Dialer{
		Timeout:   connectTimeout,
		KeepAlive: 30 * time.Second,
	}).DialContext

	if allowHost != nil || allowIP != nil {
		dialContext = dialContextFilter(dialContext, allowHost, allowIP)
	}

	client := &http.Client{
		Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			DialContext:           dialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   connectTimeout,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: enableInsecureConnections,
			},
		},
		Timeout: requestTimeout,
	}

	return client
}
