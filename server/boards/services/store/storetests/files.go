// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/store"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
	mm_model "github.com/mattermost/mattermost-server/v6/model"

	"github.com/stretchr/testify/require"
)

func StoreTestFileStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	sqlStore, tearDown := setup(t)
	defer tearDown()

	t.Run("should save and retrieve fileinfo", func(t *testing.T) {
		fileInfo := &mm_model.FileInfo{
			Id:        "file_info_1",
			CreateAt:  utils.GetMillis(),
			Name:      "Dunder Mifflin Sales Report 2022",
			Extension: ".sales",
			Size:      112233,
			DeleteAt:  0,
		}

		err := sqlStore.SaveFileInfo(fileInfo)
		require.NoError(t, err)

		retrievedFileInfo, err := sqlStore.GetFileInfo("file_info_1")
		require.NoError(t, err)
		require.Equal(t, "file_info_1", retrievedFileInfo.Id)
		require.Equal(t, "Dunder Mifflin Sales Report 2022", retrievedFileInfo.Name)
		require.Equal(t, ".sales", retrievedFileInfo.Extension)
		require.Equal(t, int64(112233), retrievedFileInfo.Size)
		require.Equal(t, int64(0), retrievedFileInfo.DeleteAt)
		require.False(t, retrievedFileInfo.Archived)
	})

	t.Run("should return an error on not found", func(t *testing.T) {
		fileInfo, err := sqlStore.GetFileInfo("nonexistent")
		require.Error(t, err)
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.Nil(t, fileInfo)
	})
}
