// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestGetPing(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		t.Run("healthy", func(t *testing.T) {
			status, _, err := client.GetPing(context.Background())
			require.NoError(t, err)
			assert.Equal(t, model.StatusOk, status)
		})

		t.Run("unhealthy", func(t *testing.T) {
			goRoutineHealthThreshold := *th.App.Config().ServiceSettings.GoroutineHealthThreshold
			defer func() {
				th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoroutineHealthThreshold = goRoutineHealthThreshold })
			}()

			th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.GoroutineHealthThreshold = 10 })
			status, resp, err := client.GetPing(context.Background())
			require.Error(t, err)
			CheckInternalErrorStatus(t, resp)
			assert.Equal(t, model.StatusUnhealthy, status)
		})
	}, "basic ping")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		t.Run("healthy", func(t *testing.T) {
			status, _, err := client.GetPingWithServerStatus(context.Background())
			require.NoError(t, err)
			assert.Equal(t, model.StatusOk, status)
		})
	}, "with server status")

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		err := th.App.ReloadConfig()
		require.NoError(t, err)
		respMap, resp, err := client.GetPingWithOptions(context.Background(), model.SystemPingOptions{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_, ok := respMap["TestFeatureFlag"]
		assert.Equal(t, false, ok)

		// Run the environment variable override code to test
		os.Setenv("MM_FEATUREFLAGS_TESTFEATURE", "testvalueunique")
		defer os.Unsetenv("MM_FEATUREFLAGS_TESTFEATURE")
		err = th.App.ReloadConfig()
		require.NoError(t, err)

		respMap, resp, err = client.GetPingWithOptions(context.Background(), model.SystemPingOptions{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_, ok = respMap["TestFeatureFlag"]
		assert.Equal(t, true, ok)
	}, "ping feature flag test")

	t.Run("ping root_status test", func(t *testing.T) {
		respMap, resp, err := th.SystemAdminClient.GetPingWithOptions(context.Background(), model.SystemPingOptions{FullStatus: true})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_, ok := respMap["root_status"]
		assert.Equal(t, true, ok)
	})

	t.Run("ping root_status test with client user", func(t *testing.T) {
		respMap, resp, err := th.Client.GetPingWithOptions(context.Background(), model.SystemPingOptions{FullStatus: true})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		_, ok := respMap["root_status"]
		assert.Equal(t, false, ok)
	})

	th.TestForAllClients(t, func(t *testing.T, client *model.Client4) {
		err := th.App.ReloadConfig()
		require.NoError(t, err)
		resp, err := client.DoAPIGet(context.Background(), "/system/ping?device_id=platform:id", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		var respMap map[string]any
		err = json.NewDecoder(resp.Body).Decode(&respMap)
		require.NoError(t, err)
		assert.Equal(t, "unknown", respMap["CanReceiveNotifications"]) // Unrecognized platform
	}, "ping and test push notification")
}

func TestGetAudits(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	audits, _, err := th.SystemAdminClient.GetAudits(context.Background(), 0, 100, "")
	require.NoError(t, err)
	require.NotEmpty(t, audits, "should not be empty")

	audits, _, err = th.SystemAdminClient.GetAudits(context.Background(), 0, 1, "")
	require.NoError(t, err)
	require.Len(t, audits, 1, "should only be 1")

	audits, _, err = th.SystemAdminClient.GetAudits(context.Background(), 1, 1, "")
	require.NoError(t, err)
	require.Len(t, audits, 1, "should only be 1")

	_, _, err = th.SystemAdminClient.GetAudits(context.Background(), -1, -1, "")
	require.NoError(t, err)

	_, resp, err := client.GetAudits(context.Background(), 0, 100, "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetAudits(context.Background(), 0, 100, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestEmailTest(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	dir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	es := model.EmailSettings{}
	es.SetDefaults(false)

	es.SMTPServer = model.NewPointer("")
	es.SMTPPort = model.NewPointer("")
	es.SMTPPassword = model.NewPointer("")
	es.FeedbackName = model.NewPointer("")
	es.FeedbackEmail = model.NewPointer("some-addr@test.com")
	es.ReplyToAddress = model.NewPointer("some-addr@test.com")
	es.ConnectionSecurity = model.NewPointer("")
	es.SMTPUsername = model.NewPointer("")
	es.EnableSMTPAuth = model.NewPointer(false)
	es.SkipServerCertificateVerification = model.NewPointer(true)
	es.SendEmailNotifications = model.NewPointer(false)
	es.SMTPServerTimeout = model.NewPointer(15)

	config := model.Config{
		ServiceSettings: model.ServiceSettings{
			SiteURL: model.NewPointer(""),
		},
		EmailSettings: es,
		FileSettings: model.FileSettings{
			DriverName: model.NewPointer(model.ImageDriverLocal),
			Directory:  model.NewPointer(dir),
		},
	}

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.TestEmail(context.Background(), &config)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.TestEmail(context.Background(), &config)
		CheckErrorID(t, err, "api.admin.test_email.missing_server")
		CheckBadRequestStatus(t, resp)

		inbucket_host := os.Getenv("CI_INBUCKET_HOST")
		if inbucket_host == "" {
			inbucket_host = "localhost"
		}

		inbucket_port := os.Getenv("CI_INBUCKET_SMTP_PORT")
		if inbucket_port == "" {
			inbucket_port = "10025"
		}

		*config.EmailSettings.SMTPServer = inbucket_host
		*config.EmailSettings.SMTPPort = inbucket_port
		resp, err = th.SystemAdminClient.TestEmail(context.Background(), &config)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.TestEmail(context.Background(), &config)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("empty email settings", func(t *testing.T) {
		config.EmailSettings = model.EmailSettings{}
		resp, err := th.SystemAdminClient.TestEmail(context.Background(), &config)
		require.Error(t, err)
		CheckErrorID(t, err, "api.file.test_connection_email_settings_nil.app_error")
		CheckBadRequestStatus(t, resp)
	})
}

func TestGenerateSupportPacket(t *testing.T) {
	th := Setup(t)
	th.LoginSystemManager()
	defer th.TearDown()

	t.Run("system admin and local client can generate Support Packet", func(t *testing.T) {
		l := model.NewTestLicense()
		th.App.Srv().SetLicense(l)

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
			file, filename, _, err := th.SystemAdminClient.GenerateSupportPacket(context.Background())
			require.NoError(t, err)

			assert.Contains(t, filename, "mm_support_packet_My_awesome_Company_")

			d, err := io.ReadAll(file)
			require.NoError(t, err)
			assert.NotZero(t, len(d))
		})
	})

	t.Run("Using system admin and local client but with RestrictSystemAdmin true", func(t *testing.T) {
		originalRestrictSystemAdminVal := *th.App.Config().ExperimentalSettings.RestrictSystemAdmin
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		defer func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ExperimentalSettings.RestrictSystemAdmin = originalRestrictSystemAdminVal
			})
		}()

		th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
			_, _, resp, err := th.SystemAdminClient.GenerateSupportPacket(context.Background())
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("As a system role, not system admin", func(t *testing.T) {
		_, _, resp, err := th.SystemManagerClient.GenerateSupportPacket(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("As a Regular User", func(t *testing.T) {
		_, _, resp, err := th.Client.GenerateSupportPacket(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Server with no License", func(t *testing.T) {
		_, err := th.SystemAdminClient.RemoveLicenseFile(context.Background())
		require.NoError(t, err)

		_, _, resp, err := th.SystemAdminClient.GenerateSupportPacket(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestSupportPacketFileName(t *testing.T) {
	tests := map[string]struct {
		now          time.Time
		customerName string
		expected     string
	}{
		"standard case": {
			now:          time.Date(2023, 11, 12, 13, 14, 15, 0, time.UTC),
			customerName: "TestCustomer",
			expected:     "mm_support_packet_TestCustomer_2023-11-12T13-14.zip",
		},
		"customer name with special characters": {
			now:          time.Date(2023, 11, 12, 13, 14, 15, 0, time.UTC),
			customerName: "Test/Customer:Name",
			expected:     "mm_support_packet_Test_Customer_Name_2023-11-12T13-14.zip",
		},
		"empty customer name": {
			now:          time.Date(2023, 10, 10, 10, 10, 10, 0, time.UTC),
			customerName: "",
			expected:     "mm_support_packet__2023-10-10T10-10.zip",
		},
	}

	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			result := supportPacketFileName(tt.now, tt.customerName)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestSiteURLTest(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/valid/api/v4/system/ping") {
			w.WriteHeader(200)
		} else {
			w.WriteHeader(400)
		}
	}))
	defer ts.Close()

	validSiteURL := ts.URL + "/valid"
	invalidSiteURL := ts.URL + "/invalid"

	t.Run("as system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.TestSiteURL(context.Background(), "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = th.SystemAdminClient.TestSiteURL(context.Background(), invalidSiteURL)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)

		resp, err = th.SystemAdminClient.TestSiteURL(context.Background(), validSiteURL)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.TestSiteURL(context.Background(), validSiteURL)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := client.TestSiteURL(context.Background(), validSiteURL)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestDatabaseRecycle(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.DatabaseRecycle(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		_, err := th.SystemAdminClient.DatabaseRecycle(context.Background())
		require.NoError(t, err)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.DatabaseRecycle(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestInvalidateCaches(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.InvalidateCaches(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		_, err := th.SystemAdminClient.InvalidateCaches(context.Background())
		require.NoError(t, err)
	})

	t.Run("as restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })

		resp, err := th.SystemAdminClient.InvalidateCaches(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetLogs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	for i := 0; i < 20; i++ {
		th.TestLogger.Info(strconv.Itoa(i))
	}

	err := th.TestLogger.Flush()
	require.NoError(t, err, "failed to flush log")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		logs, _, err2 := c.GetLogs(context.Background(), 0, 10)
		require.NoError(t, err2)
		require.Len(t, logs, 10)

		for i := 10; i < 20; i++ {
			assert.Containsf(t, logs[i-10], fmt.Sprintf(`"msg":"%d"`, i), "Log line doesn't contain correct message")
		}

		logs, _, err = c.GetLogs(context.Background(), 1, 10)
		require.NoError(t, err)
		require.Len(t, logs, 10)

		logs, _, err = c.GetLogs(context.Background(), -1, -1)
		require.NoError(t, err)
		require.NotEmpty(t, logs, "should not be empty")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		_, resp, err2 := th.Client.GetLogs(context.Background(), 0, 10)
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})

	_, resp, err := th.Client.GetLogs(context.Background(), 0, 10)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = th.Client.GetLogs(context.Background(), 0, 10)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestDownloadLogs(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	for i := 0; i < 20; i++ {
		th.TestLogger.Info(strconv.Itoa(i))
	}
	err := th.TestLogger.Flush()
	require.NoError(t, err, "failed to flush log")

	t.Run("Download Logs as system admin", func(t *testing.T) {
		resData, resp, err2 := th.SystemAdminClient.DownloadLogs(context.Background())
		require.NoError(t, err2)

		require.Equal(t, "text/plain", resp.Header.Get("Content-Type"))
		require.Contains(t, resp.Header.Get("Content-Disposition"), "attachment;filename=\"mattermost.log\"")

		bodyString := string(resData)
		for i := 0; i < 20; i++ {
			assert.Contains(t, bodyString, fmt.Sprintf(`"msg":"%d"`, i))
		}
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExperimentalSettings.RestrictSystemAdmin = true })
		_, resp, err2 := th.Client.DownloadLogs(context.Background())
		require.Error(t, err2)
		CheckForbiddenStatus(t, resp)
	})

	_, resp, err := th.Client.DownloadLogs(context.Background())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = th.Client.DownloadLogs(context.Background())
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestPostLog(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	enableDev := *th.App.Config().ServiceSettings.EnableDeveloper
	defer func() {
		*th.App.Config().ServiceSettings.EnableDeveloper = enableDev
	}()
	*th.App.Config().ServiceSettings.EnableDeveloper = true

	message := make(map[string]string)
	message["level"] = "ERROR"
	message["message"] = "this is a test"

	_, _, err := client.PostLog(context.Background(), message)
	require.NoError(t, err)

	*th.App.Config().ServiceSettings.EnableDeveloper = false

	_, _, err = client.PostLog(context.Background(), message)
	require.NoError(t, err)

	*th.App.Config().ServiceSettings.EnableDeveloper = true

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, _, err = client.PostLog(context.Background(), message)
	require.NoError(t, err)

	*th.App.Config().ServiceSettings.EnableDeveloper = false

	_, resp, err := client.PostLog(context.Background(), message)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	logMessage, _, err := th.SystemAdminClient.PostLog(context.Background(), message)
	require.NoError(t, err)
	require.NotEmpty(t, logMessage, "should return the log message")
}

func TestGetAnalyticsOld(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	rows, resp, err := client.GetAnalyticsOld(context.Background(), "", "")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	require.Nil(t, rows, "should be nil")
	rows, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "", "")
	require.NoError(t, err)

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

	_, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "post_counts_day", "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "user_counts_with_posts_day", "")
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "extra_counts", "")
	require.NoError(t, err)

	rows, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "", th.BasicTeam.Id)
	require.NoError(t, err)

	for _, row := range rows {
		if row.Name == "inactive_user_count" {
			assert.Equal(t, float64(-1), row.Value, "inactive user count should be -1 when team specified")
		}
	}

	rows2, _, err := th.SystemAdminClient.GetAnalyticsOld(context.Background(), "standard", "")
	require.NoError(t, err)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(0), rows2[5].Value)

	WebSocketClient, err := th.CreateWebSocketClient()
	require.NoError(t, err)
	time.Sleep(100 * time.Millisecond)
	rows2, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "standard", "")
	require.NoError(t, err)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(1), rows2[5].Value)

	WebSocketClient.Close()

	rows2, _, err = th.SystemAdminClient.GetAnalyticsOld(context.Background(), "standard", "")
	require.NoError(t, err)
	assert.Equal(t, "total_websocket_connections", rows2[5].Name)
	assert.Equal(t, float64(0), rows2[5].Value)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetAnalyticsOld(context.Background(), "", th.BasicTeam.Id)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestS3TestConnection(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	s3Host := os.Getenv("CI_MINIO_HOST")
	if s3Host == "" {
		s3Host = "localhost"
	}

	s3Port := os.Getenv("CI_MINIO_PORT")
	if s3Port == "" {
		s3Port = "9000"
	}

	s3Endpoint := fmt.Sprintf("%s:%s", s3Host, s3Port)

	fs := model.FileSettings{}
	fs.SetDefaults(false)

	fs.DriverName = model.NewPointer(model.ImageDriverS3)
	fs.AmazonS3AccessKeyId = model.NewPointer(model.MinioAccessKey)
	fs.AmazonS3SecretAccessKey = model.NewPointer(model.MinioSecretKey)
	fs.AmazonS3Bucket = model.NewPointer("")
	fs.AmazonS3Endpoint = model.NewPointer(s3Endpoint)
	fs.AmazonS3Region = model.NewPointer("")
	fs.AmazonS3PathPrefix = model.NewPointer("")
	fs.AmazonS3SSL = model.NewPointer(false)

	config := model.Config{
		FileSettings: fs,
	}

	t.Run("as system user", func(t *testing.T) {
		resp, err := client.TestS3Connection(context.Background(), &config)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		CheckBadRequestStatus(t, resp)
		CheckErrorMessage(t, err, "S3 Bucket is required")
		// If this fails, check the test configuration to ensure minio is setup with the
		// `mattermost-test` bucket defined by model.MINIO_BUCKET.
		*config.FileSettings.AmazonS3Bucket = model.MinioBucket
		config.FileSettings.AmazonS3PathPrefix = model.NewPointer("")
		*config.FileSettings.AmazonS3Region = "us-east-1"
		resp, err = th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		config.FileSettings.AmazonS3Region = model.NewPointer("")
		resp, err = th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		config.FileSettings.AmazonS3Bucket = model.NewPointer("Wrong_bucket")
		resp, err = th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		CheckInternalErrorStatus(t, resp)
		CheckErrorID(t, err, "api.file.test_connection_s3_bucket_does_not_exist.app_error")

		*config.FileSettings.AmazonS3Bucket = "shouldnotcreatenewbucket"
		resp, err = th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		CheckInternalErrorStatus(t, resp)
		CheckErrorID(t, err, "api.file.test_connection_s3_bucket_does_not_exist.app_error")
	})

	t.Run("with incorrect credentials", func(t *testing.T) {
		configCopy := config
		*configCopy.FileSettings.AmazonS3AccessKeyId = "invalidaccesskey"
		resp, err := th.SystemAdminClient.TestS3Connection(context.Background(), &configCopy)
		CheckInternalErrorStatus(t, resp)
		CheckErrorID(t, err, "api.file.test_connection_s3_auth.app_error")
	})

	t.Run("empty file settings", func(t *testing.T) {
		config.FileSettings = model.FileSettings{}
		resp, err := th.SystemAdminClient.TestS3Connection(context.Background(), &config)
		require.Error(t, err)
		CheckErrorID(t, err, "api.file.test_connection_s3_settings_nil.app_error")
		CheckBadRequestStatus(t, resp)
	})
}

func TestSupportedTimezones(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	supportedTimezonesFromConfig := th.App.Timezones().GetSupported()
	supportedTimezones, _, err := client.GetSupportedTimezone(context.Background())

	require.NoError(t, err)
	assert.Equal(t, supportedTimezonesFromConfig, supportedTimezones)
}

func TestRedirectLocation(t *testing.T) {
	expected := "https://mattermost.com/wp-content/themes/mattermostv2/img/logo-light.svg"

	testServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.Header().Set("Location", expected)
		res.WriteHeader(http.StatusFound)
		_, err := res.Write([]byte("body"))
		require.NoError(t, err)
	}))
	defer func() { testServer.Close() }()

	mockBitlyLink := testServer.URL

	th := Setup(t)
	defer th.TearDown()
	client := th.Client
	enableLinkPreviews := *th.App.Config().ServiceSettings.EnableLinkPreviews
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableLinkPreviews = enableLinkPreviews })
	}()

	*th.App.Config().ServiceSettings.EnableLinkPreviews = true
	*th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"

	_, _, err := th.SystemAdminClient.GetRedirectLocation(context.Background(), "https://mattermost.com/", "")
	require.NoError(t, err)

	_, resp, err := th.SystemAdminClient.GetRedirectLocation(context.Background(), "", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	actual, _, err := th.SystemAdminClient.GetRedirectLocation(context.Background(), mockBitlyLink, "")
	require.NoError(t, err)
	assert.Equal(t, expected, actual)

	// Check cached value
	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), mockBitlyLink, "")
	require.NoError(t, err)
	assert.Equal(t, expected, actual)

	*th.App.Config().ServiceSettings.EnableLinkPreviews = false
	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), "https://mattermost.com/", "")
	require.NoError(t, err)
	assert.Equal(t, actual, "")

	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), "", "")
	require.NoError(t, err)
	assert.Equal(t, actual, "")

	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), mockBitlyLink, "")
	require.NoError(t, err)
	assert.Equal(t, actual, "")

	_, err = client.Logout(context.Background())
	require.NoError(t, err)

	_, resp, err = client.GetRedirectLocation(context.Background(), "", "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	// Check that too-long redirect locations are ignored
	*th.App.Config().ServiceSettings.EnableLinkPreviews = true
	urlPrefix := "https://example.co"
	almostTooLongUrl := urlPrefix + strings.Repeat("a", 2100-len(urlPrefix))
	testServer2 := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.Header().Set("Location", almostTooLongUrl)
		res.WriteHeader(http.StatusFound)
		_, err = res.Write([]byte("body"))
		require.NoError(t, err)
	}))
	defer func() { testServer2.Close() }()

	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), testServer2.URL, "")
	require.NoError(t, err)
	assert.Equal(t, almostTooLongUrl, actual)

	tooLongUrl := urlPrefix + strings.Repeat("a", 2101-len(urlPrefix))
	testServer3 := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.Header().Set("Location", tooLongUrl)
		res.WriteHeader(http.StatusFound)
		_, err = res.Write([]byte("body"))
		require.NoError(t, err)
	}))
	defer func() { testServer3.Close() }()

	actual, _, err = th.SystemAdminClient.GetRedirectLocation(context.Background(), testServer3.URL, "")
	require.NoError(t, err)
	assert.Equal(t, "", actual)
}

func TestSetServerBusy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	const secs = 30

	t.Run("as system user", func(t *testing.T) {
		resp, err := th.Client.SetServerBusy(context.Background(), secs)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.False(t, th.App.Srv().Platform().Busy.IsBusy(), "server should not be marked busy")
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, err := c.SetServerBusy(context.Background(), secs)
		require.NoError(t, err)
		require.True(t, th.App.Srv().Platform().Busy.IsBusy(), "server should be marked busy")
	}, "as system admin")
}

func TestSetServerBusyInvalidParam(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		params := []int{-1, 0, MaxServerBusySeconds + 1}
		for _, p := range params {
			resp, err := c.SetServerBusy(context.Background(), p)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
			require.False(t, th.App.Srv().Platform().Busy.IsBusy(), "server should not be marked busy due to invalid param ", p)
		}
	}, "as system admin, invalid param")
}

func TestClearServerBusy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().Platform().Busy.Set(time.Second * 30)
	t.Run("as system user", func(t *testing.T) {
		resp, err := th.Client.ClearServerBusy(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.True(t, th.App.Srv().Platform().Busy.IsBusy(), "server should be marked busy")
	})

	th.App.Srv().Platform().Busy.Set(time.Second * 30)
	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, err := c.ClearServerBusy(context.Background())
		require.NoError(t, err)
		require.False(t, th.App.Srv().Platform().Busy.IsBusy(), "server should not be marked busy")
	}, "as system admin")
}

func TestGetServerBusy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().Platform().Busy.Set(time.Second * 30)

	t.Run("as system user", func(t *testing.T) {
		_, resp, err := th.Client.GetServerBusy(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		sbs, _, err := c.GetServerBusy(context.Background())
		expires := time.Unix(sbs.Expires, 0)
		require.NoError(t, err)
		require.Greater(t, expires.Unix(), time.Now().Unix())
	}, "as system admin")
}

func TestServerBusy503(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	th.App.Srv().Platform().Busy.Set(time.Second * 30)

	t.Run("search users while busy", func(t *testing.T) {
		us := &model.UserSearch{Term: "test"}
		_, resp, err := th.SystemAdminClient.SearchUsers(context.Background(), us)
		require.Error(t, err)
		CheckServiceUnavailableStatus(t, resp)
	})

	t.Run("search teams while busy", func(t *testing.T) {
		ts := &model.TeamSearch{}
		_, resp, err := th.SystemAdminClient.SearchTeams(context.Background(), ts)
		require.Error(t, err)
		CheckServiceUnavailableStatus(t, resp)
	})

	t.Run("search channels while busy", func(t *testing.T) {
		cs := &model.ChannelSearch{}
		_, resp, err := th.SystemAdminClient.SearchChannels(context.Background(), "foo", cs)
		require.Error(t, err)
		CheckServiceUnavailableStatus(t, resp)
	})

	t.Run("search archived channels while busy", func(t *testing.T) {
		cs := &model.ChannelSearch{}
		_, resp, err := th.SystemAdminClient.SearchArchivedChannels(context.Background(), "foo", cs)
		require.Error(t, err)
		CheckServiceUnavailableStatus(t, resp)
	})

	th.App.Srv().Platform().Busy.Clear()

	t.Run("search users while not busy", func(t *testing.T) {
		us := &model.UserSearch{Term: "test"}
		_, _, err := th.SystemAdminClient.SearchUsers(context.Background(), us)
		require.NoError(t, err)
	})
}

func TestPushNotificationAck(t *testing.T) {
	th := Setup(t).InitBasic()
	api, err := Init(th.Server)
	require.NoError(t, err)
	session, _ := th.App.GetSession(th.Client.AuthToken)
	defer th.TearDown()

	t.Run("should return error when the ack body is not passed", func(t *testing.T) {
		handler := api.APIHandler(pushNotificationAck)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/v4/notifications/ack", nil)
		req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)

		handler.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusBadRequest, resp.Code)
		assert.NotNil(t, resp.Body)
	})

	t.Run("should return error when the ack post is not authorized for the user", func(t *testing.T) {
		privateChannel := th.CreateChannelWithClient(th.SystemAdminClient, model.ChannelTypePrivate)
		privatePost := th.CreatePostWithClient(th.SystemAdminClient, privateChannel)

		handler := api.APIHandler(pushNotificationAck)
		resp := httptest.NewRecorder()
		req := httptest.NewRequest("POST", "/api/v4/notifications/ack", nil)
		req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)
		req.Body = io.NopCloser(bytes.NewBufferString(fmt.Sprintf(`{"id":"123", "is_id_loaded":true, "post_id":"%s", "type": "%s"}`, privatePost.Id, model.PushTypeMessage)))

		handler.ServeHTTP(resp, req)
		assert.Equal(t, http.StatusForbidden, resp.Code)
		assert.NotNil(t, resp.Body)
	})

	ttcc := []struct {
		name          string
		propValue     string
		platform      string
		expectedValue string
	}{
		{
			name:          "should set session prop device notification disabled to false if an ack is sent from iOS",
			propValue:     "true",
			platform:      "ios",
			expectedValue: "false",
		},
		{
			name:          "no change if empty",
			propValue:     "",
			platform:      "ios",
			expectedValue: "",
		},
		{
			name:          "no change if false",
			propValue:     "false",
			platform:      "ios",
			expectedValue: "false",
		},
		{
			name:          "no change on Android",
			propValue:     "true",
			platform:      "android",
			expectedValue: "true",
		},
	}
	for _, tc := range ttcc {
		t.Run(tc.name, func(t *testing.T) {
			defer func() {
				session.AddProp(model.SessionPropDeviceNotificationDisabled, "")
				err = th.Server.Store().Session().UpdateProps(session)
				require.NoError(t, err)
				th.App.ClearSessionCacheForUser(session.UserId)
			}()

			session.AddProp(model.SessionPropDeviceNotificationDisabled, tc.propValue)
			err := th.Server.Store().Session().UpdateProps(session)
			th.App.ClearSessionCacheForUser(session.UserId)
			assert.NoError(t, err)

			handler := api.APIHandler(pushNotificationAck)
			resp := httptest.NewRecorder()
			req := httptest.NewRequest("POST", "/api/v4/notifications/ack", nil)
			req.Header.Set(model.HeaderAuth, "Bearer "+session.Token)
			req.Body = io.NopCloser(bytes.NewBufferString(fmt.Sprintf(`{"id":"123", "is_id_loaded":true, "platform": "%s", "post_id":"%s", "type": "%s"}`, tc.platform, th.BasicPost.Id, model.PushTypeMessage)))

			handler.ServeHTTP(resp, req)
			updatedSession, _ := th.App.GetSession(th.Client.AuthToken)
			assert.Equal(t, tc.expectedValue, updatedSession.Props[model.SessionPropDeviceNotificationDisabled])
			storeSession, _ := th.Server.Store().Session().Get(th.Context, session.Id)
			assert.Equal(t, tc.expectedValue, storeSession.Props[model.SessionPropDeviceNotificationDisabled])
		})
	}
}

func TestCompleteOnboarding(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	path, _ := fileutils.FindDir("tests")
	signatureFilename := "testplugin2.tar.gz.sig"
	signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
	require.NoError(t, err)
	sigFile, err := io.ReadAll(signatureFileReader)
	require.NoError(t, err)
	pluginSignature := base64.StdEncoding.EncodeToString(sigFile)

	tarData, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz"))
	require.NoError(t, err)
	pluginServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		_, err = res.Write(tarData)
		require.NoError(t, err)
	}))
	defer pluginServer.Close()

	samplePlugins := []*model.MarketplacePlugin{{
		BaseMarketplacePlugin: &model.BaseMarketplacePlugin{
			HomepageURL: "https://example.com/mattermost/mattermost-plugin-nps",
			IconData:    "https://example.com/icon.svg",
			DownloadURL: pluginServer.URL,
			Manifest: &model.Manifest{
				Id:               "testplugin2",
				Name:             "testplugin2",
				Description:      "a second plugin",
				Version:          "1.2.3",
				MinServerVersion: "",
			},
			Signature: pluginSignature,
		},
		InstalledVersion: "",
	}}

	marketplaceServer := httptest.NewServer(http.HandlerFunc(func(res http.ResponseWriter, req *http.Request) {
		res.WriteHeader(http.StatusOK)
		var data []byte
		data, err = json.Marshal(samplePlugins)
		require.NoError(t, err)
		_, err = res.Write(data)
		require.NoError(t, err)
	}))
	defer marketplaceServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableMarketplace = false
		*cfg.PluginSettings.EnableRemoteMarketplace = true
		*cfg.PluginSettings.MarketplaceURL = marketplaceServer.URL
		*cfg.PluginSettings.AllowInsecureDownloadURL = true
	})

	key, err := os.Open(filepath.Join(path, "development-private-key.asc"))
	require.NoError(t, err)
	appErr := th.App.AddPublicKey("pub_key", key)
	require.Nil(t, appErr)

	t.Cleanup(func() {
		appErr = th.App.DeletePublicKey("pub_key")
		require.Nil(t, appErr)
	})

	req := &model.CompleteOnboardingRequest{
		InstallPlugins: []string{"testplugin2"},
		Organization:   "my-org",
	}

	t.Run("as a regular user", func(t *testing.T) {
		resp, err := th.Client.CompleteOnboarding(context.Background(), req)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as a system admin", func(t *testing.T) {
		resp, err := th.SystemAdminClient.CompleteOnboarding(context.Background(), req)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		t.Cleanup(func() {
			resp, err = th.SystemAdminClient.RemovePlugin(context.Background(), "testplugin2")
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		received := make(chan struct{})

		go func() {
			for {
				installedPlugins, resp, err := th.SystemAdminClient.GetPlugins(context.Background())
				if err != nil || resp.StatusCode != http.StatusOK {
					time.Sleep(500 * time.Millisecond)
					continue
				}

				for _, p := range installedPlugins.Active {
					if p.Id == "testplugin2" {
						received <- struct{}{}
						return
					}
				}
				time.Sleep(500 * time.Millisecond)
			}
		}()

		select {
		case <-received:
			break
		case <-time.After(15 * time.Second):
			require.Fail(t, "timed out waiting testplugin2 to be installed and enabled ")
		}
	})

	t.Run("as a system admin when plugins are disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.Enable = false
		})

		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.Enable = true
			})
		})

		resp, err := th.SystemAdminClient.CompleteOnboarding(context.Background(), req)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestGetAppliedSchemaMigrations(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("as a regular user", func(t *testing.T) {
		_, resp, err := th.Client.GetAppliedSchemaMigrations(context.Background())
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("as a system manager role", func(t *testing.T) {
		_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.SystemManagerRoleId, false)
		require.Nil(t, appErr)
		th.LoginBasic2()

		_, resp, err := th.Client.GetAppliedSchemaMigrations(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		_, resp, err := c.GetAppliedSchemaMigrations(context.Background())
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})
}

func TestCheckHasNilFields(t *testing.T) {
	t.Run("check if the empty struct has nil fields", func(t *testing.T) {
		var s model.FileSettings
		res := checkHasNilFields(&s)
		require.True(t, res)
	})

	t.Run("check if the struct has any nil fields", func(t *testing.T) {
		s := model.FileSettings{
			DriverName: model.NewPointer(model.ImageDriverLocal),
		}
		res := checkHasNilFields(&s)
		require.True(t, res)
	})

	t.Run("struct has all fields set", func(t *testing.T) {
		var s model.FileSettings
		s.SetDefaults(false)
		res := checkHasNilFields(&s)
		require.False(t, res)
	})

	t.Run("embedded struct, with nil fields", func(t *testing.T) {
		type myStr struct {
			Name    string
			Surname *string
		}
		s := myStr{}
		res := checkHasNilFields(&s)
		require.True(t, res)
	})
}
