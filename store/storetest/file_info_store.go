// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFileInfoStore(t *testing.T, ss store.Store) {
	t.Run("FileInfoSaveGet", func(t *testing.T) { testFileInfoSaveGet(t, ss) })
	t.Run("FileInfoSaveGetByPath", func(t *testing.T) { testFileInfoSaveGetByPath(t, ss) })
	t.Run("FileInfoGetForPost", func(t *testing.T) { testFileInfoGetForPost(t, ss) })
	t.Run("FileInfoGetForUser", func(t *testing.T) { testFileInfoGetForUser(t, ss) })
	t.Run("FileInfoAttachToPost", func(t *testing.T) { testFileInfoAttachToPost(t, ss) })
	t.Run("FileInfoDeleteForPost", func(t *testing.T) { testFileInfoDeleteForPost(t, ss) })
	t.Run("FileInfoPermanentDelete", func(t *testing.T) { testFileInfoPermanentDelete(t, ss) })
	t.Run("FileInfoPermanentDeleteBatch", func(t *testing.T) { testFileInfoPermanentDeleteBatch(t, ss) })
	t.Run("FileInfoPermanentDeleteByUser", func(t *testing.T) { testFileInfoPermanentDeleteByUser(t, ss) })
}

func testFileInfoSaveGet(t *testing.T, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
	}

	if result := <-ss.FileInfo().Save(info); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.(*model.FileInfo); len(returned.Id) == 0 {
		t.Fatal("should've assigned an id to FileInfo")
	} else {
		info = returned
	}
	defer func() {
		<-ss.FileInfo().PermanentDelete(info.Id)
	}()

	if result := <-ss.FileInfo().Get(info.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.(*model.FileInfo); returned.Id != info.Id {
		t.Log(info)
		t.Log(returned)
		t.Fatal("should've returned correct FileInfo")
	}

	info2 := store.Must(ss.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})).(*model.FileInfo)

	if result := <-ss.FileInfo().Get(info2.Id); result.Err == nil {
		t.Fatal("shouldn't have gotten deleted file")
	}
	defer func() {
		<-ss.FileInfo().PermanentDelete(info2.Id)
	}()
}

func testFileInfoSaveGetByPath(t *testing.T, ss store.Store) {
	info := &model.FileInfo{
		CreatorId: model.NewId(),
		Path:      fmt.Sprintf("%v/file.txt", model.NewId()),
	}

	if result := <-ss.FileInfo().Save(info); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.(*model.FileInfo); len(returned.Id) == 0 {
		t.Fatal("should've assigned an id to FileInfo")
	} else {
		info = returned
	}
	defer func() {
		<-ss.FileInfo().PermanentDelete(info.Id)
	}()

	if result := <-ss.FileInfo().GetByPath(info.Path); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.(*model.FileInfo); returned.Id != info.Id {
		t.Log(info)
		t.Log(returned)
		t.Fatal("should've returned correct FileInfo")
	}

	info2 := store.Must(ss.FileInfo().Save(&model.FileInfo{
		CreatorId: model.NewId(),
		Path:      "file.txt",
		DeleteAt:  123,
	})).(*model.FileInfo)

	if result := <-ss.FileInfo().GetByPath(info2.Id); result.Err == nil {
		t.Fatal("shouldn't have gotten deleted file")
	}
	defer func() {
		<-ss.FileInfo().PermanentDelete(info2.Id)
	}()
}

func testFileInfoGetForPost(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		infos[i] = store.Must(ss.FileInfo().Save(info)).(*model.FileInfo)
		defer func(id string) {
			<-ss.FileInfo().PermanentDelete(id)
		}(infos[i].Id)
	}

	if result := <-ss.FileInfo().GetForPost(postId, true, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.FileInfo); len(returned) != 2 {
		t.Fatal("should've returned exactly 2 file infos")
	}

	if result := <-ss.FileInfo().GetForPost(postId, false, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.FileInfo); len(returned) != 2 {
		t.Fatal("should've returned exactly 2 file infos")
	}

	if result := <-ss.FileInfo().GetForPost(postId, true, true); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.FileInfo); len(returned) != 2 {
		t.Fatal("should've returned exactly 2 file infos")
	}
}

func testFileInfoGetForUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	userId2 := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId2,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		infos[i] = store.Must(ss.FileInfo().Save(info)).(*model.FileInfo)
		defer func(id string) {
			<-ss.FileInfo().PermanentDelete(id)
		}(infos[i].Id)
	}

	if result := <-ss.FileInfo().GetForUser(userId); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.FileInfo); len(returned) != 3 {
		t.Fatal("should've returned exactly 3 file infos")
	}

	if result := <-ss.FileInfo().GetForUser(userId2); result.Err != nil {
		t.Fatal(result.Err)
	} else if returned := result.Data.([]*model.FileInfo); len(returned) != 1 {
		t.Fatal("should've returned exactly 1 file infos")
	}
}

func testFileInfoAttachToPost(t *testing.T, ss store.Store) {
	t.Run("should attach files", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info1 := store.Must(ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file.txt",
		})).(*model.FileInfo)
		info2 := store.Must(ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file2.txt",
		})).(*model.FileInfo)

		require.Equal(t, "", info1.PostId)
		require.Equal(t, "", info2.PostId)

		result := <-ss.FileInfo().AttachToPost(info1.Id, postId, userId)
		assert.Nil(t, result.Err)

		result = <-ss.FileInfo().AttachToPost(info2.Id, postId, userId)
		assert.Nil(t, result.Err)

		result = <-ss.FileInfo().GetForPost(postId, true, false)
		assert.Nil(t, result.Err)

		data := result.Data.([]*model.FileInfo)

		assert.Len(t, data, 2)
		assert.True(t, data[0].Id == info1.Id || data[0].Id == info2.Id)
		assert.True(t, data[1].Id == info1.Id || data[1].Id == info2.Id)
	})

	t.Run("should not attach files to multiple posts", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info := store.Must(ss.FileInfo().Save(&model.FileInfo{
			CreatorId: userId,
			Path:      "file.txt",
		})).(*model.FileInfo)

		require.Equal(t, "", info.PostId)

		result := <-ss.FileInfo().AttachToPost(info.Id, model.NewId(), userId)
		assert.Nil(t, result.Err)

		result = <-ss.FileInfo().AttachToPost(info.Id, postId, userId)
		assert.NotNil(t, result.Err)
	})

	t.Run("should not attach files owned from a different user", func(t *testing.T) {
		userId := model.NewId()
		postId := model.NewId()

		info := store.Must(ss.FileInfo().Save(&model.FileInfo{
			CreatorId: model.NewId(),
			Path:      "file.txt",
		})).(*model.FileInfo)

		require.Equal(t, "", info.PostId)

		result := <-ss.FileInfo().AttachToPost(info.Id, postId, userId)

		assert.NotNil(t, result.Err)
	})
}

func testFileInfoDeleteForPost(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	infos := []*model.FileInfo{
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
		},
		{
			PostId:    postId,
			CreatorId: userId,
			Path:      "file.txt",
			DeleteAt:  123,
		},
		{
			PostId:    model.NewId(),
			CreatorId: userId,
			Path:      "file.txt",
		},
	}

	for i, info := range infos {
		infos[i] = store.Must(ss.FileInfo().Save(info)).(*model.FileInfo)
		defer func(id string) {
			<-ss.FileInfo().PermanentDelete(id)
		}(infos[i].Id)
	}

	if result := <-ss.FileInfo().DeleteForPost(postId); result.Err != nil {
		t.Fatal(result.Err)
	}

	if infos := store.Must(ss.FileInfo().GetForPost(postId, true, false)).([]*model.FileInfo); len(infos) != 0 {
		t.Fatal("shouldn't have returned any file infos")
	}
}

func testFileInfoPermanentDelete(t *testing.T, ss store.Store) {
	info := store.Must(ss.FileInfo().Save(&model.FileInfo{
		PostId:    model.NewId(),
		CreatorId: model.NewId(),
		Path:      "file.txt",
	})).(*model.FileInfo)

	if result := <-ss.FileInfo().PermanentDelete(info.Id); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func testFileInfoPermanentDeleteBatch(t *testing.T, ss store.Store) {
	postId := model.NewId()

	store.Must(ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1000,
	}))

	store.Must(ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  1200,
	}))

	store.Must(ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: model.NewId(),
		Path:      "file.txt",
		CreateAt:  2000,
	}))

	if result := <-ss.FileInfo().GetForPost(postId, true, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if len(result.Data.([]*model.FileInfo)) != 3 {
		t.Fatal("Expected 3 fileInfos")
	}

	store.Must(ss.FileInfo().PermanentDeleteBatch(1500, 1000))

	if result := <-ss.FileInfo().GetForPost(postId, true, false); result.Err != nil {
		t.Fatal(result.Err)
	} else if len(result.Data.([]*model.FileInfo)) != 1 {
		t.Fatal("Expected 3 fileInfos")
	}
}

func testFileInfoPermanentDeleteByUser(t *testing.T, ss store.Store) {
	userId := model.NewId()
	postId := model.NewId()

	store.Must(ss.FileInfo().Save(&model.FileInfo{
		PostId:    postId,
		CreatorId: userId,
		Path:      "file.txt",
	}))

	if result := <-ss.FileInfo().PermanentDeleteByUser(userId); result.Err != nil {
		t.Fatal(result.Err)
	}
}
