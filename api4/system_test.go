package api4

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPing(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	goRoutineHealthThreshold := *th.App.Config().ServiceSettings.GoroutineHealthThreshold
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoroutineHealthThreshold = goRoutineHealthThreshold })
	}()

	status, resp := Client.GetPing()
	CheckNoError(t, resp)
	if status != "OK" {
		t.Fatal("should return OK")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoroutineHealthThreshold = 10 })
	status, resp = th.SystemAdminClient.GetPing()
	CheckInternalErrorStatus(t, resp)
	if status != "unhealthy" {
		t.Fatal("should return unhealthy")
	}
}

func TestGetConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.GetConfig()
	CheckForbiddenStatus(t, resp)

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	require.NotEqual(t, "", cfg.TeamSettings.SiteName)

	if *cfg.LdapSettings.BindPassword != model.FAKE_SETTING && len(*cfg.LdapSettings.BindPassword) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.FileSettings.PublicLinkSalt != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if cfg.FileSettings.AmazonS3SecretAccessKey != model.FAKE_SETTING && len(cfg.FileSettings.AmazonS3SecretAccessKey) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if cfg.EmailSettings.InviteSalt != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if cfg.EmailSettings.SMTPPassword != model.FAKE_SETTING && len(cfg.EmailSettings.SMTPPassword) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if cfg.GitLabSettings.Secret != model.FAKE_SETTING && len(cfg.GitLabSettings.Secret) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if *cfg.SqlSettings.DataSource != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if cfg.SqlSettings.AtRestEncryptKey != model.FAKE_SETTING {
		t.Fatal("did not sanitize properly")
	}
	if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceReplicas) != 0 {
		t.Fatal("did not sanitize properly")
	}
	if !strings.Contains(strings.Join(cfg.SqlSettings.DataSourceSearchReplicas, " "), model.FAKE_SETTING) && len(cfg.SqlSettings.DataSourceSearchReplicas) != 0 {
		t.Fatal("did not sanitize properly")
	}
}

func TestReloadConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	flag, resp := Client.ReloadConfig()
	CheckForbiddenStatus(t, resp)
	if flag {
		t.Fatal("should not Reload the config due no permission.")
	}

	flag, resp = th.SystemAdminClient.ReloadConfig()
	CheckNoError(t, resp)
	if !flag {
		t.Fatal("should Reload the config")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.MaxUsersPerTeam = 50 })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.EnableOpenServer = true })
}

func TestUpdateConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	cfg, resp := th.SystemAdminClient.GetConfig()
	CheckNoError(t, resp)

	_, resp = Client.UpdateConfig(cfg)
	CheckForbiddenStatus(t, resp)

	SiteName := th.App.Config().TeamSettings.SiteName

	cfg.TeamSettings.SiteName = "MyFancyName"
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	require.Equal(t, "MyFancyName", cfg.TeamSettings.SiteName, "It should update the SiteName")

	//Revert the change
	cfg.TeamSettings.SiteName = SiteName
	cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
	CheckNoError(t, resp)

	require.Equal(t, SiteName, cfg.TeamSettings.SiteName, "It should update the SiteName")

	t.Run("Should not be able to modify PluginSettings.EnableUploads", func(t *testing.T) {
		oldEnableUploads := *th.App.GetConfig().PluginSettings.EnableUploads
		*cfg.PluginSettings.EnableUploads = !oldEnableUploads

		cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
		CheckNoError(t, resp)
		assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
		assert.Equal(t, oldEnableUploads, *th.App.GetConfig().PluginSettings.EnableUploads)

		cfg.PluginSettings.EnableUploads = nil
		cfg, resp = th.SystemAdminClient.UpdateConfig(cfg)
		CheckNoError(t, resp)
		assert.Equal(t, oldEnableUploads, *cfg.PluginSettings.EnableUploads)
		assert.Equal(t, oldEnableUploads, *th.App.GetConfig().PluginSettings.EnableUploads)
	})
}

func TestGetEnvironmentConfig(t *testing.T) {
	os.Setenv("MM_SERVICESETTINGS_SITEURL", "http://example.mattermost.com")
	os.Setenv("MM_SERVICESETTINGS_ENABLECUSTOMEMOJI", "true")
	defer os.Unsetenv("MM_SERVICESETTINGS_SITEURL")

	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	t.Run("as system admin", func(t *testing.T) {
		SystemAdminClient := th.SystemAdminClient

		envConfig, resp := SystemAdminClient.GetEnvironmentConfig()
		CheckNoError(t, resp)

		if serviceSettings, ok := envConfig["ServiceSettings"]; !ok {
			t.Fatal("should've returned ServiceSettings")
		} else if serviceSettingsAsMap, ok := serviceSettings.(map[string]interface{}); !ok {
			t.Fatal("should've returned ServiceSettings as a map")
		} else {
			if siteURL, ok := serviceSettingsAsMap["SiteURL"]; !ok {
				t.Fatal("should've returned ServiceSettings.SiteURL")
			} else if siteURLAsBool, ok := siteURL.(bool); !ok {
				t.Fatal("should've returned ServiceSettings.SiteURL as a boolean")
			} else if !siteURLAsBool {
				t.Fatal("should've returned ServiceSettings.SiteURL as true")
			}

			if enableCustomEmoji, ok := serviceSettingsAsMap["EnableCustomEmoji"]; !ok {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji")
			} else if enableCustomEmojiAsBool, ok := enableCustomEmoji.(bool); !ok {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji as a boolean")
			} else if !enableCustomEmojiAsBool {
				t.Fatal("should've returned ServiceSettings.EnableCustomEmoji as true")
			}
		}

		if _, ok := envConfig["TeamSettings"]; ok {
			t.Fatal("should not have returned TeamSettings")
		}
	})

	t.Run("as team admin", func(t *testing.T) {
		TeamAdminClient := th.CreateClient()
		th.LoginTeamAdminWithClient(TeamAdminClient)

		_, resp := TeamAdminClient.GetEnvironmentConfig()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as regular user", func(t *testing.T) {
		Client := th.Client

		_, resp := Client.GetEnvironmentConfig()
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as not-regular user", func(t *testing.T) {
		Client := th.CreateClient()

		_, resp := Client.GetEnvironmentConfig()
		CheckUnauthorizedStatus(t, resp)
	})
}

func TestGetOldClientConfig(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	testKey := "supersecretkey"
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.GoogleDeveloperKey = testKey })

	t.Run("with session, without limited config", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.GoogleDeveloperKey = testKey
			*cfg.ServiceSettings.ExperimentalLimitClientConfig = false
		})

		Client := th.Client

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if config["GoogleDeveloperKey"] != testKey {
			t.Fatal("config missing developer key")
		}
	})

	t.Run("without session, without limited config", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.GoogleDeveloperKey = testKey
			*cfg.ServiceSettings.ExperimentalLimitClientConfig = false
		})

		Client := th.CreateClient()

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if config["GoogleDeveloperKey"] != testKey {
			t.Fatal("config missing developer key")
		}
	})

	t.Run("with session, with limited config", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.GoogleDeveloperKey = testKey
			*cfg.ServiceSettings.ExperimentalLimitClientConfig = true
		})

		Client := th.Client

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if config["GoogleDeveloperKey"] != testKey {
			t.Fatal("config missing developer key")
		}
	})

	t.Run("without session, without limited config", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.ServiceSettings.GoogleDeveloperKey = testKey
			*cfg.ServiceSettings.ExperimentalLimitClientConfig = true
		})

		Client := th.CreateClient()

		config, resp := Client.GetOldClientConfig("")
		CheckNoError(t, resp)

		if len(config["Version"]) == 0 {
			t.Fatal("config not returned correctly")
		}

		if _, ok := config["GoogleDeveloperKey"]; ok {
			t.Fatal("config should be missing developer key")
		}
	})

	t.Run("missing format", func(t *testing.T) {
		Client := th.Client

		if _, err := Client.DoApiGet("/config/client", ""); err == nil || err.StatusCode != http.StatusNotImplemented {
			t.Fatal("should have errored with 501")
		}
	})

	t.Run("invalid format", func(t *testing.T) {
		Client := th.Client

		if _, err := Client.DoApiGet("/config/client?format=junk", ""); err == nil || err.StatusCode != http.StatusBadRequest {
			t.Fatal("should have errored with 400")
		}
	})
}

func TestGetOldClientLicense(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	license, resp := Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	if len(license["IsLicensed"]) == 0 {
		t.Fatal("license not returned correctly")
	}

	Client.Logout()

	_, resp = Client.GetOldClientLicense("")
	CheckNoError(t, resp)

	if _, err := Client.DoApiGet("/license/client", ""); err == nil || err.StatusCode != http.StatusNotImplemented {
		t.Fatal("should have errored with 501")
	}

	if _, err := Client.DoApiGet("/license/client?format=junk", ""); err == nil || err.StatusCode != http.StatusBadRequest {
		t.Fatal("should have errored with 400")
	}

	license, resp = th.SystemAdminClient.GetOldClientLicense("")
	CheckNoError(t, resp)

	if len(license["IsLicensed"]) == 0 {
		t.Fatal("license not returned correctly")
	}
}

func TestGetAudits(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	audits, resp := th.SystemAdminClient.GetAudits(0, 100, "")
	CheckNoError(t, resp)

	if len(audits) == 0 {
		t.Fatal("should not be empty")
	}

	audits, resp = th.SystemAdminClient.GetAudits(0, 1, "")
	CheckNoError(t, resp)

	if len(audits) != 1 {
		t.Fatal("should only be 1")
	}

	audits, resp = th.SystemAdminClient.GetAudits(1, 1, "")
	CheckNoError(t, resp)

	if len(audits) != 1 {
		t.Fatal("should only be 1")
	}

	_, resp = th.SystemAdminClient.GetAudits(-1, -1, "")
	CheckNoError(t, resp)

	_, resp = Client.GetAudits(0, 100, "")
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetAudits(0, 100, "")
	CheckUnauthorizedStatus(t, resp)
}

func TestEmailTest(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	config := model.Config{
		EmailSettings: model.EmailSettings{
			SMTPServer: "",
			SMTPPort:   "",
		},
	}

	_, resp := Client.TestEmail(&config)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestEmail(&config)
	CheckErrorMessage(t, resp, "api.admin.test_email.missing_server")
	CheckBadRequestStatus(t, resp)

	inbucket_host := os.Getenv("CI_HOST")
	if inbucket_host == "" {
		inbucket_host = "dockerhost"
	}

	inbucket_port := os.Getenv("CI_INBUCKET_PORT")
	if inbucket_port == "" {
		inbucket_port = "9000"
	}

	config.EmailSettings.SMTPServer = inbucket_host
	config.EmailSettings.SMTPPort = inbucket_port
	_, resp = th.SystemAdminClient.TestEmail(&config)
	CheckOKStatus(t, resp)
}

func TestDatabaseRecycle(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.DatabaseRecycle()
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.DatabaseRecycle()
	CheckNoError(t, resp)
}

func TestInvalidateCaches(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	flag, resp := Client.InvalidateCaches()
	CheckForbiddenStatus(t, resp)
	if flag {
		t.Fatal("should not clean the cache due no permission.")
	}

	flag, resp = th.SystemAdminClient.InvalidateCaches()
	CheckNoError(t, resp)
	if !flag {
		t.Fatal("should clean the cache")
	}
}

func TestGetLogs(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	for i := 0; i < 20; i++ {
		mlog.Info(fmt.Sprint(i))
	}

	logs, resp := th.SystemAdminClient.GetLogs(0, 10)
	CheckNoError(t, resp)

	if len(logs) != 10 {
		t.Log(len(logs))
		t.Fatal("wrong length")
	}

	logs, resp = th.SystemAdminClient.GetLogs(1, 10)
	CheckNoError(t, resp)

	if len(logs) != 10 {
		t.Log(len(logs))
		t.Fatal("wrong length")
	}

	logs, resp = th.SystemAdminClient.GetLogs(-1, -1)
	CheckNoError(t, resp)

	if len(logs) == 0 {
		t.Fatal("should not be empty")
	}

	_, resp = Client.GetLogs(0, 10)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetLogs(0, 10)
	CheckUnauthorizedStatus(t, resp)
}

func TestPostLog(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableDev := *th.App.Config().ServiceSettings.EnableDeveloper
	defer func() {
		*th.App.Config().ServiceSettings.EnableDeveloper = enableDev
	}()
	*th.App.Config().ServiceSettings.EnableDeveloper = true

	message := make(map[string]string)
	message["level"] = "ERROR"
	message["message"] = "this is a test"

	_, resp := Client.PostLog(message)
	CheckNoError(t, resp)

	Client.Logout()

	_, resp = Client.PostLog(message)
	CheckNoError(t, resp)

	*th.App.Config().ServiceSettings.EnableDeveloper = false

	_, resp = Client.PostLog(message)
	CheckForbiddenStatus(t, resp)

	logMessage, resp := th.SystemAdminClient.PostLog(message)
	CheckNoError(t, resp)
	if len(logMessage) == 0 {
		t.Fatal("should return the log message")
	}
}

func TestUploadLicenseFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	ok, resp := Client.UploadLicenseFile([]byte{})
	CheckForbiddenStatus(t, resp)
	if ok {
		t.Fatal("should fail")
	}

	ok, resp = th.SystemAdminClient.UploadLicenseFile([]byte{})
	CheckBadRequestStatus(t, resp)
	if ok {
		t.Fatal("should fail")
	}
}

func TestRemoveLicenseFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	ok, resp := Client.RemoveLicenseFile()
	CheckForbiddenStatus(t, resp)
	if ok {
		t.Fatal("should fail")
	}

	ok, resp = th.SystemAdminClient.RemoveLicenseFile()
	CheckNoError(t, resp)
	if !ok {
		t.Fatal("should pass")
	}
}

func TestGetAnalyticsOld(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	rows, resp := Client.GetAnalyticsOld("", "")
	CheckForbiddenStatus(t, resp)
	if rows != nil {
		t.Fatal("should be nil")
	}

	rows, resp = th.SystemAdminClient.GetAnalyticsOld("", "")
	CheckNoError(t, resp)

	found := false
	found2 := false
	for _, row := range rows {
		if row.Name == "unique_user_count" {
			found = true
		} else if row.Name == "inactive_user_count" {
			found2 = true
			assert.True(t, row.Value >= 0)
		}
	}

	assert.True(t, found, "should return unique user count")
	assert.True(t, found2, "should return inactive user count")

	_, resp = th.SystemAdminClient.GetAnalyticsOld("post_counts_day", "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetAnalyticsOld("user_counts_with_posts_day", "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetAnalyticsOld("extra_counts", "")
	CheckNoError(t, resp)

	rows, resp = th.SystemAdminClient.GetAnalyticsOld("", th.BasicTeam.Id)
	CheckNoError(t, resp)

	for _, row := range rows {
		if row.Name == "inactive_user_count" {
			assert.Equal(t, float64(-1), row.Value, "inactive user count should be -1 when team specified")
		}
	}

	rows2, resp2 := th.SystemAdminClient.GetAnalyticsOld("standard", "")
	CheckNoError(t, resp2)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(0), rows2[5].Value)

	WebSocketClient, err := th.CreateWebSocketClient()
	if err != nil {
		t.Fatal(err)
	}

	rows2, resp2 = th.SystemAdminClient.GetAnalyticsOld("standard", "")
	CheckNoError(t, resp2)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(1), rows2[5].Value)

	WebSocketClient.Close()

	rows2, resp2 = th.SystemAdminClient.GetAnalyticsOld("standard", "")
	CheckNoError(t, resp2)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(0), rows2[5].Value)

	Client.Logout()
	_, resp = Client.GetAnalyticsOld("", th.BasicTeam.Id)
	CheckUnauthorizedStatus(t, resp)
}

func TestS3TestConnection(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	s3Host := os.Getenv("CI_HOST")
	if s3Host == "" {
		s3Host = "dockerhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9001"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)
	config := model.Config{
		FileSettings: model.FileSettings{
			DriverName:              model.NewString(model.IMAGE_DRIVER_S3),
			AmazonS3AccessKeyId:     model.MINIO_ACCESS_KEY,
			AmazonS3SecretAccessKey: model.MINIO_SECRET_KEY,
			AmazonS3Bucket:          "",
			AmazonS3Endpoint:        s3Endpoint,
			AmazonS3SSL:             model.NewBool(false),
		},
	}

	_, resp := Client.TestS3Connection(&config)
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.TestS3Connection(&config)
	CheckBadRequestStatus(t, resp)
	if resp.Error.Message != "S3 Bucket is required" {
		t.Fatal("should return error - missing s3 bucket")
	}

	config.FileSettings.AmazonS3Bucket = model.MINIO_BUCKET
	config.FileSettings.AmazonS3Region = "us-east-1"
	_, resp = th.SystemAdminClient.TestS3Connection(&config)
	CheckOKStatus(t, resp)

	config.FileSettings.AmazonS3Region = ""
	_, resp = th.SystemAdminClient.TestS3Connection(&config)
	CheckOKStatus(t, resp)

	config.FileSettings.AmazonS3Bucket = "Wrong_bucket"
	_, resp = th.SystemAdminClient.TestS3Connection(&config)
	CheckInternalErrorStatus(t, resp)
	assert.Equal(t, "Unable to create bucket.", resp.Error.Message)

	config.FileSettings.AmazonS3Bucket = "shouldcreatenewbucket"
	_, resp = th.SystemAdminClient.TestS3Connection(&config)
	CheckOKStatus(t, resp)

}

func TestSupportedTimezones(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	supportedTimezonesFromConfig := th.App.Timezones()
	supportedTimezones, resp := Client.GetSupportedTimezone()

	CheckNoError(t, resp)
	assert.Equal(t, supportedTimezonesFromConfig, supportedTimezones)
}

func TestRedirectLocation(t *testing.T) {
	expected := "https://mattermost.com/wp-content/themes/mattermostv2/img/logo-light.svg"

	testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.Header().Set("Location", expected)
		res.WriteHeader(http.StatusFound)
		res.Write([]byte("body"))
	}))
	defer func() { testServer.Close() }()

	mockBitlyLink := testServer.URL

	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	enableLinkPreviews := *th.App.Config().ServiceSettings.EnableLinkPreviews
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = enableLinkPreviews })
	}()

	*th.App.Config().ServiceSettings.EnableLinkPreviews = true

	_, resp := th.SystemAdminClient.GetRedirectLocation("https://mattermost.com/", "")
	CheckNoError(t, resp)

	_, resp = th.SystemAdminClient.GetRedirectLocation("", "")
	CheckBadRequestStatus(t, resp)

	actual, resp := th.SystemAdminClient.GetRedirectLocation(mockBitlyLink, "")
	CheckNoError(t, resp)
	if actual != expected {
		t.Errorf("Expected %v but got %v.", expected, actual)
	}

	*th.App.Config().ServiceSettings.EnableLinkPreviews = false
	actual, resp = th.SystemAdminClient.GetRedirectLocation("https://mattermost.com/", "")
	CheckNoError(t, resp)
	assert.Equal(t, actual, "")

	actual, resp = th.SystemAdminClient.GetRedirectLocation("", "")
	CheckNoError(t, resp)
	assert.Equal(t, actual, "")

	actual, resp = th.SystemAdminClient.GetRedirectLocation(mockBitlyLink, "")
	CheckNoError(t, resp)
	assert.Equal(t, actual, "")

	Client.Logout()
	_, resp = Client.GetRedirectLocation("", "")
	CheckUnauthorizedStatus(t, resp)
}
