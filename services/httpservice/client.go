// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package httpservice

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

const (
	connectTimeout = 3 * time.Second
	requestTimeout = 30 * time.Second
)

var reservedIPRanges []*net.IPNet

func IsReservedIP(ip net.IP) bool {
	for _, ipRange := range reservedIPRanges {
		if ipRange.Contains(ip) {
			return true
		}
	}
	return false
}

var defaultUserAgent string

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
	defaultUserAgent = "mattermost-" + model.CurrentVersion
}

type DialContextFunction func(ctx context.Context, network, addr string) (net.Conn, error)

var AddressForbidden error = errors.New("address forbidden, you may need to set AllowedUntrustedInternalConnections to allow an integration access to your internal network")

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

type Client struct {
	*http.Client
}

func (c *Client) Do(req *http.Request) (*http.Response, error) {
	req.Header.Set("User-Agent", defaultUserAgent)
	return c.Client.Do(req)
}

// NewHTTPClient returns a variation the default implementation of Client.
// It uses a Transport with the same settings as the default Transport
// but with the following modifications:
// - shorter timeout for dial and TLS handshake (defined as constant
//   "connectTimeout")
// - timeout for the end-to-end request (defined as constant
//   "requestTimeout")
func NewHTTPClient(enableInsecureConnections bool, allowHost func(host string) bool, allowIP func(ip net.IP) bool) *Client {
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

	return &Client{Client: client}
}
