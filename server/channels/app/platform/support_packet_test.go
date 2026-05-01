// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/config"
	emocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	semocks "github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
	fmocks "github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

func TestGenerateSupportPacket(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t)

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(dir)
		assert.NoError(t, err)
	})

	// Override log root path to allow log file reads from our temp directory
	th.Service.SetLogRootPathOverride(dir)

	th.Service.UpdateConfig(func(cfg *model.Config) {
		*cfg.LogSettings.FileLocation = dir
	})

	logLocation := config.GetLogFileLocation(dir)

	genMockLogFiles := func() {
		d1 := []byte("hello\ngo\n")
		genErr := os.WriteFile(logLocation, d1, 0600)
		require.NoError(t, genErr)
	}
	genMockLogFiles()

	getFileNames := func(t *testing.T, fileDatas []model.FileData) []string {
		var rFileNames []string
		for _, fileData := range fileDatas {
			require.NotNil(t, fileData)
			assert.Positive(t, len(fileData.Body))

			rFileNames = append(rFileNames, fileData.Filename)
		}
		return rFileNames
	}

	expectedFileNames := []string{
		"diagnostics.yaml",
		"sanitized_config.json",
		"cpu.prof",
		"heap.prof",
		"goroutines",
	}

	expectedFileNamesWithLogs := append(expectedFileNames, "mattermost.log")

	var fileDatas []model.FileData

	t.Run("generate Support Packet with logs", func(t *testing.T) {
		fileDatas, err = th.Service.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		require.NoError(t, err)
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNamesWithLogs, rFileNames)
	})

	t.Run("generate Support Packet without logs", func(t *testing.T) {
		fileDatas, err = th.Service.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: false,
		})
		require.NoError(t, err)
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNames, rFileNames)
	})

	t.Run("remove the log files and ensure that an error is returned", func(t *testing.T) {
		err = os.Remove(logLocation)
		require.NoError(t, err)
		t.Cleanup(genMockLogFiles)

		fileDatas, err = th.Service.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed read mattermost log file")
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, expectedFileNames, rFileNames)
	})

	t.Run("with advanced logs", func(t *testing.T) {
		optLDAP := map[string]string{
			"filename": path.Join(dir, "ldap.log"),
		}
		dataLDAP, err := json.Marshal(optLDAP)
		require.NoError(t, err)

		cfg := mlog.LoggerConfiguration{
			"ldap-file": mlog.TargetCfg{
				Type:   "file",
				Format: "json",
				Levels: []mlog.Level{
					mlog.LvlLDAPError,
					mlog.LvlLDAPWarn,
					mlog.LvlLDAPInfo,
					mlog.LvlLDAPDebug,
				},
				Options: dataLDAP,
			},
		}
		cfgData, err := json.Marshal(cfg)
		require.NoError(t, err)

		th.Service.UpdateConfig(func(c *model.Config) {
			c.LogSettings.AdvancedLoggingJSON = cfgData
		})

		th.Service.Logger().LogM([]mlog.Level{mlog.LvlLDAPInfo}, "Some LDAP info")
		err = th.Service.Logger().Flush()
		require.NoError(t, err)

		fileDatas, err = th.Service.GenerateSupportPacket(th.Context, &model.SupportPacketOptions{
			IncludeLogs: true,
		})
		require.NoError(t, err)
		rFileNames := getFileNames(t, fileDatas)

		assert.ElementsMatch(t, append(expectedFileNamesWithLogs, "ldap.log"), rFileNames)

		found := false
		for _, fileData := range fileDatas {
			if fileData.Filename == "ldap.log" {
				testlib.AssertLog(t, bytes.NewBuffer(fileData.Body), mlog.LvlLDAPInfo.Name, "Some LDAP info")
				found = true
				break
			}
		}
		assert.True(t, found)
	})
}

func TestGetSupportPacketDiagnostics(t *testing.T) {
	th := Setup(t).InitBasic(t)

	th.Service.installTypeOverride = "docker"

	licenseUsers := 100
	license := model.NewTestLicense("ldap")
	license.SkuShortName = model.LicenseShortSkuEnterprise
	license.Features.Users = model.NewPointer(licenseUsers)
	ok := th.Service.SetLicense(license)
	require.True(t, ok)

	getDiagnostics := func(t *testing.T) *model.SupportPacketDiagnostics {
		t.Helper()

		fileData, err := th.Service.getSupportPacketDiagnostics(th.Context)
		require.NotNil(t, fileData)
		assert.Equal(t, "diagnostics.yaml", fileData.Filename)
		assert.Positive(t, len(fileData.Body))
		assert.NoError(t, err)

		var d model.SupportPacketDiagnostics
		require.NoError(t, yaml.Unmarshal(fileData.Body, &d))
		return &d
	}

	t.Run("Happy path", func(t *testing.T) {
		d := getDiagnostics(t)

		assert.Equal(t, 2, d.Version)

		/* License */
		assert.Equal(t, "My awesome Company", d.License.Company)
		assert.Equal(t, licenseUsers, d.License.Users)
		assert.Equal(t, model.LicenseShortSkuEnterprise, d.License.SkuShortName)
		assert.Equal(t, false, d.License.IsTrial)
		assert.Equal(t, false, d.License.IsGovSKU)

		/* Server information */
		assert.NotEmpty(t, d.Server.OS)
		assert.NotEmpty(t, d.Server.Architecture)
		assert.NotEmpty(t, d.Server.Hostname)
		assert.Equal(t, model.CurrentVersion, d.Server.Version)
		// BuildHash is not present in tests
		assert.NotEmpty(t, d.Server.GoVersion)
		assert.Equal(t, "docker", d.Server.InstallationType)
		assert.Positive(t, d.Server.CPUCores)
		assert.Positive(t, d.Server.TotalMemoryMB)
		assert.True(t, d.Server.OpenFileDescriptors == -1 || d.Server.OpenFileDescriptors > 0, "OpenFileDescriptors should be -1 (unsupported) or positive, got %d", d.Server.OpenFileDescriptors)
		assert.True(t, d.Server.MaxFileDescriptors == -1 || d.Server.MaxFileDescriptors > 0, "MaxFileDescriptors should be -1 (unsupported) or positive, got %d", d.Server.MaxFileDescriptors)
		assert.Positive(t, d.Server.ProcessID)
		assert.False(t, d.Server.StartedAt.IsZero())
		if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
			assert.False(t, d.Server.HostStartedAt.IsZero())
			assert.True(t, !d.Server.HostStartedAt.After(d.Server.StartedAt))
		} else {
			assert.True(t, d.Server.HostStartedAt.IsZero(), "HostStartedAt should be zero on unsupported platforms")
		}

		/* Config */
		assert.Equal(t, "memory://", d.Config.Source)

		/* DB */
		assert.NotEmpty(t, d.Database.Type)
		assert.NotEmpty(t, d.Database.Version)
		assert.NotEmpty(t, d.Database.SchemaVersion)
		assert.NotZero(t, d.Database.MasterConnectios)
		assert.Zero(t, d.Database.ReplicaConnectios)
		assert.Zero(t, d.Database.SearchConnections)

		/* File store */
		assert.Equal(t, "OK", d.FileStore.Status)
		assert.Empty(t, d.FileStore.Error)
		assert.Equal(t, "local", d.FileStore.Driver)
		if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
			assert.NotEmpty(t, d.FileStore.FilesystemType, "FilesystemType should not be empty on supported platforms")
			assert.Positive(t, d.FileStore.TotalMB, "TotalMB should be positive on supported platforms")
			assert.Positive(t, d.FileStore.AvailableMB, "AvailableMB should be positive on supported platforms")
		} else {
			assert.Empty(t, d.FileStore.FilesystemType)
			assert.Zero(t, d.FileStore.TotalMB)
			assert.Zero(t, d.FileStore.AvailableMB)
		}

		/* Websockets */
		assert.Zero(t, d.Websocket.Connections)

		/* Cluster */
		assert.Empty(t, d.Cluster.ID)
		assert.Zero(t, d.Cluster.NumberOfNodes)

		/* LDAP */
		assert.Equal(t, model.StatusDisabled, d.LDAP.Status)
		assert.Empty(t, d.LDAP.Error)
		assert.Empty(t, d.LDAP.ServerName)
		assert.Empty(t, d.LDAP.ServerVersion)

		/* SAML */
		assert.Empty(t, d.SAML.ProviderType)

		/* Elastic Search */
		assert.Equal(t, model.StatusDisabled, d.ElasticSearch.Status)
		assert.Empty(t, d.ElasticSearch.ServerVersion)
		assert.Empty(t, d.ElasticSearch.ServerPlugins)
	})

	t.Run("filestore fails", func(t *testing.T) {
		fb := &fmocks.FileBackend{}
		err := SetFileStore(fb)(th.Service)
		require.NoError(t, err)
		fb.On("DriverName").Return("mock")
		fb.On("TestConnection").Return(errors.New("all broken"))

		packet := getDiagnostics(t)

		assert.Equal(t, "FAIL", packet.FileStore.Status)
		assert.Equal(t, "all broken", packet.FileStore.Error)
		assert.Equal(t, "mock", packet.FileStore.Driver)
	})

	t.Run("s3 driver omits disk space fields", func(t *testing.T) {
		orig := th.Service.filestore
		t.Cleanup(func() {
			err := SetFileStore(orig)(th.Service)
			require.NoError(t, err)
		})

		fb := &fmocks.FileBackend{}
		err := SetFileStore(fb)(th.Service)
		require.NoError(t, err)
		fb.On("DriverName").Return("amazons3")
		fb.On("TestConnection").Return(nil)

		packet := getDiagnostics(t)

		assert.Equal(t, "OK", packet.FileStore.Status)
		assert.Equal(t, "amazons3", packet.FileStore.Driver)
		assert.Empty(t, packet.FileStore.FilesystemType)
		assert.Zero(t, packet.FileStore.TotalMB)
		assert.Zero(t, packet.FileStore.AvailableMB)
	})

	t.Run("no LDAP info if LDAP sync is disabled", func(t *testing.T) {
		ldapMock := &emocks.LdapDiagnosticInterface{}
		originalLDAP := th.Service.ldapDiagnostic
		t.Cleanup(func() {
			th.Service.ldapDiagnostic = originalLDAP
		})
		th.Service.ldapDiagnostic = ldapMock

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusDisabled, packet.LDAP.Status)
		assert.Equal(t, "", packet.LDAP.ServerName)
		assert.Equal(t, "", packet.LDAP.ServerVersion)
	})

	th.Service.UpdateConfig(func(cfg *model.Config) {
		cfg.LdapSettings.EnableSync = model.NewPointer(true)
	})

	t.Run("no LDAP vendor info found", func(t *testing.T) {
		ldapMock := &emocks.LdapDiagnosticInterface{}
		ldapMock.On(
			"GetVendorNameAndVendorVersion",
			mock.AnythingOfType("*request.Context"),
		).Return("", "", nil)
		ldapMock.On(
			"RunTest",
			mock.AnythingOfType("*request.Context"),
		).Return(nil)
		originalLDAP := th.Service.ldapDiagnostic
		t.Cleanup(func() {
			th.Service.ldapDiagnostic = originalLDAP
		})
		th.Service.ldapDiagnostic = ldapMock

		packet := getDiagnostics(t)

		assert.Equal(t, "OK", packet.LDAP.Status)
		assert.Empty(t, packet.LDAP.Error)
		assert.Equal(t, "unknown", packet.LDAP.ServerName)
		assert.Equal(t, "unknown", packet.LDAP.ServerVersion)
	})

	t.Run("found LDAP vendor info", func(t *testing.T) {
		ldapMock := &emocks.LdapDiagnosticInterface{}
		ldapMock.On(
			"GetVendorNameAndVendorVersion",
			mock.AnythingOfType("*request.Context"),
		).Return("some vendor", "v1.0.0", nil)
		ldapMock.On(
			"RunTest",
			mock.AnythingOfType("*request.Context"),
		).Return(nil)
		originalLDAP := th.Service.ldapDiagnostic
		t.Cleanup(func() {
			th.Service.ldapDiagnostic = originalLDAP
		})
		th.Service.ldapDiagnostic = ldapMock

		packet := getDiagnostics(t)

		assert.Equal(t, "OK", packet.LDAP.Status)
		assert.Empty(t, packet.LDAP.Error)
		assert.Equal(t, "some vendor", packet.LDAP.ServerName)
		assert.Equal(t, "v1.0.0", packet.LDAP.ServerVersion)
	})

	t.Run("LDAP test fails", func(t *testing.T) {
		ldapMock := &emocks.LdapDiagnosticInterface{}
		ldapMock.On(
			"GetVendorNameAndVendorVersion",
			mock.AnythingOfType("*request.Context"),
		).Return("some vendor", "v1.0.0", nil)
		ldapMock.On(
			"RunTest",
			mock.AnythingOfType("*request.Context"),
		).Return(model.NewAppError("", "some error", nil, "", 0))
		originalLDAP := th.Service.ldapDiagnostic
		t.Cleanup(func() {
			th.Service.ldapDiagnostic = originalLDAP
		})
		th.Service.ldapDiagnostic = ldapMock

		packet := getDiagnostics(t)

		assert.Equal(t, "FAIL", packet.LDAP.Status)
		assert.Equal(t, "some error", packet.LDAP.Error)
		assert.Equal(t, "unknown", packet.LDAP.ServerName)
		assert.Equal(t, "unknown", packet.LDAP.ServerVersion)
	})

	t.Run("SAML disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(false)
		})

		packet := getDiagnostics(t)

		assert.Empty(t, packet.SAML.ProviderType)
	})

	t.Run("SAML enabled with Keycloak provider", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(true)
			cfg.SamlSettings.Verify = model.NewPointer(false)
			cfg.SamlSettings.Encrypt = model.NewPointer(false)
			cfg.SamlSettings.IdpURL = model.NewPointer("http://localhost:8484/realms/mattermost/protocol/saml")
			cfg.SamlSettings.IdpDescriptorURL = model.NewPointer("http://localhost:8484/realms/mattermost")
			cfg.SamlSettings.ServiceProviderIdentifier = model.NewPointer("mattermost")
			cfg.SamlSettings.IdpCertificateFile = model.NewPointer("saml-idp.crt")
			cfg.SamlSettings.EmailAttribute = model.NewPointer("email")
			cfg.SamlSettings.UsernameAttribute = model.NewPointer("username")
		})

		packet := getDiagnostics(t)

		assert.Equal(t, "Keycloak", packet.SAML.ProviderType)
	})

	t.Run("SAML enabled with ADFS provider", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(true)
			cfg.SamlSettings.Verify = model.NewPointer(false)
			cfg.SamlSettings.Encrypt = model.NewPointer(false)
			cfg.SamlSettings.IdpURL = model.NewPointer("https://adfs.company.com/adfs/ls")
			cfg.SamlSettings.IdpDescriptorURL = model.NewPointer("https://adfs.company.com/adfs/services/trust")
			cfg.SamlSettings.ServiceProviderIdentifier = model.NewPointer("mattermost")
			cfg.SamlSettings.IdpCertificateFile = model.NewPointer("saml-idp.crt")
			cfg.SamlSettings.EmailAttribute = model.NewPointer("email")
			cfg.SamlSettings.UsernameAttribute = model.NewPointer("username")
		})

		packet := getDiagnostics(t)

		assert.Equal(t, "ADFS", packet.SAML.ProviderType)
	})

	t.Run("SAML enabled with unknown provider", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.SamlSettings.Enable = model.NewPointer(true)
			cfg.SamlSettings.Verify = model.NewPointer(false)
			cfg.SamlSettings.Encrypt = model.NewPointer(false)
			cfg.SamlSettings.IdpURL = model.NewPointer("https://custom-saml.example.com/sso/login")
			cfg.SamlSettings.IdpDescriptorURL = model.NewPointer("https://custom-saml.example.com/sso")
			cfg.SamlSettings.ServiceProviderIdentifier = model.NewPointer("mattermost")
			cfg.SamlSettings.IdpCertificateFile = model.NewPointer("saml-idp.crt")
			cfg.SamlSettings.EmailAttribute = model.NewPointer("email")
			cfg.SamlSettings.UsernameAttribute = model.NewPointer("username")
		})

		packet := getDiagnostics(t)

		assert.Equal(t, "unknown", packet.SAML.ProviderType)
	})

	t.Run("Elasticsearch config test when indexing disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.ElasticsearchSettings.Backend = model.NewPointer(model.ElasticsearchSettingsESBackend)
			cfg.ElasticsearchSettings.EnableIndexing = model.NewPointer(false)
		})

		esMock := &semocks.SearchEngineInterface{}
		esMock.On("GetFullVersion").Return("7.10.0")
		esMock.On("GetPlugins").Return([]string{"plugin1", "plugin2"})
		originalES := th.Service.SearchEngine.ElasticsearchEngine
		t.Cleanup(func() {
			th.Service.SearchEngine.ElasticsearchEngine = originalES
		})
		th.Service.SearchEngine.ElasticsearchEngine = esMock

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusDisabled, packet.ElasticSearch.Status)
		assert.Equal(t, model.ElasticsearchSettingsESBackend, packet.ElasticSearch.Backend)
		assert.Equal(t, "7.10.0", packet.ElasticSearch.ServerVersion)
		assert.Equal(t, []string{"plugin1", "plugin2"}, packet.ElasticSearch.ServerPlugins)
		assert.Empty(t, packet.ElasticSearch.Error)
	})

	t.Run("Elasticsearch config test when indexing enabled and config valid", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.ElasticsearchSettings.Backend = model.NewPointer(model.ElasticsearchSettingsOSBackend)
			cfg.ElasticsearchSettings.EnableIndexing = model.NewPointer(true)
		})

		esMock := &semocks.SearchEngineInterface{}
		esMock.On("GetFullVersion").Return("2.5.0")
		esMock.On("GetPlugins").Return([]string{"opensearch-plugin"})
		esMock.On("TestConfig", mock.AnythingOfType("*request.Context"), mock.Anything).Return(nil)
		originalES := th.Service.SearchEngine.ElasticsearchEngine
		t.Cleanup(func() {
			th.Service.SearchEngine.ElasticsearchEngine = originalES
		})
		th.Service.SearchEngine.ElasticsearchEngine = esMock

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusOk, packet.ElasticSearch.Status)
		assert.Equal(t, model.ElasticsearchSettingsOSBackend, packet.ElasticSearch.Backend)
		assert.Equal(t, "2.5.0", packet.ElasticSearch.ServerVersion)
		assert.Equal(t, []string{"opensearch-plugin"}, packet.ElasticSearch.ServerPlugins)
		assert.Empty(t, packet.ElasticSearch.Error)
	})

	t.Run("Elasticsearch config test when indexing enabled and config invalid", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.ElasticsearchSettings.Backend = model.NewPointer(model.ElasticsearchSettingsESBackend)
			cfg.ElasticsearchSettings.EnableIndexing = model.NewPointer(true)
		})

		esMock := &semocks.SearchEngineInterface{}
		esMock.On("GetFullVersion").Return("7.10.0")
		esMock.On("GetPlugins").Return([]string{"plugin1", "plugin2"})
		esMock.On("TestConfig", mock.AnythingOfType("*request.Context"), mock.Anything).Return(
			model.NewAppError("TestConfig", "ent.elasticsearch.test_config.connection_failed", nil, "connection refused", 500))
		originalES := th.Service.SearchEngine.ElasticsearchEngine
		t.Cleanup(func() {
			th.Service.SearchEngine.ElasticsearchEngine = originalES
		})
		th.Service.SearchEngine.ElasticsearchEngine = esMock

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusFail, packet.ElasticSearch.Status)
		assert.Equal(t, model.ElasticsearchSettingsESBackend, packet.ElasticSearch.Backend)
		assert.Equal(t, "7.10.0", packet.ElasticSearch.ServerVersion)
		assert.Equal(t, []string{"plugin1", "plugin2"}, packet.ElasticSearch.ServerPlugins)
		assert.Equal(t, "TestConfig: ent.elasticsearch.test_config.connection_failed, connection refused", packet.ElasticSearch.Error)
	})

	t.Run("push notifications disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = model.NewPointer(false)
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusDisabled, packet.Notifications.Push.Status)
		assert.Empty(t, packet.Notifications.Push.Error)
	})

	t.Run("push notifications reachable", func(t *testing.T) {
		pushServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, "/version", r.URL.Path)
			w.WriteHeader(http.StatusOK)
		}))
		defer pushServer.Close()

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
			cfg.EmailSettings.PushNotificationServer = model.NewPointer(pushServer.URL)
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
				cfg.EmailSettings.PushNotificationServer = model.NewPointer(model.GenericNotificationServer)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusOk, packet.Notifications.Push.Status)
		assert.Empty(t, packet.Notifications.Push.Error)
	})

	t.Run("push notifications unreachable", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
			cfg.EmailSettings.PushNotificationServer = model.NewPointer("http://localhost:1")
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendPushNotifications = model.NewPointer(true)
				cfg.EmailSettings.PushNotificationServer = model.NewPointer(model.GenericNotificationServer)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusFail, packet.Notifications.Push.Status)
		assert.NotEmpty(t, packet.Notifications.Push.Error)
	})

	t.Run("email notifications disabled", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendEmailNotifications = model.NewPointer(false)
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendEmailNotifications = model.NewPointer(true)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusDisabled, packet.Notifications.Email.Status)
		assert.Empty(t, packet.Notifications.Email.Error)
	})

	t.Run("email notifications reachable", func(t *testing.T) {
		l, listenErr := net.Listen("tcp", "127.0.0.1:0")
		require.NoError(t, listenErr)
		defer l.Close()

		go func() {
			for {
				conn, err := l.Accept()
				if err != nil {
					return
				}
				go func(c net.Conn) {
					defer c.Close()
					rw := bufio.NewReadWriter(bufio.NewReader(c), bufio.NewWriter(c))
					_, _ = rw.WriteString("220 localhost ESMTP Test\r\n")
					rw.Flush()
					for {
						line, err := rw.ReadString('\n')
						if err != nil {
							return
						}
						if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(line)), "QUIT") {
							_, _ = rw.WriteString("221 Bye\r\n")
							rw.Flush()
							return
						}
						_, _ = rw.WriteString("250 OK\r\n")
						rw.Flush()
					}
				}(conn)
			}
		}()

		tcpAddr := l.Addr().(*net.TCPAddr)
		smtpPort := strconv.Itoa(tcpAddr.Port)

		// MM_EMAILSETTINGS_SMTPSERVER may be set in CI and would override UpdateConfig.
		// Use t.Setenv so the env var is updated before UpdateConfig calls Store.Set(),
		// which re-reads GetEnvironment() (os.Environ()) and applies overrides.
		t.Setenv("MM_EMAILSETTINGS_SMTPSERVER", "127.0.0.1")

		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendEmailNotifications = model.NewPointer(true)
			cfg.EmailSettings.SMTPServer = model.NewPointer("127.0.0.1")
			cfg.EmailSettings.SMTPPort = model.NewPointer(smtpPort)
			cfg.EmailSettings.EnableSMTPAuth = model.NewPointer(false)
			cfg.EmailSettings.ConnectionSecurity = model.NewPointer("")
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendEmailNotifications = model.NewPointer(true)
				cfg.EmailSettings.SMTPServer = model.NewPointer(model.EmailSMTPDefaultServer)
				cfg.EmailSettings.SMTPPort = model.NewPointer(model.EmailSMTPDefaultPort)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusOk, packet.Notifications.Email.Status)
		assert.Empty(t, packet.Notifications.Email.Error)
	})

	t.Run("email notifications unreachable", func(t *testing.T) {
		th.Service.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.SendEmailNotifications = model.NewPointer(true)
			cfg.EmailSettings.SMTPServer = model.NewPointer("localhost")
			cfg.EmailSettings.SMTPPort = model.NewPointer("1")
			cfg.EmailSettings.SMTPServerTimeout = model.NewPointer(1)
		})
		t.Cleanup(func() {
			th.Service.UpdateConfig(func(cfg *model.Config) {
				cfg.EmailSettings.SendEmailNotifications = model.NewPointer(true)
				cfg.EmailSettings.SMTPServer = model.NewPointer(model.EmailSMTPDefaultServer)
				cfg.EmailSettings.SMTPPort = model.NewPointer(model.EmailSMTPDefaultPort)
				cfg.EmailSettings.SMTPServerTimeout = model.NewPointer(10)
			})
		})

		packet := getDiagnostics(t)

		assert.Equal(t, model.StatusFail, packet.Notifications.Email.Status)
		assert.NotEmpty(t, packet.Notifications.Email.Error)
	})
}

func TestGetSanitizedConfigFile(t *testing.T) {
	// t.Setenv is correct here: this test verifies that feature flags set via
	// environment variables (the production mechanism) appear in the sanitized
	// config output. UpdateConfig won't work because SetDefaults() resets
	// FeatureFlags before applyEnvironmentMap() re-applies env overrides.
	t.Setenv("MM_FEATUREFLAGS_TestFeature", "true")

	th := Setup(t)

	th.Service.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.AllowedUntrustedInternalConnections = model.NewPointer("example.com")
	})

	// Happy path where we have a sanitized config file with no err
	fileData, err := th.Service.getSanitizedConfigFile(th.Context)
	require.NotNil(t, fileData)
	assert.Equal(t, "sanitized_config.json", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
	assert.NoError(t, err)

	var config model.Config
	err = json.Unmarshal(fileData.Body, &config)
	require.NoError(t, err)

	// Ensure sensitive fields are redacted
	assert.Equal(t, model.FakeSetting, *config.FileSettings.PublicLinkSalt)

	// Ensure non-sensitive fields are present
	assert.Equal(t, "example.com", *config.ServiceSettings.AllowedUntrustedInternalConnections)

	// Ensure feature flags are present
	assert.Equal(t, "true", config.FeatureFlags.TestFeature)

	// Ensure DataSource is partially sanitized (not completely replaced with FakeSetting)
	// The default test database connection string should have username/password redacted
	assert.Contains(t, *config.SqlSettings.DataSource, "****:****")
	assert.NotEqual(t, model.FakeSetting, *config.SqlSettings.DataSource)
}

func TestGetCPUProfile(t *testing.T) {
	th := Setup(t)

	fileData, err := th.Service.getCPUProfile(th.Context)
	require.NoError(t, err)
	assert.Equal(t, "cpu.prof", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
}

func TestGetHeapProfile(t *testing.T) {
	th := Setup(t)

	fileData, err := th.Service.getHeapProfile(th.Context)
	require.NoError(t, err)
	assert.Equal(t, "heap.prof", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
}

func TestGetGoroutineProfile(t *testing.T) {
	th := Setup(t)

	fileData, err := th.Service.getGoroutineProfile(th.Context)
	require.NoError(t, err)
	assert.Equal(t, "goroutines", fileData.Filename)
	assert.Positive(t, len(fileData.Body))
}

func TestDetectSAMLProviderType(t *testing.T) {
	tests := []struct {
		name             string
		idpDescriptorURL string
		expectedProvider string
	}{
		{
			name:             "Keycloak provider",
			idpDescriptorURL: "http://localhost:8484/realms/mattermost",
			expectedProvider: "Keycloak",
		},
		{
			name:             "ADFS provider",
			idpDescriptorURL: "https://localhost/adfs/services/trust",
			expectedProvider: "ADFS",
		},
		{
			name:             "ADFS provider with bare /adfs path (no trailing slash)",
			idpDescriptorURL: "https://adfs.company.com/adfs",
			expectedProvider: "ADFS",
		},
		{
			name:             "Azure AD provider with login.microsoftonline.com",
			idpDescriptorURL: "https://login.microsoftonline.com/12345/saml2",
			expectedProvider: "Azure AD",
		},
		{
			name:             "Azure AD provider with sts.windows.net",
			idpDescriptorURL: "https://sts.windows.net/12345/",
			expectedProvider: "Azure AD",
		},
		{
			name:             "Okta provider",
			idpDescriptorURL: "https://company.okta.com/app/mattermost/saml",
			expectedProvider: "Okta",
		},
		{
			name:             "Okta preview provider",
			idpDescriptorURL: "https://company.oktapreview.com/app/mattermost/saml",
			expectedProvider: "Okta",
		},
		{
			name:             "Auth0 provider",
			idpDescriptorURL: "https://company.auth0.com/samlp/12345",
			expectedProvider: "Auth0",
		},
		{
			name:             "OneLogin provider",
			idpDescriptorURL: "https://app.onelogin.com/saml/metadata/12345",
			expectedProvider: "OneLogin",
		},
		{
			name:             "Google provider",
			idpDescriptorURL: "https://accounts.google.com/o/saml2?idpid=12345",
			expectedProvider: "Google Workspace",
		},
		{
			name:             "JumpCloud provider",
			idpDescriptorURL: "https://sso.jumpcloud.com/saml2/example",
			expectedProvider: "JumpCloud",
		},
		{
			name:             "Duo provider",
			idpDescriptorURL: "https://sso.duo.com/saml2/sp/12345",
			expectedProvider: "Duo",
		},
		{
			name:             "Centrify provider",
			idpDescriptorURL: "https://company.centrify.com/saml2",
			expectedProvider: "Centrify",
		},
		{
			name:             "Shibboleth provider with shibboleth.net",
			idpDescriptorURL: "https://idp.shibboleth.net/idp/shibboleth",
			expectedProvider: "Shibboleth",
		},
		{
			name:             "Shibboleth provider with /idp/shibboleth path",
			idpDescriptorURL: "https://university.edu/idp/shibboleth",
			expectedProvider: "Shibboleth",
		},
		{
			name:             "Case insensitive - Azure AD",
			idpDescriptorURL: "https://LOGIN.MICROSOFTONLINE.COM/12345/saml2",
			expectedProvider: "Azure AD",
		},
		{
			name:             "Case insensitive - Okta",
			idpDescriptorURL: "https://COMPANY.OKTA.COM/app/mattermost/saml",
			expectedProvider: "Okta",
		},
		{
			name:             "Unknown provider",
			idpDescriptorURL: "https://custom-saml.example.com/sso",
			expectedProvider: "unknown",
		},
		{
			name:             "Empty URL",
			idpDescriptorURL: "",
			expectedProvider: "unknown",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detectSAMLProviderType(tt.idpDescriptorURL)
			assert.Equal(t, tt.expectedProvider, result)
		})
	}
}
