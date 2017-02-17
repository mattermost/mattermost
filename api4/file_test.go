// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestUploadFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	user := th.BasicUser
	channel := th.BasicChannel

	var uploadInfo *model.FileInfo
	var data []byte
	var err error
	if data, err = readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else if fileResp, resp := Client.UploadFile(data, channel.Id, "test.png"); resp.Error != nil {
		t.Fatal(resp.Error)
	} else if len(fileResp.FileInfos) != 1 {
		t.Fatal("should've returned a single file infos")
	} else {
		uploadInfo = fileResp.FileInfos[0]
	}

	// The returned file info from the upload call will be missing some fields that will be stored in the database
	if uploadInfo.CreatorId != user.Id {
		t.Fatal("file should be assigned to user")
	} else if uploadInfo.PostId != "" {
		t.Fatal("file shouldn't have a post")
	} else if uploadInfo.Path != "" {
		t.Fatal("file path should not be set on returned info")
	} else if uploadInfo.ThumbnailPath != "" {
		t.Fatal("file thumbnail path should not be set on returned info")
	} else if uploadInfo.PreviewPath != "" {
		t.Fatal("file preview path should not be set on returned info")
	}

	var info *model.FileInfo
	if result := <-app.Srv.Store.FileInfo().Get(uploadInfo.Id); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		info = result.Data.(*model.FileInfo)
	}

	if info.Id != uploadInfo.Id {
		t.Fatal("file id from response should match one stored in database")
	} else if info.CreatorId != user.Id {
		t.Fatal("file should be assigned to user")
	} else if info.PostId != "" {
		t.Fatal("file shouldn't have a post")
	} else if info.Path == "" {
		t.Fatal("file path should be set in database")
	} else if info.ThumbnailPath == "" {
		t.Fatal("file thumbnail path should be set in database")
	} else if info.PreviewPath == "" {
		t.Fatal("file preview path should be set in database")
	}

	// This also makes sure that the relative path provided above is sanitized out
	expectedPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test.png", FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.Path != expectedPath {
		t.Logf("file is saved in %v", info.Path)
		t.Fatalf("file should've been saved in %v", expectedPath)
	}

	expectedThumbnailPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test_thumb.jpg", FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.ThumbnailPath != expectedThumbnailPath {
		t.Logf("file thumbnail is saved in %v", info.ThumbnailPath)
		t.Fatalf("file thumbnail should've been saved in %v", expectedThumbnailPath)
	}

	expectedPreviewPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test_preview.jpg", FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.PreviewPath != expectedPreviewPath {
		t.Logf("file preview is saved in %v", info.PreviewPath)
		t.Fatalf("file preview should've been saved in %v", expectedPreviewPath)
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if err := cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}

	_, resp := Client.UploadFile(data, model.NewId(), "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadFile(data, channel.Id, "test.png")
	CheckNoError(t, resp)
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	fileId := ""
	var sent []byte
	var err error
	if sent, err = readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(sent, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	data, resp := Client.GetFile(fileId)
	CheckNoError(t, resp)

	if data == nil || len(data) == 0 {
		t.Fatal("should not be empty")
	}

	for i := range data {
		if data[i] != sent[i] {
			t.Fatal("received file didn't match sent one")
		}
	}

	_, resp = Client.GetFile("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFile(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFile(fileId)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.GetFile(fileId)
	CheckNoError(t, resp)
}
