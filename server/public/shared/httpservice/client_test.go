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

	t.Run("invalid IPv6 address in proxied URL", func(t *testing.T) {
		c := NewHTTPClient(NewTransport(true, nil, nil))

		t.Setenv("HTTP_PROXY", "http://proxy.example.org")
		t.Setenv("HTTPS_PROXY", "https://proxy.example.org")
		t.Setenv("NO_PROXY", ".example.com")

		_, err := c.Get("http://[fe80::8e87:5021:6f6c:605e%25eth0]")
		require.EqualError(t, err, `Get "http://[fe80::8e87:5021:6f6c:605e%25eth0]": invalid IPv6 address in URL: "fe80::8e87:5021:6f6c:605e%eth0"`)
	})
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

	_, err = client.Do(req)
	require.NoError(t, err, "Do failed", err)
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

func TestGetProxyFn(t *testing.T) {
	t.Setenv("HTTP_PROXY", "http://proxy.example.org")
	t.Setenv("HTTPS_PROXY", "https://proxy.example.org")
	t.Setenv("NO_PROXY", ".example.com")

	for _, tc := range []struct {
		name   string
		input  string
		output string
		err    string
	}{
		{
			name: "empty",
		},
		{
			name:  "no proxy",
			input: "http://test.example.com",
		},
		{
			name:  "localhost",
			input: "http://localhost",
		},
		{
			name:   "hostname",
			input:  "http://example.org",
			output: "http://proxy.example.org",
		},
		{
			name:   "hostname with port",
			input:  "http://example.org:4545",
			output: "http://proxy.example.org",
		},
		{
			name:   "https",
			input:  "https://example.org",
			output: "https://proxy.example.org",
		},
		{
			name:   "ipv4",
			input:  "http://10.0.0.45",
			output: "http://proxy.example.org",
		},
		{
			name:   "ipv4 with port",
			input:  "http://10.0.0.45:4545",
			output: "http://proxy.example.org",
		},
		{
			name:   "ipv6",
			input:  "http://[fe80::8e87:5021:6f6c:605e]",
			output: "http://proxy.example.org",
		},
		{
			name:   "ipv6 with port",
			input:  "http://[fe80::8e87:5021:6f6c:605e]:4545",
			output: "http://proxy.example.org",
		},
		{
			name:   "ipv6 with zone",
			input:  "http://[fe80::8e87:5021:6f6c:605e%25eth0]",
			output: "http://proxy.example.org",
			err:    `invalid IPv6 address in URL: "fe80::8e87:5021:6f6c:605e%eth0"`,
		},
		{
			name:   "ipv6 with zone and port",
			input:  "http://[fe80::8e87:5021:6f6c:605e%25eth0]:4545",
			output: "http://proxy.example.org",
			err:    `invalid IPv6 address in URL: "fe80::8e87:5021:6f6c:605e%eth0"`,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			inURL, err := url.Parse(tc.input)
			require.NoError(t, err)
			outURL, err := getProxyFn()(&http.Request{
				URL: inURL,
			})
			if tc.err != "" { // error case
				require.EqualError(t, err, tc.err)
				return
			}

			require.NoError(t, err)
			if tc.output == "" { // not proxied case
				require.Nil(t, outURL)
			} else { // proxied case
				require.NotNil(t, outURL)
				require.Equal(t, tc.output, outURL.String())
			}
		})
	}
}
