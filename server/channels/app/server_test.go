// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils/fileutils"
	"github.com/mattermost/mattermost-server/server/v8/config"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/filestore"
)

func newServer(t *testing.T) (*Server, error) {
	return newServerWithConfig(t, func(_ *model.Config) {})
}

func newServerWithConfig(t *testing.T, f func(cfg *model.Config)) (*Server, error) {
	configStore, err := config.NewMemoryStore()
	require.NoError(t, err)
	store, err := config.NewStoreFromBacking(configStore, nil, false)
	require.NoError(t, err)
	cfg := store.Get()
	cfg.SqlSettings = *mainHelper.GetSQLSettings()
	f(cfg)

	store.Set(cfg)

	return NewServer(ConfigStore(store))
}

func TestStartServerSuccess(t *testing.T) {
	s, err := newServerWithConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = "localhost:0"
	})
	require.NoError(t, err)

	serverErr := s.Start()

	client := &http.Client{}
	checkEndpoint(t, client, "http://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerPortUnavailable(t *testing.T) {
	// Listen on the next available port
	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	s, err := newServer(t)
	require.NoError(t, err)

	// Attempt to listen on the port used above.
	s.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = listener.Addr().String()
	})

	serverErr := s.Start()
	s.Shutdown()
	require.Error(t, serverErr)
}

func TestStartServerNoS3Bucket(t *testing.T) {
	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)
	configStore, _ := config.NewFileStore("config.json", true)
	store, _ := config.NewStoreFromBacking(configStore, nil, false)

	cfg := store.Get()
	cfg.FileSettings = model.FileSettings{
		DriverName:              model.NewString(model.ImageDriverS3),
		AmazonS3AccessKeyId:     model.NewString(model.MinioAccessKey),
		AmazonS3SecretAccessKey: model.NewString(model.MinioSecretKey),
		AmazonS3Bucket:          model.NewString("nosuchbucket"),
		AmazonS3Endpoint:        model.NewString(s3Endpoint),
		AmazonS3Region:          model.NewString(""),
		AmazonS3PathPrefix:      model.NewString(""),
		AmazonS3SSL:             model.NewBool(false),
	}
	*cfg.ServiceSettings.ListenAddress = "localhost:0"
	cfg.SqlSettings = *mainHelper.GetSQLSettings()
	_, _, err := store.Set(cfg)
	require.NoError(t, err)

	s, err := NewServer(func(server *Server) error {
		var err2 error
		server.platform, err2 = platform.New(platform.ServiceConfig{}, platform.ConfigStore(store))
		require.NoError(t, err2)

		return nil
	})
	require.NoError(t, err)

	require.NoError(t, s.Start())
	defer s.Shutdown()

	// ensure that a new bucket was created
	require.IsType(t, &filestore.S3FileBackend{}, s.FileBackend())

	err = s.FileBackend().(*filestore.S3FileBackend).TestConnection()
	require.NoError(t, err)
}

func TestStartServerTLSSuccess(t *testing.T) {
	s, err := newServerWithConfig(t, func(cfg *model.Config) {
		testDir, _ := fileutils.FindDir("tests")

		*cfg.ServiceSettings.ListenAddress = "localhost:0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	require.NoError(t, err)

	serverErr := s.Start()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
	}

	client := &http.Client{Transport: tr}
	checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestDatabaseTypeAndMattermostVersion(t *testing.T) {
	sqlDrivernameEnvironment := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")

	if sqlDrivernameEnvironment != "" {
		defer os.Setenv("MM_SQLSETTINGS_DRIVERNAME", sqlDrivernameEnvironment)
	} else {
		defer os.Unsetenv("MM_SQLSETTINGS_DRIVERNAME")
	}

	os.Setenv("MM_SQLSETTINGS_DRIVERNAME", "postgres")

	th := Setup(t, SkipProductsInitialization())
	defer th.TearDown()

	databaseType, mattermostVersion := th.Server.DatabaseTypeAndSchemaVersion()
	assert.Equal(t, "postgres", databaseType)
	assert.GreaterOrEqual(t, mattermostVersion, strconv.Itoa(1))

	os.Setenv("MM_SQLSETTINGS_DRIVERNAME", "mysql")

	th2 := Setup(t, SkipProductsInitialization())
	defer th2.TearDown()

	databaseType, mattermostVersion = th2.Server.DatabaseTypeAndSchemaVersion()
	assert.Equal(t, "mysql", databaseType)
	assert.GreaterOrEqual(t, mattermostVersion, strconv.Itoa(1))
}

func TestStartServerTLSVersion(t *testing.T) {
	configStore, _ := config.NewMemoryStore()
	store, _ := config.NewStoreFromBacking(configStore, nil, false)
	cfg := store.Get()
	testDir, _ := fileutils.FindDir("tests")

	*cfg.ServiceSettings.ListenAddress = "localhost:0"
	*cfg.ServiceSettings.ConnectionSecurity = "TLS"
	*cfg.ServiceSettings.TLSMinVer = "1.2"
	*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
	*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	cfg.SqlSettings = *mainHelper.GetSQLSettings()

	store.Set(cfg)

	s, err := NewServer(ConfigStore(store))
	require.NoError(t, err)

	serverErr := s.Start()

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
			MaxVersion:         tls.VersionTLS11,
		},
	}

	client := &http.Client{Transport: tr}
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")
	require.Error(t, err)

	client.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: true,
		},
	}

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	s.Shutdown()
	require.NoError(t, serverErr)
}

func TestStartServerTLSOverwriteCipher(t *testing.T) {
	s, err := newServerWithConfig(t, func(cfg *model.Config) {
		testDir, _ := fileutils.FindDir("tests")

		*cfg.ServiceSettings.ListenAddress = "localhost:0"
		*cfg.ServiceSettings.ConnectionSecurity = "TLS"
		cfg.ServiceSettings.TLSOverwriteCiphers = []string{
			"TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
			"TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
		}
		*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
		*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
	})
	require.NoError(t, err)

	err = s.Start()
	require.NoError(t, err)

	defer s.Shutdown()

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
	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")
	require.Error(t, err, "Expected error due to Cipher mismatch")
	require.Contains(t, err.Error(), "remote error: tls: handshake failure", "Expected protocol version error")

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

	err = checkEndpoint(t, client, "https://localhost:"+strconv.Itoa(s.ListenAddr.Port)+"/")
	require.NoError(t, err)
}

func checkEndpoint(t *testing.T, client *http.Client, url string) error {
	res, err := client.Get(url)
	if err != nil {
		return err
	}

	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		t.Errorf("Response code was %d; want %d", res.StatusCode, http.StatusNotFound)
	}

	return nil
}

func TestPanicLog(t *testing.T) {
	// Creating a temp dir for log
	tmpDir, err := os.MkdirTemp("", "mlog-test")
	require.NoError(t, err, "cannot create tmp dir for log file")
	defer func() {
		err2 := os.RemoveAll(tmpDir)
		assert.NoError(t, err2)
	}()

	// Creating logger to log to console and temp file
	logger, _ := mlog.NewLogger()

	logSettings := model.NewLogSettings()
	logSettings.EnableConsole = model.NewBool(true)
	logSettings.ConsoleJson = model.NewBool(true)
	logSettings.EnableFile = model.NewBool(true)
	logSettings.FileLocation = &tmpDir
	logSettings.FileLevel = &mlog.LvlInfo.Name

	cfg, err := config.MloggerConfigFromLoggerConfig(logSettings, nil, config.GetLogFileLocation)
	require.NoError(t, err)
	err = logger.ConfigureTargets(cfg, nil)
	require.NoError(t, err)
	logger.LockConfiguration()

	// Creating a server with logger
	s, err := newServer(t)
	require.NoError(t, err)
	s.Platform().SetLogger(logger)

	// Route for just panicking
	s.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
		s.Log().Info("inside panic handler")
		panic("log this panic")
	})

	testDir, _ := fileutils.FindDir("tests")
	s.platform.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.ListenAddress = "localhost:0"
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

	err = logger.Flush()
	assert.NoError(t, err, "flush should succeed")
	s.Shutdown()

	// Checking whether panic was logged
	var panicLogged = false
	var infoLogged = false

	logFile, err := os.Open(config.GetLogFileLocation(tmpDir))
	require.NoError(t, err, "cannot open log file")

	_, err = logFile.Seek(0, 0)
	require.NoError(t, err)

	scanner := bufio.NewScanner(logFile)
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
	testDir, _ := fileutils.FindDir("tests")

	t.Run("sentry is disabled, should not receive a report", func(t *testing.T) {
		data := make(chan bool, 1)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Log("Received sentry request for some reason")
			data <- true
		}))
		defer server.Close()

		// make sure we don't report anything when sentry is disabled
		_, port, _ := net.SplitHostPort(server.Listener.Addr().String())
		dsn, err := sentry.NewDsn(fmt.Sprintf("http://test:test@localhost:%s/123", port))
		require.NoError(t, err)
		SentryDSN = dsn.String()

		s, err := newServerWithConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.ListenAddress = "localhost:0"
			*cfg.LogSettings.EnableSentry = false
			*cfg.ServiceSettings.ConnectionSecurity = "TLS"
			*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
			*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
			*cfg.LogSettings.EnableDiagnostics = true
		})
		require.NoError(t, err)

		s.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
			panic("log this panic")
		})

		require.NoError(t, s.Start())
		defer s.Shutdown()

		resp, err := client.Get("https://localhost:" + strconv.Itoa(s.ListenAddr.Port) + "/panic")
		require.Nil(t, resp)
		require.True(t, errors.Is(err, io.EOF), fmt.Sprintf("unexpected error: %s", err))

		sentry.Flush(time.Second)
		select {
		case <-data:
			require.Fail(t, "Sentry received a message, even though it's disabled!")
		case <-time.After(time.Second):
			t.Log("Sentry request didn't arrive. Good!")
		}
	})

	t.Run("sentry is enabled, report should be received", func(t *testing.T) {
		data := make(chan bool, 1)

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Log("Received sentry request!")
			data <- true
		}))
		defer server.Close()

		_, port, _ := net.SplitHostPort(server.Listener.Addr().String())
		dsn, err := sentry.NewDsn(fmt.Sprintf("http://test:test@localhost:%s/123", port))
		require.NoError(t, err)
		SentryDSN = dsn.String()

		s, err := newServerWithConfig(t, func(cfg *model.Config) {
			*cfg.ServiceSettings.ListenAddress = "localhost:0"
			*cfg.ServiceSettings.ConnectionSecurity = "TLS"
			*cfg.ServiceSettings.TLSKeyFile = path.Join(testDir, "tls_test_key.pem")
			*cfg.ServiceSettings.TLSCertFile = path.Join(testDir, "tls_test_cert.pem")
			*cfg.LogSettings.EnableSentry = true
			*cfg.LogSettings.EnableDiagnostics = true
		})
		require.NoError(t, err)

		// Route for just panicking
		s.Router.HandleFunc("/panic", func(writer http.ResponseWriter, request *http.Request) {
			panic("log this panic")
		})

		require.NoError(t, s.Start())
		defer s.Shutdown()

		resp, err := client.Get("https://localhost:" + strconv.Itoa(s.ListenAddr.Port) + "/panic")
		require.Nil(t, resp)
		require.True(t, errors.Is(err, io.EOF), fmt.Sprintf("unexpected error: %s", err))

		sentry.Flush(time.Second)
		select {
		case <-data:
			t.Log("Sentry request arrived. Good!")
		case <-time.After(time.Second * 10):
			require.Fail(t, "Sentry report didn't arrive")
		}
	})
}

func TestCancelTaskSetsTaskToNil(t *testing.T) {
	var taskMut sync.Mutex
	task := model.CreateRecurringTaskFromNextIntervalTime("a test task", func() {}, 5*time.Minute)
	require.NotNil(t, task)
	cancelTask(&taskMut, &task)
	require.Nil(t, task)
	require.NotPanics(t, func() { cancelTask(&taskMut, &task) })
}

func TestOriginChecker(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowCorsFrom = ""
	})

	tcs := []struct {
		SiteURL      string
		HeaderScheme string
		HeaderHost   string
		Pass         bool
	}{
		{
			HeaderHost:   "test.com",
			HeaderScheme: "https://",
			SiteURL:      "https://test.com",
			Pass:         true,
		},
		{
			HeaderHost:   "test.com",
			HeaderScheme: "http://",
			SiteURL:      "https://test.com",
			Pass:         false,
		},
		{
			HeaderHost:   "test.com",
			HeaderScheme: "https://",
			SiteURL:      "https://www.test.com",
			Pass:         false,
		},
		{
			HeaderHost:   "example.com",
			HeaderScheme: "http://",
			SiteURL:      "http://test.com",
			Pass:         false,
		},
		{
			HeaderHost:   "null",
			HeaderScheme: "",
			SiteURL:      "http://test.com",
			Pass:         false,
		},
	}

	for i, tc := range tcs {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = tc.SiteURL
		})

		r := &http.Request{
			Header: http.Header{"Origin": []string{fmt.Sprintf("%s%s", tc.HeaderScheme, tc.HeaderHost)}},
		}
		res := th.App.OriginChecker()(r)
		require.Equalf(t, tc.Pass, res, "Test case (%d)", i)
	}
}
