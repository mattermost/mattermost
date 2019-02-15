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

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestStartServerSuccess(t *testing.T) {
	s, err := NewServer()
	require.NoError(t, err)

	s.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := s.Start()

	client := &http.Client{}
	checkEndpoint(t, client, "http://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerRateLimiterCriticalError(t *testing.T) {
	// Attempt to use Rate Limiter with an invalid config
	ms, err := config.NewMemoryStoreWithOptions(&config.MemoryStoreOptions{
		SkipValidation: true,
	})
	require.NoError(t, err)

	config := ms.Get()
	*config.RateLimitSettings.Enable = true
	*config.RateLimitSettings.MaxBurst = -100
	_, err = ms.Set(config)
	require.NoError(t, err)
	err = ms.Save()
	require.NoError(t, err)

	s, err := NewServer(ConfigStore(ms))
	require.NoError(t, err)

	serverErr := s.Start()
	s.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerPortUnavailable(t *testing.T) {
	s, err := NewServer()
	require.NoError(t, err)

	// Listen on the next available port
	listener, err := net.Listen("tcp", ":0")
	require.NoError(t, err)

	// Attempt to listen on the port used above.
	s.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = listener.Addr().String()
	})

	serverErr := s.Start()
	s.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerTLSSuccess(t *testing.T) {
	s, err := NewServer()
	require.NoError(t, err)

	testDir, _ := fileutils.FindDir("tests")
	s.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := s.Start()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	client := &http.Client{Transport: tr}
	checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerTLSVersion(t *testing.T) {
	s, err := NewServer()
	require.NoError(t, err)

	testDir, _ := fileutils.FindDir("tests")
	s.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSMinVer = "1.2"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := s.Start()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			MaxVersion:         tls.VersionTLS11,
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

	if !strings.Contains(err.Error(), "remote error: tls: protocol version not supported") {
		t.Errorf("Expected protocol version error, got %s", err)
	}

	client.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerTLSOverwriteCipher(t *testing.T) {
	s, err := NewServer()
	require.NoError(t, err)

	testDir, _ := fileutils.FindDir("tests")
	s.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		cfg.ServiceSettings.TLSOverwriteCiphers = []string{
			"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
			"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
		}
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	serverErr := s.Start()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,
			},
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

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

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	s.Shutdown()
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
