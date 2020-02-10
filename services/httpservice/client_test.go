// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"context"
	"fmt"
	"github.com/stretchr/testify/assert"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHTTPClient(t *testing.T) {
	for _, allowInternal := range []bool{true, false} {
		c := NewHTTPClient(NewTransport(false, func(_ string) bool { return false }, func(ip net.IP) bool { return allowInternal || !IsReservedIP(ip) }))
		for _, tc := range []struct {
			URL        string
			IsInternal bool
		}{
			{
				URL:        "https://google.com",
				IsInternal: false,
			},
			{
				URL:        "https://127.0.0.1",
				IsInternal: true,
			},
		} {
			_, err := c.Get(tc.URL)
			if !tc.IsInternal {
				require.Nil(t, err, "google is down?")
			} else {
				allowed := !tc.IsInternal || allowInternal
				success := err == nil
				switch e := err.(type) {
				case *net.OpError:
					success = e.Err != AddressForbidden
				case *url.Error:
					success = e.Err != AddressForbidden
				}
				require.Equalf(t, success, allowed, "failed for %v. allowed: %v, success %v", tc.URL, allowed, success)
			}
		}
	}
}

func TestHTTPClientWithProxy(t *testing.T) {
	proxy := createProxyServer()
	defer proxy.Close()

	c := NewHTTPClient(NewTransport(true, nil, nil))
	purl, _ := url.Parse(proxy.URL)
	c.Transport.(*MattermostTransport).Transport.(*http.Transport).Proxy = http.ProxyURL(purl)

	resp, err := c.Get("http://acme.com")
	require.Nil(t, err)
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	require.Nil(t, err)
	require.Equal(t, "proxy", string(body))
}

func createProxyServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		w.Header().Set("Content-Type", "text/plain; charset=us-ascii")
		fmt.Fprint(w, "proxy")
	}))
}

func TestDialContextFilter(t *testing.T) {
	for _, tc := range []struct {
		Addr    string
		IsValid bool
	}{
		{
			Addr:    "google.com:80",
			IsValid: true,
		},
		{
			Addr:    "8.8.8.8:53",
			IsValid: true,
		},
		{
			Addr: "127.0.0.1:80",
		},
		{
			Addr:    "10.0.0.1:80",
			IsValid: true,
		},
	} {
		didDial := false
		filter := dialContextFilter(func(ctx context.Context, network, addr string) (net.Conn, error) {
			didDial = true
			return nil, nil
		}, func(host string) bool { return host == "10.0.0.1" }, func(ip net.IP) bool { return !IsReservedIP(ip) })
		_, err := filter(context.Background(), "", tc.Addr)

		if tc.IsValid {
			require.Nil(t, err)
			require.True(t, didDial)
		} else {
			require.NotNil(t, err)
			require.Equal(t, err, AddressForbidden)
			require.False(t, didDial)
		}
	}
}

func TestUserAgentIsSet(t *testing.T) {
	testUserAgent := "test-user-agent"
	defaultUserAgent = testUserAgent
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ua := req.UserAgent()
		assert.NotEqual(t, "", ua, "expected user-agent to be non-empty")
		assert.Equalf(t, testUserAgent, ua, "expected user-agent to be %q but was %q", testUserAgent, ua)
	}))
	defer ts.Close()
	client := NewHTTPClient(NewTransport(true, nil, nil))
	req, err := http.NewRequest("GET", ts.URL, nil)

	require.Nil(t, err, "NewRequest failed", err)

	client.Do(req)
}

func NewHTTPClient(transport http.RoundTripper) *http.Client {
	return &http.Client{
		Transport: transport,
	}
}

func TestIsReservedIP(t *testing.T) {
	tests := []struct {
		name string
		ip   net.IP
		want bool
	}{
		{"127.8.3.5", net.IPv4(127, 8, 3, 5), true},
		{"192.168.0.1", net.IPv4(192, 168, 0, 1), true},
		{"169.254.0.6", net.IPv4(169, 254, 0, 6), true},
		{"127.120.6.3", net.IPv4(127, 120, 6, 3), true},
		{"8.8.8.8", net.IPv4(8, 8, 8, 8), false},
		{"9.9.9.9", net.IPv4(9, 9, 9, 8), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsReservedIP(tt.ip)
			assert.Equalf(t, tt.want, got, "IsReservedIP() = %v, want %v", got, tt.want)
		})
	}
}

func TestIsOwnIP(t *testing.T) {
	tests := []struct {
		name string
		ip   net.IP
		want bool
	}{
		{"127.0.0.1", net.IPv4(127, 0, 0, 1), true},
		{"8.8.8.8", net.IPv4(8, 0, 0, 8), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, _ := IsOwnIP(tt.ip)
			assert.Equalf(t, tt.want, got, "IsOwnIP() = %v, want %v for IP %s", got, tt.want, tt.ip.String())
		})
	}
}

func TestSplitHostnames(t *testing.T) {
	var config string
	var hostnames []string

	config = ""
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{}, hostnames)

	config = "127.0.0.1 localhost"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1,localhost"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1,,localhost"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1  localhost"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1 , localhost"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1  localhost  "
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = " 127.0.0.1  ,,localhost  , , ,,"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost"}, hostnames)

	config = "127.0.0.1 localhost, 192.168.1.0"
	hostnames = strings.FieldsFunc(config, splitFields)
	require.Equal(t, []string{"127.0.0.1", "localhost", "192.168.1.0"}, hostnames)
}
