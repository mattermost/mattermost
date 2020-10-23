// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils/fileutils"

	"github.com/stretchr/testify/require"
)

func TestListImports(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	testsDir, _ := fileutils.FindDir("tests")
	require.NotEmpty(t, testsDir)

	uploadNewImport := func(c *model.Client4, t *testing.T) string {
		file, err := os.Open(testsDir + "/import_test.zip")
		require.Nil(t, err)

		info, err := file.Stat()
		require.Nil(t, err)

		us := &model.UploadSession{
			Filename: info.Name(),
			FileSize: info.Size(),
			Type:     model.UploadTypeImport,
		}

		u, resp := c.CreateUpload(us)
		require.Nil(t, resp.Error)
		require.NotNil(t, u)

		finfo, resp := c.UploadData(u.Id, file)
		require.Nil(t, resp.Error)
		require.NotNil(t, finfo)

		return u.Id
	}

	t.Run("no permissions", func(t *testing.T) {
		imports, resp := th.Client.ListImports()
		require.Error(t, resp.Error)
		require.Equal(t, "api.context.permissions.app_error", resp.Error.Id)
		require.Nil(t, imports)
	})

	t.Run("no imports", func(t *testing.T) {
		imports, resp := th.SystemAdminClient.ListImports()
		require.Nil(t, resp.Error)
		require.Empty(t, imports)
	})

	t.Run("expected imports", func(t *testing.T) {
		id := uploadNewImport(th.SystemAdminClient, t)
		id2 := uploadNewImport(th.SystemAdminClient, t)

		imports, resp := th.SystemAdminClient.ListImports()
		require.Nil(t, resp.Error)
		require.NotEmpty(t, imports)
		require.Len(t, imports, 2)
		require.Contains(t, imports, id+"_import_test.zip")
		require.Contains(t, imports, id2+"_import_test.zip")
	})

	t.Run("change import directory", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ImportSettings.Directory = "import_new" })
		defer th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ImportSettings.Directory = "import" })

		imports, resp := th.SystemAdminClient.ListImports()
		require.Nil(t, resp.Error)
		require.Empty(t, imports)

		id := uploadNewImport(th.SystemAdminClient, t)
		imports, resp = th.SystemAdminClient.ListImports()
		require.Nil(t, resp.Error)
		require.NotEmpty(t, imports)
		require.Len(t, imports, 1)
		require.Equal(t, id+"_import_test.zip", imports[0])
	})
}
