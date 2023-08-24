// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package httpservice

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPClient(t *testing.T) {
	mockHTTP := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer mockHTTP.Close()

	mockSelfSignedHTTPS := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer mockSelfSignedHTTPS.Close()

	t.Run("insecure connections", func(t *testing.T) {
		disableInsecureConnections := false
		enableInsecureConnections := true

		testCases := []struct {
			description               string
			enableInsecureConnections bool
			url                       string
			expectedAllowed           bool
		}{
			{"allow HTTP even when insecure disabled", disableInsecureConnections, mockHTTP.URL, true},
			{"allow HTTP when insecure enabled", enableInsecureConnections, mockHTTP.URL, true},
			{"reject self-signed HTTPS even when insecure disabled", disableInsecureConnections, mockSelfSignedHTTPS.URL, false},
			{"allow self-signed HTTPS when insecure enabled", enableInsecureConnections, mockSelfSignedHTTPS.URL, true},
		}

		for _, testCase := range testCases {
			t.Run(testCase.description, func(t *testing.T) {
				c := NewHTTPClient(NewTransport(testCase.enableInsecureConnections, nil, nil))
				if _, err := c.Get(testCase.url); testCase.expectedAllowed {
					require.NoError(t, err)
				} else {
					require.Error(t, err)
				}

			})
		}
	})

	t.Run("checks", func(t *testing.T) {
		allowHost := func(_ string) bool { return true }
		rejectHost := func(_ string) bool { return false }
		allowIP := func(_ net.IP) bool { return true }
		rejectIP := func(_ net.IP) bool { return false }

		testCases := []struct {
			description     string
			allowHost       func(string) bool
			allowIP         func(net.IP) bool
			expectedAllowed bool
		}{
			{"allow with no checks", nil, nil, true},
			{"reject without host check when ip rejected", nil, rejectIP, false},
			{"allow without host check when ip allowed", nil, allowIP, true},

			{"reject when host rejected since no ip check", rejectHost, nil, false},
			{"reject when host and ip rejected", rejectHost, rejectIP, false},
			{"allow when host rejected since ip allowed", rejectHost, allowIP, true},

			{"allow when host allowed even without ip check", allowHost, nil, true},
			{"allow when host allowed even if ip rejected", allowHost, rejectIP, true},
			{"allow when host and ip allowed", allowHost, allowIP, true},
		}
		for _, testCase := range testCases {
			t.Run(testCase.description, func(t *testing.T) {
				c := NewHTTPClient(NewTransport(false, testCase.allowHost, testCase.allowIP))
				if _, err := c.Get(mockHTTP.URL); testCase.expectedAllowed {
					require.NoError(t, err)
				} else {
					require.IsType(t, &url.Error{}, err)
					require.Equal(t, ErrAddressForbidden, err.(*url.Error).Err)
				}
			})
		}
	})
}

func TestHTTPClientWithProxy(t *testing.T) {
	proxy := createProxyServer()
	defer proxy.Close()

	c := NewHTTPClient(NewTransport(true, nil, nil))
	purl, _ := url.Parse(proxy.URL)
	c.Transport.(*MattermostTransport).Transport.(*http.Transport).Proxy = http.ProxyURL(purl)

	resp, err := c.Get("http://acme.com")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
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
			require.NoError(t, err)
			require.True(t, didDial)
		} else {
			require.Error(t, err)
			require.Equal(t, err, ErrAddressForbidden)
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

	require.NoError(t, err, "NewRequest failed", err)

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
