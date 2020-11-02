// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"crypto/tls"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/mattermost/mattermost-server/v5/mlog"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
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

func TestReadReplicaDisabledBasedOnLicense(t *testing.T) {
	t.Skip("TODO: fix flaky test")
	cfg := model.Config{}
	cfg.SetDefaults()
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DATABASE_DRIVER_POSTGRES
	}
	dsn := ""
	if driverName == model.DATABASE_DRIVER_POSTGRES {
		dsn = os.Getenv("TEST_DATABASE_POSTGRESQL_DSN")
	} else {
		dsn = os.Getenv("TEST_DATABASE_MYSQL_DSN")
	}
	cfg.SqlSettings = *storetest.MakeSqlSettings(driverName)
	if dsn != "" {
		cfg.SqlSettings.DataSource = &dsn
	}
	cfg.SqlSettings.DataSourceReplicas = []string{*cfg.SqlSettings.DataSource}
	cfg.SqlSettings.DataSourceSearchReplicas = []string{*cfg.SqlSettings.DataSource}

	t.Run("Read Replicas with no License", func(t *testing.T) {
		s, err := NewServer(func(server *Server) error {
			configStore := config.NewTestMemoryStore()
			configStore.Set(&cfg)
			server.configStore = configStore
			return nil
		})
		require.NoError(t, err)
		defer s.Shutdown()
		require.Same(t, s.sqlStore.GetMaster(), s.sqlStore.GetReplica())
		require.Len(t, s.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Read Replicas With License", func(t *testing.T) {
		s, err := NewServer(func(server *Server) error {
			configStore := config.NewTestMemoryStore()
			configStore.Set(&cfg)
			server.licenseValue.Store(model.NewTestLicense())
			return nil
		})
		require.NoError(t, err)
		defer s.Shutdown()
		require.NotSame(t, s.sqlStore.GetMaster(), s.sqlStore.GetReplica())
		require.Len(t, s.Config().SqlSettings.DataSourceReplicas, 1)
	})

	t.Run("Search Replicas with no License", func(t *testing.T) {
		s, err := NewServer(func(server *Server) error {
			configStore := config.NewTestMemoryStore()
			configStore.Set(&cfg)
			server.configStore = configStore
			return nil
		})
		require.NoError(t, err)
		defer s.Shutdown()
		require.Same(t, s.sqlStore.GetMaster(), s.sqlStore.GetSearchReplica())
		require.Len(t, s.Config().SqlSettings.DataSourceSearchReplicas, 1)
	})

	t.Run("Search Replicas With License", func(t *testing.T) {
		s, err := NewServer(func(server *Server) error {
			configStore := config.NewTestMemoryStore()
			configStore.Set(&cfg)
			server.configStore = configStore
			server.licenseValue.Store(model.NewTestLicense())
			return nil
		})
		require.NoError(t, err)
		defer s.Shutdown()
		require.NotSame(t, s.sqlStore.GetMaster(), s.sqlStore.GetSearchReplica())
		require.Len(t, s.Config().SqlSettings.DataSourceSearchReplicas, 1)
	})
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

	// This test requires Zap file target for now.
	mlog.EnableZap()
	defer mlog.DisableZap()

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

	testDir, _ := fileutils.FindDir("tests")
	s.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = ":0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
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

func TestSentry(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	client := &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}}
	data1 := make(chan bool, 1)

	server1 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Log("Received sentry request for some reason")
		data1 <- true
	}))
	defer server1.Close()

	// make sure we don't report anything when sentry is disabled
	_, port, _ := net.SplitHostPort(server1.Listener.Addr().String())
	SENTRY_DSN = fmt.Sprintf("http://test:test@localhost:%s/123", port)

	testDir, _ := fileutils.FindDir("tests")
	s, err := NewServer(func(server *Server) error {
		configStore, _ := config.NewFileStore("config.json", true)
		store, _ := config.NewStoreFromBacking(configStore)
		server.configStore = store
		server.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ListenAddress = ":0"
			*cfg.LogSettings.EnableSentry = false
			*cfg.ServiceSettings.ConnectionSecurity = "TLS"
			*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
			*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
		})
		return nil
	})

	require.NoError(t, err)
	// Route for just panicing
	s.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
		panic("log this panic")
	})

	serverErr := s.Start()
	require.NoError(t, serverErr)
	defer s.Shutdown()
	resp, err := client.Get("https://localhost:" + strconv.Itoa(s.ListenAddr.Port) + "/panic")
	require.Nil(t, resp)
	require.Error(t, err)

	sentry.Flush(time.Second * 1)
	select {
	case <-data1:
		require.Fail(t, "Sentry received a message, even though it's disabled!")
	case <-time.After(time.Second * 1):
		t.Log("Sentry request didn't arrive. Good!")
	}

	// check successful report
	data2 := make(chan bool, 1)
	server2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Log("Received sentry request!")
		data2 <- true
	}))
	defer server2.Close()
	_, port, _ = net.SplitHostPort(server2.Listener.Addr().String())
	SENTRY_DSN = fmt.Sprintf("http://test:test@localhost:%s/123", port)
	s2, err := NewServer(func(server *Server) error {
		configStore, _ := config.NewFileStore("config.json", true)
		store, _ := config.NewStoreFromBacking(configStore)
		server.configStore = store
		server.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ListenAddress = ":0"
			*cfg.ServiceSettings.ConnectionSecurity = "TLS"
			*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
			*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
			*cfg.LogSettings.EnableSentry = true

		})
		return nil
	})
	require.NoError(t, err)
	// Route for just panicing
	s2.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
		panic("log this panic")
	})

	require.NoError(t, s2.Start())
	defer s2.Shutdown()
	resp, err = client.Get("https://localhost:" + strconv.Itoa(s2.ListenAddr.Port) + "/panic")
	require.Nil(t, resp)
	require.Error(t, err)
	sentry.Flush(time.Second * 1)
	select {
	case <-data2:
		t.Log("Sentry request arrived. Good!")
	case <-time.After(time.Second * 2):
		require.Fail(t, "Sentry report didn't arrive")
	}
}
