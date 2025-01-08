// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"time"

	"golang.org/x/net/http/httpproxy"
)

const (
	ConnectTimeout = 3 * time.Second
	RequestTimeout = 30 * time.Second
)

var reservedIPRanges []*net.IPNet

// IsReservedIP checks whether the target IP belongs to reserved IP address ranges to avoid SSRF attacks to the internal
// network of the Mattermost server
func IsReservedIP(ip net.IP) bool {
	for _, ipRange := range reservedIPRanges {
		if ipRange.Contains(ip) {
			return true
		}
	}
	return false
}

// IsOwnIP handles the special case that a request might be made to the public IP of the host which on Linux is routed
// directly via the loopback IP to any listening sockets, effectively bypassing host-based firewalls such as firewalld
func IsOwnIP(ip net.IP) (bool, error) {
	interfaces, err := net.Interfaces()
	if err != nil {
		return false, err
	}

	for _, interf := range interfaces {
		addresses, err := interf.Addrs()
		if err != nil {
			return false, err
		}

		for _, addr := range addresses {
			var selfIP net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				selfIP = v.IP
			case *net.IPAddr:
				selfIP = v.IP
			}

			if ip.Equal(selfIP) {
				return true, nil
			}
		}
	}

	return false, nil
}

var defaultUserAgent string

func init() {
	for _, cidr := range []string{
		// Strings taken from https://github.com/doyensec/safeurl/blob/main/ip.go
		"10.0.0.0/8",         /* Private network - RFC 1918 */
		"172.16.0.0/12",      /* Private network - RFC 1918 */
		"192.168.0.0/16",     /* Private network - RFC 1918 */
		"127.0.0.0/8",        /* Loopback - RFC 1122, Section 3.2.1.3 */
		"0.0.0.0/8",          /* Current network (only valid as source address) - RFC 1122, Section 3.2.1.3 */
		"169.254.0.0/16",     /* Link-local - RFC 3927 */
		"192.0.0.0/24",       /* IETF Protocol Assignments - RFC 5736 */
		"192.0.2.0/24",       /* TEST-NET-1, documentation and examples - RFC 5737 */
		"198.51.100.0/24",    /* TEST-NET-2, documentation and examples - RFC 5737 */
		"203.0.113.0/24",     /* TEST-NET-3, documentation and examples - RFC 5737 */
		"192.88.99.0/24",     /* IPv6 to IPv4 relay (includes 2002::/16) - RFC 3068 */
		"198.18.0.0/15",      /* Network benchmark tests - RFC 2544 */
		"224.0.0.0/4",        /* IP multicast (former Class D network) - RFC 3171 */
		"240.0.0.0/4",        /* Reserved (former Class E network) - RFC 1112, Section 4 */
		"255.255.255.255/32", /* Broadcast - RFC 919, Section 7 */
		"100.64.0.0/10",      /* Shared Address Space - RFC 6598 */
		// ipv6 sourced from https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry.xhtml
		"::/128",        /* Unspecified Address - RFC 4291 */
		"::1/128",       /* Loopback - RFC 4291 */
		"100::/64",      /* Discard prefix - RFC 6666 */
		"2001::/23",     /* IETF Protocol Assignments - RFC 2928 */
		"2001:2::/48",   /* Benchmarking - RFC5180 */
		"2001:db8::/32", /* Addresses used in documentation and example source code - RFC 3849 */
		"2001::/32",     /* Teredo tunneling - RFC4380 - RFC8190 */
		"fc00::/7",      /* Unique local address - RFC 4193 - RFC 8190 */
		"fe80::/10",     /* Link-local address - RFC 4291 */
		"ff00::/8",      /* Multicast - RFC 3513 */
		"2002::/16",     /* 6to4 - RFC 3056 */
		"64:ff9b::/96",  /* IPv4/IPv6 translation - RFC 6052 */
		"2001:10::/28",  /* Deprecated (previously ORCHID) - RFC 4843 */
		"2001:20::/28",  /* ORCHIDv2 - RFC7343 */
	} {
		_, parsed, err := net.ParseCIDR(cidr)
		if err != nil {
			panic(err)
		}
		reservedIPRanges = append(reservedIPRanges, parsed)
	}
	defaultUserAgent = "Mattermost-Bot/1.1"
}

type DialContextFunction func(ctx context.Context, network, addr string) (net.Conn, error)

var ErrAddressForbidden = errors.New("address forbidden, you may need to set AllowedUntrustedInternalConnections to allow an integration access to your internal network")

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
			return nil, ErrAddressForbidden
		}
		return nil, firstErr
	}
}

func getProxyFn() func(r *http.Request) (*url.URL, error) {
	proxyFromEnvFn := httpproxy.FromEnvironment().ProxyFunc()
	return func(r *http.Request) (*url.URL, error) {
		// TODO: Consider removing this code once MM-61938 is fixed upstream.
		if r.URL != nil {
			if addr, err := netip.ParseAddr(r.URL.Hostname()); err == nil && addr.Is6() && addr.Zone() != "" {
				return nil, fmt.Errorf("invalid IPv6 address in URL: %q", addr.String())
			}
		}

		return proxyFromEnvFn(r.URL)
	}
}

func NewTransport(enableInsecureConnections bool, allowHost func(host string) bool, allowIP func(ip net.IP) bool) *MattermostTransport {
	dialContext := (&net.Dialer{
		Timeout:   ConnectTimeout,
		KeepAlive: 30 * time.Second,
	}).DialContext

	if allowHost != nil || allowIP != nil {
		dialContext = dialContextFilter(dialContext, allowHost, allowIP)
	}

	return &MattermostTransport{
		&http.Transport{
			Proxy:                 getProxyFn(),
			DialContext:           dialContext,
			MaxIdleConns:          100,
			IdleConnTimeout:       90 * time.Second,
			TLSHandshakeTimeout:   ConnectTimeout,
			ExpectContinueTimeout: 1 * time.Second,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: enableInsecureConnections,
			},
		},
	}
}
