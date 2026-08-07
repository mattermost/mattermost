// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"github.com/stretchr/testify/require"
)

func TestListExports(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("no permissions", func(t *testing.T) {
		exports, _, err := th.Client.ListExports(context.Background())
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
		require.Nil(t, exports)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		exports, _, err := c.ListExports(context.Background())
		require.NoError(t, err)
		require.Empty(t, exports)
	}, "no exports")

	dataDir := *th.App.Config().FileSettings.Directory

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		exportDir := filepath.Join(dataDir, *th.App.Config().ExportSettings.Directory)
		err := os.Mkdir(exportDir, 0700)
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(exportDir)
			require.NoError(t, err)
		}()

		f, err := os.Create(filepath.Join(exportDir, "export.zip"))
		require.NoError(t, err)
		err = f.Close()
		require.NoError(t, err)

		exports, _, err := c.ListExports(context.Background())
		require.NoError(t, err)
		require.Len(t, exports, 1)
		require.Equal(t, exports[0], "export.zip")
	}, "expected exports")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		originalExportDir := *th.App.Config().ExportSettings.Directory
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ExportSettings.Directory = "new" })
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExportSettings.Directory = originalExportDir
		})

		exportDir := filepath.Join(dataDir, *th.App.Config().ExportSettings.Directory)
		err := os.Mkdir(exportDir, 0700)
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(exportDir)
			require.NoError(t, err)
		}()

		exports, _, err := c.ListExports(context.Background())
		require.NoError(t, err)
		require.Empty(t, exports)

		f, err := os.Create(filepath.Join(exportDir, "export.zip"))
		require.NoError(t, err)
		err = f.Close()
		require.NoError(t, err)

		exports, _, err = c.ListExports(context.Background())
		require.NoError(t, err)
		require.Len(t, exports, 1)
		require.Equal(t, "export.zip", exports[0])
	}, "change export directory")
}

func TestDeleteExport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("no permissions", func(t *testing.T) {
		_, err := th.Client.DeleteExport(context.Background(), "export.zip")
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	dataDir := *th.App.Config().FileSettings.Directory
	exportDir := filepath.Join(dataDir, *th.App.Config().ExportSettings.Directory)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		err := os.Mkdir(exportDir, 0700)
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(exportDir)
			require.NoError(t, err)
		}()
		exportName := "export.zip"
		f, err := os.Create(filepath.Join(exportDir, exportName))
		require.NoError(t, err)
		err = f.Close()
		require.NoError(t, err)

		exports, _, err := c.ListExports(context.Background())
		require.NoError(t, err)
		require.Len(t, exports, 1)
		require.Equal(t, exports[0], exportName)

		_, err = c.DeleteExport(context.Background(), exportName)
		require.NoError(t, err)

		exports, _, err = c.ListExports(context.Background())
		require.NoError(t, err)
		require.Empty(t, exports)

		// verify idempotence
		_, err = c.DeleteExport(context.Background(), exportName)
		require.NoError(t, err)
	}, "successfully delete export")
}

func TestDownloadExport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("no permissions", func(t *testing.T) {
		var buf bytes.Buffer
		n, _, err := th.Client.DownloadExport(context.Background(), "export.zip", &buf, 0)
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
		require.Zero(t, n)
	})

	dataDir := *th.App.Config().FileSettings.Directory
	exportDir := filepath.Join(dataDir, *th.App.Config().ExportSettings.Directory)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		var buf bytes.Buffer
		n, _, err := c.DownloadExport(context.Background(), "export.zip", &buf, 0)
		require.Error(t, err)
		CheckErrorID(t, err, "api.export.export_not_found.app_error")
		require.Zero(t, n)
	}, "not found")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		err := os.Mkdir(exportDir, 0700)
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(exportDir)
			require.NoError(t, err)
		}()

		data := randomBytes(t, 1024*1024)
		var buf bytes.Buffer
		exportName := "export.zip"
		err = os.WriteFile(filepath.Join(exportDir, exportName), data, 0600)
		require.NoError(t, err)

		n, _, err := c.DownloadExport(context.Background(), exportName, &buf, 0)
		require.NoError(t, err)
		require.Equal(t, len(data), int(n))
		require.Equal(t, data, buf.Bytes())
	}, "full download")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		err := os.Mkdir(exportDir, 0700)
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(exportDir)
			require.NoError(t, err)
		}()

		data := randomBytes(t, 1024*1024)
		var buf bytes.Buffer
		exportName := "export.zip"
		err = os.WriteFile(filepath.Join(exportDir, exportName), data, 0600)
		require.NoError(t, err)

		offset := 1024 * 512
		n, _, err := c.DownloadExport(context.Background(), exportName, &buf, int64(offset))
		require.NoError(t, err)
		require.Equal(t, len(data)-offset, int(n))
		require.Equal(t, data[offset:], buf.Bytes())
	}, "download with offset")
}

func BenchmarkDownloadExport(b *testing.B) {
	th := Setup(b)

	dataDir := *th.App.Config().FileSettings.Directory
	exportDir := filepath.Join(dataDir, *th.App.Config().ExportSettings.Directory)

	err := os.Mkdir(exportDir, 0700)
	require.NoError(b, err)
	defer func() {
		err = os.RemoveAll(exportDir)
		require.NoError(b, err)
	}()

	exportName := "export.zip"
	f, err := os.Create(filepath.Join(exportDir, exportName))
	require.NoError(b, err)
	err = f.Close()
	require.NoError(b, err)

	err = os.Truncate(filepath.Join(exportDir, exportName), 1024*1024*1024)
	require.NoError(b, err)

	for i := 0; b.Loop(); i++ {
		outFilePath := filepath.Join(dataDir, fmt.Sprintf("export%d.zip", i))
		outFile, err := os.Create(outFilePath)
		require.NoError(b, err)
		_, _, err = th.SystemAdminClient.DownloadExport(context.Background(), exportName, outFile, 0)
		require.NoError(b, err)
		err = outFile.Close()
		require.NoError(b, err)
		err = os.Remove(outFilePath)
		require.NoError(b, err)
	}
}

func TestGeneratePresignedURL(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("no permissions", func(t *testing.T) {
		th := Setup(t)
		_, _, err := th.Client.GeneratePresignedURL(context.Background(), "export.zip")
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
	})

	t.Run("blocked when not running in Cloud", func(t *testing.T) {
		th := Setup(t)
		th.App.Srv().SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.FileSettings.EnableCloudExportDirectDownload = true
		})

		_, resp, err := th.SystemAdminClient.GeneratePresignedURL(context.Background(), "export.zip")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "app.eport.generate_presigned_url.direct_download.app_error")
	})

	t.Run("blocked when disabled", func(t *testing.T) {
		th := Setup(t)
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.FileSettings.EnableCloudExportDirectDownload = false
		})

		_, resp, err := th.SystemAdminClient.GeneratePresignedURL(context.Background(), "export.zip")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "app.eport.generate_presigned_url.direct_download.app_error")
	})

	t.Run("passes gate when Cloud and enabled, then requires a dedicated export store", func(t *testing.T) {
		th := Setup(t)
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.FileSettings.EnableCloudExportDirectDownload = true
			*cfg.FileSettings.DedicatedExportStore = false
		})

		_, _, err := th.SystemAdminClient.GeneratePresignedURL(context.Background(), "export.zip")
		require.Error(t, err)
		CheckErrorID(t, err, "app.eport.generate_presigned_url.config.app_error")
	})

	// The full happy path against a real presign-capable (S3/minio) export store: a
	// Cloud server with the setting enabled and a dedicated export store returns a
	// working presigned URL over the API. Skipped when minio isn't reachable.
	t.Run("succeeds against a presign-capable export store", func(t *testing.T) {
		s3Host := os.Getenv("CI_MINIO_HOST")
		if s3Host == "" {
			s3Host = "localhost"
		}
		s3Port := os.Getenv("CI_MINIO_PORT")
		if s3Port == "" {
			s3Port = "9000"
		}
		s3Endpoint := net.JoinHostPort(s3Host, s3Port)

		conn, err := net.DialTimeout("tcp", s3Endpoint, 2*time.Second)
		if err != nil {
			t.Skipf("minio not available at %s: %v", s3Endpoint, err)
		}
		conn.Close()

		// Use a fresh bucket per run so MakeBucket is unambiguous.
		bucket := model.NewId()

		// The dedicated export filestore is built once at startup, so the export-store
		// configuration must be applied before the server starts, not via UpdateConfig.
		th := SetupConfig(t, func(cfg *model.Config) {
			*cfg.FileSettings.EnableCloudExportDirectDownload = true
			*cfg.FileSettings.DedicatedExportStore = true
			*cfg.FileSettings.ExportDriverName = model.ImageDriverS3
			*cfg.FileSettings.ExportAmazonS3AccessKeyId = model.MinioAccessKey
			*cfg.FileSettings.ExportAmazonS3SecretAccessKey = model.MinioSecretKey
			*cfg.FileSettings.ExportAmazonS3Bucket = bucket
			*cfg.FileSettings.ExportAmazonS3Endpoint = s3Endpoint
			*cfg.FileSettings.ExportAmazonS3Region = ""
			*cfg.FileSettings.ExportAmazonS3SSL = false
		})
		th.App.Srv().SetLicense(model.NewTestLicense("cloud"))

		backend, ok := th.App.ExportFileBackend().(*filestore.S3FileBackend)
		require.True(t, ok, "expected a dedicated S3 export backend")
		require.NoError(t, backend.MakeBucket())

		exportName := "job_export.zip"
		payload := []byte("export-payload")
		_, appErr := th.App.WriteExportFile(bytes.NewReader(payload), filepath.Join(*th.App.Config().ExportSettings.Directory, exportName))
		require.Nil(t, appErr)

		resp, _, err := th.SystemAdminClient.GeneratePresignedURL(context.Background(), exportName)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.NotEmpty(t, resp.URL)

		// The presigned URL should serve the exported file directly.
		httpResp, err := http.Get(resp.URL)
		require.NoError(t, err)
		defer httpResp.Body.Close()
		require.Equal(t, http.StatusOK, httpResp.StatusCode)
		body, err := io.ReadAll(httpResp.Body)
		require.NoError(t, err)
		require.Equal(t, payload, body)
	})
}
