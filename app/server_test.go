// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"crypto/tls"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
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
				tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
			},
			MaxVersion: tls.VersionTLS12,
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/", http.StatusNotFound)
	require.Error(t, err, "Expected error due to Cipher mismatch")
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
			MaxVersion: tls.VersionTLS12,
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

func TestPanicLog(t *testing.T) {
	// Creating a temp file to collect logs
	tmpfile, err := ioutil.TempFile("", "mlog")
	if err != nil {
		require.NoError(t, err)
	}

	defer func() {
		require.NoError(t, tmpfile.Close())
		require.NoError(t, os.Remove(tmpfile.Name()))
	}()

	// Creating logger to log to console and temp file
	logger := mlog.NewLogger(&mlog.LoggerConfiguration{
		EnableConsole: true,
		ConsoleJson:   true,
		EnableFile:    true,
		FileLocation:  tmpfile.Name(),
		FileLevel:     mlog.LevelInfo,
	})

	// Creating a server with logger
	s, err := NewServer(SetLogger(logger))
	require.NoError(t, err)

	// Route for just panicing
	s.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
		s.Log.Info("inside panic handler")
		panic("log this panic")
	})

	s.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.ListenAddress = ":0" })
	serverErr := s.Start()
	require.NoError(t, serverErr)

	// Calling panic route
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	client := &http.Client{Transport: tr}
	client.Get("https://localhost:" + strconv.Itoa(s.ListenAddr.Port) + "/panic")

	err = s.Shutdown()
	require.NoError(t, err)

	// Checking whether panic was logged
	var panicLogged = false
	var infoLogged = false

	_, err = tmpfile.Seek(0, 0)
	require.NoError(t, err)

	scanner := bufio.NewScanner(tmpfile)
	for scanner.Scan() {
		if !infoLogged && strings.Contains(scanner.Text(), "inside panic handler") {
			infoLogged = true
		}
		if strings.Contains(scanner.Text(), "log this panic") {
			panicLogged = true
			break
		}
	}

	if !infoLogged {
		t.Error("Info log line was supposed to be logged")
	}

	if !panicLogged {
		t.Error("Panic was supposed to be logged")
	}
}
