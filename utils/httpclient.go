// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/tls"
	"net"
	"net/http"
	"time"
)

const (
	connectTimeout = 3 * time.Second
	requestTimeout = 30 * time.Second
)

// HttpClient returns a variation the default implementation of Client.
// It uses a Transport with the same settings as the default Transport
// but with the following modifications:
// - shorter timeout for dial and TLS handshake (defined as constant
//   "connectTimeout")
// - timeout for the end-to-end request (defined as constant
//   "requestTimeout")
// - skipping server certificate check if specified in "config.json"
//   via "ServiceSettings.EnableInsecureOutgoingConnections"
func HttpClient() *http.Client {
	if Cfg.ServiceSettings.EnableInsecureOutgoingConnections != nil && *Cfg.ServiceSettings.EnableInsecureOutgoingConnections {
		return insecureHttpClient
	}
	return secureHttpClient
}

var (
	secureHttpClient   = createHttpClient(false)
	insecureHttpClient = createHttpClient(true)
)

func createHttpClient(enableInsecureConnections bool) *http.Client {
	client := &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   connectTimeout,
				KeepAlive: 30 * time.Second,
				DualStack: true,
			}).DialContext,
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
