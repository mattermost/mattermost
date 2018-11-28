// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"crypto/tls"
	"net"
	"net/http"
	"path"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/utils"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestStartServerSuccess(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	a.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := a.StartServer()

	client := &http.Client{}
	checkEndpoint(t, client, "http://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	a.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerRateLimiterCriticalError(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	// Attempt to use Rate Limiter with an invalid config
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.RateLimitSettings.Enable = true
		*cfg.RateLimitSettings.MaxBurst = -100
	})

	serverErr := a.StartServer()
	a.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerPortUnavailable(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	// Listen on the next available port
	listener, err := net.Listen("tcp", ":0")
	require.NoError(t, err)

	// Attempt to listen on the port used above.
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = listener.Addr().String()
	})

	serverErr := a.StartServer()
	a.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerTLSSuccess(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	testDir, _ := utils.FindDir("tests")
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := a.StartServer()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	client := &http.Client{Transport: tr}
	checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	a.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerTLSVersion(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	testDir, _ := utils.FindDir("tests")
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSMinVer = "1.2"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := a.StartServer()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			MaxVersion:         tls.VersionTLS11,
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	if !strings.Contains(err.Error(), "remote error: tls: protocol version not supported") {
		t.Errorf("Expected protocol version error, got %s", err)
	}

	client.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	a.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerTLSOverwriteCipher(t *testing.T) {
	a, err := New()
	require.NoError(t, err)

	testDir, _ := utils.FindDir("tests")
	a.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		cfg.ServiceSettings.TLSOverwriteCiphers = []string{
			"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
			"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
		}
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := a.StartServer()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,
			},
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	if !strings.Contains(err.Error(), "remote error: tls: handshake failure") {
		t.Errorf("Expected protocol version error, got %s", err)
	}

	client.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			},
		},
	}

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(a.Srv.ListenAddr.Port)+"/", http.StatusNotFound)

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	a.Shutdown()
	require.NoError(t, serverErr)
}

func checkEndpoint(t *testing.T, client *http.Client, url string, expectedStatus int) error {
	res, err := client.Get(url)

	if err != nil {
		return err
	}

	defer res.Body.Close()

	if res.StatusCode != expectedStatus {
		t.Errorf("Response code was %d; want %d", res.StatusCode, expectedStatus)
	}

	return nil
}
