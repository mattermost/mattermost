// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"

	s3 "github.com/minio/minio-go"
	"github.com/minio/minio-go/pkg/credentials"
)

func TestUploadFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Logf("skipping because no file driver is enabled")
		return
	}

	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	channel := th.BasicChannel

	var uploadInfo *model.FileInfo
	var data []byte
	var err error
	if data, err = readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else if resp, err := Client.UploadPostAttachment(data, channel.Id, "test.png"); err != nil {
		t.Fatal(err)
	} else if len(resp.FileInfos) != 1 {
		t.Fatal("should've returned a single file infos")
	} else {
		uploadInfo = resp.FileInfos[0]
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
	if result := <-th.App.Srv.Store.FileInfo().Get(uploadInfo.Id); result.Err != nil {
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

	date := time.Now().Format("20060102")

	// This also makes sure that the relative path provided above is sanitized out
	expectedPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test.png", date, team.Id, channel.Id, user.Id, info.Id)
	if info.Path != expectedPath {
		t.Logf("file is saved in %v", info.Path)
		t.Fatalf("file should've been saved in %v", expectedPath)
	}

	expectedThumbnailPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_thumb.jpg", date, team.Id, channel.Id, user.Id, info.Id)
	if info.ThumbnailPath != expectedThumbnailPath {
		t.Logf("file thumbnail is saved in %v", info.ThumbnailPath)
		t.Fatalf("file thumbnail should've been saved in %v", expectedThumbnailPath)
	}

	expectedPreviewPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_preview.jpg", date, team.Id, channel.Id, user.Id, info.Id)
	if info.PreviewPath != expectedPreviewPath {
		t.Logf("file preview is saved in %v", info.PreviewPath)
		t.Fatalf("file preview should've been saved in %v", expectedPreviewPath)
	}

	if _, err := Client.UploadPostAttachment(data, model.NewId(), "test.png"); err == nil || err.StatusCode != http.StatusForbidden {
		t.Fatal("should have failed - bad channel id")
	}

	if _, err := Client.UploadPostAttachment(data, "../../junk", "test.png"); err == nil || err.StatusCode != http.StatusForbidden {
		t.Fatal("should have failed - bad channel id")
	}

	if _, err := th.SystemAdminClient.UploadPostAttachment(data, model.NewId(), "test.png"); err == nil || err.StatusCode != http.StatusForbidden {
		t.Fatal("should have failed - bad channel id")
	}

	if _, err := th.SystemAdminClient.UploadPostAttachment(data, "../../junk", "test.png"); err == nil || err.StatusCode != http.StatusForbidden {
		t.Fatal("should have failed - bad channel id")
	}

	enableFileAttachments := *th.App.Config().FileSettings.EnableFileAttachments
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = enableFileAttachments })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })

	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else if _, err = Client.UploadPostAttachment(data, channel.Id, "test.png"); err == nil {
		t.Fatal("should have errored")
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if err := cleanupTestFile(info, &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetFileInfo(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	user := th.BasicUser
	channel := th.BasicChannel

	var fileId string
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	info, err := Client.GetFileInfo(fileId)
	if err != nil {
		t.Fatal(err)
	} else if info.Id != fileId {
		t.Fatal("got incorrect file")
	} else if info.CreatorId != user.Id {
		t.Fatal("file should be assigned to user")
	} else if info.PostId != "" {
		t.Fatal("file shouldn't have a post")
	} else if info.Path != "" {
		t.Fatal("file path shouldn't have been returned to client")
	} else if info.ThumbnailPath != "" {
		t.Fatal("file thumbnail path shouldn't have been returned to client")
	} else if info.PreviewPath != "" {
		t.Fatal("file preview path shouldn't have been returned to client")
	} else if info.MimeType != "image/png" {
		t.Fatal("mime type should've been image/png")
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	// Other user shouldn't be able to get file info for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetFileInfo(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file info before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	// Other user shouldn't be able to get file info for this file if they're not in the channel for it
	if _, err := Client.GetFileInfo(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file info when not in channel")
	}

	Client.Must(Client.JoinChannel(channel.Id))

	// Other user should now be able to get file info
	if info2, err := Client.GetFileInfo(fileId); err != nil {
		t.Fatal(err)
	} else if info2.Id != fileId {
		t.Fatal("other user got incorrect file")
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if body, err := Client.GetFile(fileId); err != nil {
		t.Fatal(err)
	} else {
		received, err := ioutil.ReadAll(body)
		if err != nil {
			t.Fatal(err)
		} else if len(received) != len(data) {
			t.Fatal("received file should be the same size as the sent one")
		}

		for i := range data {
			if data[i] != received[i] {
				t.Fatal("received file didn't match sent one")
			}
		}

		body.Close()
	}

	// Other user shouldn't be able to get file for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetFile(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	// Other user shouldn't be able to get file for this file if they're not in the channel for it
	if _, err := Client.GetFile(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file when not in channel")
	}

	Client.Must(Client.JoinChannel(channel.Id))

	// Other user should now be able to get file
	if body, err := Client.GetFile(fileId); err != nil {
		t.Fatal(err)
	} else {
		received, err := ioutil.ReadAll(body)
		if err != nil {
			t.Fatal(err)
		} else if len(received) != len(data) {
			t.Fatal("received file should be the same size as the sent one")
		}

		for i := range data {
			if data[i] != received[i] {
				t.Fatal("received file didn't match sent one")
			}
		}

		body.Close()
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetFileThumbnail(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if body, err := Client.GetFileThumbnail(fileId); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	// Other user shouldn't be able to get thumbnail for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetFileThumbnail(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	// Other user shouldn't be able to get thumbnail for this file if they're not in the channel for it
	if _, err := Client.GetFileThumbnail(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file when not in channel")
	}

	Client.Must(Client.JoinChannel(channel.Id))

	// Other user should now be able to get thumbnail
	if body, err := Client.GetFileThumbnail(fileId); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetFilePreview(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if body, err := Client.GetFilePreview(fileId); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	// Other user shouldn't be able to get preview for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetFilePreview(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	// Other user shouldn't be able to get preview for this file if they're not in the channel for it
	if _, err := Client.GetFilePreview(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file when not in channel")
	}

	Client.Must(Client.JoinChannel(channel.Id))

	// Other user should now be able to get preview
	if body, err := Client.GetFilePreview(fileId); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetPublicFile(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	enablePublicLink := th.App.Config().FileSettings.EnablePublicLink
	publicLinkSalt := *th.App.Config().FileSettings.PublicLinkSalt
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = enablePublicLink })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = publicLinkSalt })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewId() })

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	link := Client.MustGeneric(Client.GetPublicLink(fileId)).(string)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if resp, err := http.Get(link); err != nil || resp.StatusCode != http.StatusOK {
		t.Log(link)
		t.Fatal("failed to get image with public link", err)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link without hash", resp.Status)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = false })
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewId() })

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestGetPublicFileOld(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	enablePublicLink := th.App.Config().FileSettings.EnablePublicLink
	publicLinkSalt := *th.App.Config().FileSettings.PublicLinkSalt
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = enablePublicLink })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = publicLinkSalt })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewId() })

	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		//fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		fileId = model.NewId()
		fileInfo := model.FileInfo{
			Id:        fileId,
			CreateAt:  model.GetMillis(),
			CreatorId: th.BasicUser.Id,
			Path:      fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", th.BasicTeam.Id, channel.Id, th.BasicUser.Id, fileId, "test.png"),
		}
		store.Must(th.App.Srv.Store.FileInfo().Save(&fileInfo))
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", th.BasicTeam.Id, channel.Id, th.BasicUser.Id, fileId), "test.png")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	// reconstruct old style of link
	siteURL := fmt.Sprintf("http://localhost:%v", th.App.Srv.ListenAddr.Port)
	link := generatePublicLinkOld(siteURL, th.BasicTeam.Id, channel.Id, th.BasicUser.Id, fileId+"/test.png", *th.App.Config().FileSettings.PublicLinkSalt)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if resp, err := http.Get(link); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("failed to get image with public link err=%v resp=%v", err, resp)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link without hash", resp.Status)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = false })
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = model.NewId() })

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func generatePublicLinkOld(siteURL, teamId, channelId, userId, filename, salt string) string {
	hash := app.GeneratePublicLinkHash(filename, salt)
	return fmt.Sprintf("%s%s/public/files/get/%s/%s/%s/%s?h=%s", siteURL, model.API_URL_SUFFIX_V3, teamId, channelId, userId, filename, hash)
}

func TestGetPublicLink(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	enablePublicLink := th.App.Config().FileSettings.EnablePublicLink
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = enablePublicLink })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
	}

	if _, err := Client.GetPublicLink(fileId); err == nil {
		t.Fatal("should've failed to get public link before file is attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = false })

	if _, err := Client.GetPublicLink(fileId); err == nil {
		t.Fatal("should've failed to get public link when disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })

	if link, err := Client.GetPublicLink(fileId); err != nil {
		t.Fatal(err)
	} else if link == "" {
		t.Fatal("should've received public link")
	}

	// Other user shouldn't be able to get public link for this file if they're not in the channel for it
	th.LoginBasic2()

	if _, err := Client.GetPublicLink(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file when not in channel")
	}

	Client.Must(Client.JoinChannel(channel.Id))

	// Other user should now be able to get public link
	if link, err := Client.GetPublicLink(fileId); err != nil {
		t.Fatal(err)
	} else if link == "" {
		t.Fatal("should've received public link")
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if err := cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo), &th.App.Config().FileSettings); err != nil {
		t.Fatal(err)
	}
}

func TestMigrateFilenamesToFileInfos(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient

	user1 := th.BasicUser

	channel1 := Client.Must(Client.CreateChannel(&model.Channel{
		Name: model.NewId(),
		Type: model.CHANNEL_OPEN,
		// No TeamId set to simulate a direct channel
	})).Data.(*model.Channel)

	var fileId1 string
	var fileId2 string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId1 = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", th.BasicTeam.Id, channel1.Id, user1.Id, fileId1), "test.png")
		fileId2 = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", th.BasicTeam.Id, channel1.Id, user1.Id, fileId2), "test.png")
	}

	// Bypass the Client whenever possible since we're trying to simulate a pre-3.5 post
	post1 := store.Must(th.App.Srv.Store.Post().Save(&model.Post{
		UserId:    user1.Id,
		ChannelId: channel1.Id,
		Message:   "test",
		Filenames: []string{
			fmt.Sprintf("/%s/%s/%s/%s", channel1.Id, user1.Id, fileId1, "test.png"),
			fmt.Sprintf("/%s/%s/%s/%s", channel1.Id, user1.Id, fileId2, "test.png"),
			fmt.Sprintf("/%s/%s/%s/%s", channel1.Id, user1.Id, fileId2, "test.png"), // duplicate a filename to recreate a rare bug
		},
	})).(*model.Post)

	if post1.FileIds != nil && len(post1.FileIds) > 0 {
		t.Fatal("post shouldn't have file ids")
	} else if post1.Filenames == nil || len(post1.Filenames) != 3 {
		t.Fatal("post should have filenames")
	}

	// Indirectly call migrateFilenamesToFileInfos by calling Client.GetFileInfosForPost
	var infos []*model.FileInfo
	if infosResult, err := Client.GetFileInfosForPost(post1.ChannelId, post1.Id, ""); err != nil {
		t.Fatal(err)
	} else {
		infos = infosResult
	}

	if len(infos) != 2 {
		t.Log(infos)
		t.Fatal("should've had 2 infos after migration")
	} else if infos[0].Path != "" || infos[0].ThumbnailPath != "" || infos[0].PreviewPath != "" {
		t.Fatal("shouldn't return paths to client")
	}

	// Should be able to get files after migration
	if body, err := Client.GetFile(infos[0].Id); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	if body, err := Client.GetFile(infos[1].Id); err != nil {
		t.Fatal(err)
	} else {
		body.Close()
	}

	// Make sure we aren't generating a new set of FileInfos on a second call to GetFileInfosForPost
	if infos2 := Client.MustGeneric(Client.GetFileInfosForPost(post1.ChannelId, post1.Id, "")).([]*model.FileInfo); len(infos2) != len(infos) {
		t.Fatal("should've received the same 2 infos after second call")
	} else if (infos[0].Id != infos2[0].Id && infos[0].Id != infos2[1].Id) || (infos[1].Id != infos2[0].Id && infos[1].Id != infos2[1].Id) {
		t.Fatal("should've returned the exact same 2 infos after second call")
	}

	if result, err := Client.GetPost(post1.ChannelId, post1.Id, ""); err != nil {
		t.Fatal(err)
	} else if post := result.Data.(*model.PostList).Posts[post1.Id]; len(post.Filenames) != 0 {
		t.Fatal("post shouldn't have filenames")
	} else if len(post.FileIds) != 2 {
		t.Fatal("post should have 2 file ids")
	} else if (infos[0].Id != post.FileIds[0] && infos[0].Id != post.FileIds[1]) || (infos[1].Id != post.FileIds[0] && infos[1].Id != post.FileIds[1]) {
		t.Fatal("post file ids should match GetFileInfosForPost results")
	}
}

func uploadFileOld(t *testing.T, data []byte, dest string, filename string) {
	os.MkdirAll(dest, os.ModePerm)
	eFile, err := os.Create(dest + "/" + filename)
	if err != nil {
		t.Fatal(err)
	}
	defer eFile.Close()

	_, err = io.Copy(eFile, bytes.NewReader(data)) // first var shows number of bytes
	if err != nil {
		t.Fatal(err)
	}

	err = eFile.Sync()
	if err != nil {
		t.Fatal(err)
	}
}

func TestFindTeamIdForFilename(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient

	user1 := th.BasicUser

	team1 := th.BasicTeam
	team2 := th.CreateTeam(th.BasicClient)

	channel1 := th.BasicChannel

	Client.SetTeamId(team2.Id)
	channel2 := Client.Must(Client.CreateChannel(&model.Channel{
		Name: model.NewId(),
		Type: model.CHANNEL_OPEN,
		// No TeamId set to simulate a direct channel
	})).Data.(*model.Channel)
	Client.SetTeamId(team1.Id)

	var fileId1 string
	var fileId2 string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId1 = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", team1.Id, channel1.Id, user1.Id, fileId1), "test.png")

		Client.SetTeamId(team2.Id)
		fileId2 = Client.MustGeneric(Client.UploadPostAttachment(data, channel2.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", team2.Id, channel2.Id, user1.Id, fileId2), "test.png")
		Client.SetTeamId(team1.Id)
	}

	// Bypass the Client whenever possible since we're trying to simulate a pre-3.5 post
	post1 := store.Must(th.App.Srv.Store.Post().Save(&model.Post{
		UserId:    user1.Id,
		ChannelId: channel1.Id,
		Message:   "test",
		Filenames: []string{fmt.Sprintf("/%s/%s/%s/%s", channel1.Id, user1.Id, fileId1, "test.png")},
	})).(*model.Post)

	if teamId := th.App.FindTeamIdForFilename(post1, post1.Filenames[0]); teamId != team1.Id {
		t.Log(teamId)
		t.Fatal("file should've been found under team1")
	}

	Client.SetTeamId(team2.Id)
	post2 := store.Must(th.App.Srv.Store.Post().Save(&model.Post{
		UserId:    user1.Id,
		ChannelId: channel2.Id,
		Message:   "test",
		Filenames: []string{fmt.Sprintf("/%s/%s/%s/%s", channel2.Id, user1.Id, fileId2, "test.png")},
	})).(*model.Post)
	Client.SetTeamId(team1.Id)

	if teamId := th.App.FindTeamIdForFilename(post2, post2.Filenames[0]); teamId != team2.Id {
		t.Fatal("file should've been found under team2")
	}
}

func TestGetInfoForFilename(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient

	user1 := th.BasicUser

	team1 := th.BasicTeam

	channel1 := th.BasicChannel

	var fileId1 string
	var path string
	var thumbnailPath string
	var previewPath string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId1 = Client.MustGeneric(Client.UploadPostAttachment(data, channel1.Id, "test.png")).(*model.FileUploadResponse).FileInfos[0].Id
		uploadFileOld(t, data, fmt.Sprintf("data/teams/%s/channels/%s/users/%s/%s", team1.Id, channel1.Id, user1.Id, fileId1), "test.png")
		path = store.Must(th.App.Srv.Store.FileInfo().Get(fileId1)).(*model.FileInfo).Path
		thumbnailPath = store.Must(th.App.Srv.Store.FileInfo().Get(fileId1)).(*model.FileInfo).ThumbnailPath
		previewPath = store.Must(th.App.Srv.Store.FileInfo().Get(fileId1)).(*model.FileInfo).PreviewPath
	}

	// Bypass the Client whenever possible since we're trying to simulate a pre-3.5 post
	post1 := store.Must(th.App.Srv.Store.Post().Save(&model.Post{
		UserId:    user1.Id,
		ChannelId: channel1.Id,
		Message:   "test",
		Filenames: []string{fmt.Sprintf("/%s/%s/%s/%s", channel1.Id, user1.Id, fileId1, "test.png")},
	})).(*model.Post)

	date := time.Now().Format("20060102")

	if info := th.App.GetInfoForFilename(post1, team1.Id, post1.Filenames[0]); info == nil {
		t.Fatal("info shouldn't be nil")
	} else if info.Id == "" {
		t.Fatal("info.Id shouldn't be empty")
	} else if info.CreatorId != user1.Id {
		t.Fatal("incorrect user id")
	} else if info.PostId != post1.Id {
		t.Fatal("incorrect user id")
	} else if fmt.Sprintf("%s/%s", date, info.Path) != path {
		t.Fatal("incorrect path")
	} else if fmt.Sprintf("%s/%s", date, info.ThumbnailPath) != thumbnailPath {
		t.Fatal("incorrect thumbnail path")
	} else if fmt.Sprintf("%s/%s", date, info.PreviewPath) != previewPath {
		t.Fatal("incorrect preview path")
	} else if info.Name != "test.png" {
		t.Fatal("incorrect name")
	}
}

func readTestFile(name string) ([]byte, error) {
	path, _ := utils.FindDir("tests")
	file, err := os.Open(path + "/" + name)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &bytes.Buffer{}
	if _, err := io.Copy(data, file); err != nil {
		return nil, err
	} else {
		return data.Bytes(), nil
	}
}

// Similar to s3.New() but allows initialization of signature v2 or signature v4 client.
// If signV2 input is false, function always returns signature v4.
//
// Additionally this function also takes a user defined region, if set
// disables automatic region lookup.
func s3New(endpoint, accessKey, secretKey string, secure bool, signV2 bool, region string) (*s3.Client, error) {
	var creds *credentials.Credentials
	if signV2 {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV2)
	} else {
		creds = credentials.NewStatic(accessKey, secretKey, "", credentials.SignatureV4)
	}
	return s3.NewWithCredentials(endpoint, creds, secure, region)
}

func cleanupTestFile(info *model.FileInfo, settings *model.FileSettings) error {
	if *settings.DriverName == model.IMAGE_DRIVER_S3 {
		endpoint := settings.AmazonS3Endpoint
		accessKey := settings.AmazonS3AccessKeyId
		secretKey := settings.AmazonS3SecretAccessKey
		secure := *settings.AmazonS3SSL
		signV2 := *settings.AmazonS3SignV2
		region := settings.AmazonS3Region
		s3Clnt, err := s3New(endpoint, accessKey, secretKey, secure, signV2, region)
		if err != nil {
			return err
		}
		bucket := settings.AmazonS3Bucket
		if err := s3Clnt.RemoveObject(bucket, info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := s3Clnt.RemoveObject(bucket, info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := s3Clnt.RemoveObject(bucket, info.PreviewPath); err != nil {
				return err
			}
		}
	} else if *settings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.Remove(settings.Directory + info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := os.Remove(settings.Directory + info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := os.Remove(settings.Directory + info.PreviewPath); err != nil {
				return err
			}
		}
	}

	return nil
}
