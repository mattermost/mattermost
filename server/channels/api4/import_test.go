// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"os"
	"path"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestListImports(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	require.NotEmpty(t, testsDir)

	uploadNewImport := func(c *model.Client4, t *testing.T) string {
		file, err := os.Open(testsDir + "/import_test.zip")
		require.NoError(t, err)

		info, err := file.Stat()
		require.NoError(t, err)

		us := &model.UploadSession{
			Filename: info.Name(),
			FileSize: info.Size(),
			Type:     model.UploadTypeImport,
		}

		if c == th.LocalClient {
			us.UserId = model.UploadNoUserID
		}

		u, _, err := c.CreateUpload(context.Background(), us)
		require.NoError(t, err)
		require.NotNil(t, u)

		finfo, _, err := c.UploadData(context.Background(), u.Id, file)
		require.NoError(t, err)
		require.NotNil(t, finfo)

		return u.Id
	}

	t.Run("no permissions", func(t *testing.T) {
		imports, _, err := th.Client.ListImports(context.Background())
		require.Error(t, err)
		CheckErrorID(t, err, "api.context.permissions.app_error")
		require.Nil(t, imports)
	})

	dataDir, found := fileutils.FindDir("data")
	require.True(t, found)

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		imports, _, err := c.ListImports(context.Background())
		require.NoError(t, err)
		require.Empty(t, imports)
	}, "no imports")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		id := uploadNewImport(c, t)
		id2 := uploadNewImport(c, t)

		importDir := filepath.Join(dataDir, "import")
		f, err := os.Create(filepath.Join(importDir, "import.zip.tmp"))
		require.NoError(t, err)
		f.Close()

		imports, _, err := c.ListImports(context.Background())
		require.NoError(t, err)
		require.NotEmpty(t, imports)
		require.Len(t, imports, 2)
		require.Contains(t, imports, id+"_import_test.zip")
		require.Contains(t, imports, id2+"_import_test.zip")

		require.NoError(t, os.RemoveAll(importDir))
	}, "expected imports")

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, c *model.Client4) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ImportSettings.Directory = "import_new" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ImportSettings.Directory = "import" })

		importDir := filepath.Join(dataDir, "import_new")

		imports, _, err := c.ListImports(context.Background())
		require.NoError(t, err)
		require.Empty(t, imports)

		id := uploadNewImport(c, t)
		imports, _, err = c.ListImports(context.Background())
		require.NoError(t, err)
		require.NotEmpty(t, imports)
		require.Len(t, imports, 1)
		require.Equal(t, id+"_import_test.zip", imports[0])

		require.NoError(t, os.RemoveAll(importDir))
	}, "change import directory")
}

func TestImportInLocalMode(t *testing.T) {
	th := SetupWithServerOptions(t, []app.Option{app.RunEssentialJobs})
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	require.NotEmpty(t, testsDir)

	job := &model.Job{
		Type: model.JobTypeImportProcess,
		Data: map[string]string{
			"import_file": path.Join(testsDir, "import_test.zip"),
			"local_mode":  "true",
		},
	}

	received, _, err := th.SystemAdminClient.CreateJob(context.Background(), job)
	require.NoError(t, err)
	defer th.App.Srv().Store().Job().Delete(received.Id)

	cnt1, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{UsersPostsOnly: true})
	require.NoError(t, err)

	var appErr *model.AppError
	for !(received.Status == model.JobStatusSuccess || received.Status == model.JobStatusError) {
		received, appErr = th.App.GetJob(th.Context, received.Id)
		require.Nil(t, appErr)
		time.Sleep(5 * time.Second)
		th.Context.Logger().Debug("Job status", mlog.String("status", received.Status))
	}

	require.Equal(t, model.JobStatusSuccess, received.Status)

	cnt2, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{UsersPostsOnly: true})
	require.NoError(t, err)
	// Just a sanity check to ensure new posts are actually added in the system.
	require.Greater(t, cnt2, cnt1)
}
