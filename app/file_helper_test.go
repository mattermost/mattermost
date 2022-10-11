// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFilterInaccessibleFiles(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: "2",
	})

	defer th.TearDown()

	var getFileWithCreateAt = func(at int64) *model.FileInfo {
		return &model.FileInfo{CreateAt: at}
	}

	t.Run("ascending order returns correct files", func(t *testing.T) {
		fileList := &model.FileInfoList{
			FileInfos: map[string]*model.FileInfo{
				"file_a": getFileWithCreateAt(0),
				"file_b": getFileWithCreateAt(1),
				"file_c": getFileWithCreateAt(2),
				"file_d": getFileWithCreateAt(3),
				"file_e": getFileWithCreateAt(4),
			},
			Order: []string{"file_a", "file_b", "file_c", "file_d", "file_e"},
		}
		appErr := th.App.filterInaccessibleFiles(th.Context, fileList, filterFileOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.FileInfo{
			"file_c": getFileWithCreateAt(2),
			"file_d": getFileWithCreateAt(3),
			"file_e": getFileWithCreateAt(4),
		}, fileList.FileInfos)

		assert.Equal(t, []string{
			"file_c",
			"file_d",
			"file_e",
		}, fileList.Order)
		assert.Equal(t, int64(1), fileList.FirstInaccessibleFileTime)
	})

	t.Run("descending order returns correct files", func(t *testing.T) {
		fileList := &model.FileInfoList{
			FileInfos: map[string]*model.FileInfo{
				"file_a": getFileWithCreateAt(0),
				"file_b": getFileWithCreateAt(1),
				"file_c": getFileWithCreateAt(2),
				"file_d": getFileWithCreateAt(3),
				"file_e": getFileWithCreateAt(4),
			},
			Order: []string{"file_e", "file_d", "file_c", "file_b", "file_a"},
		}
		appErr := th.App.filterInaccessibleFiles(th.Context, fileList, filterFileOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.FileInfo{
			"file_c": getFileWithCreateAt(2),
			"file_d": getFileWithCreateAt(3),
			"file_e": getFileWithCreateAt(4),
		}, fileList.FileInfos)

		assert.Equal(t, []string{
			"file_e",
			"file_d",
			"file_c",
		}, fileList.Order)

		assert.Equal(t, int64(1), fileList.FirstInaccessibleFileTime)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		fileList := &model.FileInfoList{
			FileInfos: map[string]*model.FileInfo{
				"file_a": getFileWithCreateAt(0),
				"file_b": getFileWithCreateAt(1),
				"file_c": getFileWithCreateAt(2),
				"file_d": getFileWithCreateAt(3),
				"file_e": getFileWithCreateAt(4),
			},
			Order: []string{"file_e", "file_b", "file_a", "file_d", "file_c"},
		}
		appErr := th.App.filterInaccessibleFiles(th.Context, fileList, filterFileOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)

		assert.Equal(t, map[string]*model.FileInfo{
			"file_c": getFileWithCreateAt(2),
			"file_d": getFileWithCreateAt(3),
			"file_e": getFileWithCreateAt(4),
		}, fileList.FileInfos)

		assert.Equal(t, []string{
			"file_e",
			"file_d",
			"file_c",
		}, fileList.Order)
	})
}

func TestGetFilteredAccessibleFiles(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: "2",
	})

	defer th.TearDown()

	var getFileWithCreateAt = func(at int64) *model.FileInfo {
		return &model.FileInfo{CreateAt: at}
	}

	t.Run("ascending order returns correct files", func(t *testing.T) {
		files := []*model.FileInfo{getFileWithCreateAt(0), getFileWithCreateAt(1), getFileWithCreateAt(2), getFileWithCreateAt(3), getFileWithCreateAt(4)}
		filteredFiles, firstInaccessibleFileTime, appErr := th.App.getFilteredAccessibleFiles(th.Context, files, filterFileOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)
		assert.Equal(t, []*model.FileInfo{getFileWithCreateAt(2), getFileWithCreateAt(3), getFileWithCreateAt(4)}, filteredFiles)
		assert.Equal(t, int64(1), firstInaccessibleFileTime)
	})

	t.Run("descending order returns correct files", func(t *testing.T) {
		files := []*model.FileInfo{getFileWithCreateAt(4), getFileWithCreateAt(3), getFileWithCreateAt(2), getFileWithCreateAt(1), getFileWithCreateAt(0)}
		filteredFiles, firstInaccessibleFileTime, appErr := th.App.getFilteredAccessibleFiles(th.Context, files, filterFileOptions{assumeSortedCreatedAt: true})

		require.Nil(t, appErr)
		assert.Equal(t, []*model.FileInfo{getFileWithCreateAt(4), getFileWithCreateAt(3), getFileWithCreateAt(2)}, filteredFiles)
		assert.Equal(t, int64(1), firstInaccessibleFileTime)
	})

	t.Run("handles mixed create at ordering correctly if correct options given", func(t *testing.T) {
		files := []*model.FileInfo{getFileWithCreateAt(4), getFileWithCreateAt(1), getFileWithCreateAt(0), getFileWithCreateAt(3), getFileWithCreateAt(2)}
		filteredFiles, _, appErr := th.App.getFilteredAccessibleFiles(th.Context, files, filterFileOptions{assumeSortedCreatedAt: false})

		require.Nil(t, appErr)
		assert.Equal(t, []*model.FileInfo{getFileWithCreateAt(4), getFileWithCreateAt(3), getFileWithCreateAt(2)}, filteredFiles)
	})
}

func TestIsInaccessibleFile(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: "2",
	})

	defer th.TearDown()

	file := &model.FileInfo{CreateAt: 3}
	firstInaccessibleFileTime, appErr := th.App.isInaccessibleFile(th.Context, file)
	require.Nil(t, appErr)
	assert.Equal(t, int64(0), firstInaccessibleFileTime)

	file = &model.FileInfo{CreateAt: 1}
	firstInaccessibleFileTime, appErr = th.App.isInaccessibleFile(th.Context, file)
	require.Nil(t, appErr)
	assert.Equal(t, int64(1), firstInaccessibleFileTime)
}

func TestRemoveInaccessibleContentFromFilesSlice(t *testing.T) {
	th := Setup(t)
	th.App.Srv().SetLicense(model.NewTestLicense("cloud"))
	th.App.Srv().Store().System().Save(&model.System{
		Name:  model.SystemLastAccessibleFileTime,
		Value: "2",
	})

	defer th.TearDown()

	var getFileWithCreateAt = func(at int64) *model.FileInfo {
		return &model.FileInfo{CreateAt: at}
	}

	files := []*model.FileInfo{getFileWithCreateAt(4), getFileWithCreateAt(1), getFileWithCreateAt(0), getFileWithCreateAt(3), getFileWithCreateAt(2)}

	_, appErr := th.App.removeInaccessibleContentFromFilesSlice(th.Context, files)

	require.Nil(t, appErr)
	assert.Len(t, files, len(files))
	for _, file := range files {
		// Inaccessible files are archived
		if file.CreateAt < 2 {
			assert.True(t, file.Archived)
		} else {
			assert.False(t, file.Archived)
		}
	}
}
