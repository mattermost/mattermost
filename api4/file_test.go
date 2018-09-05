// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

func TestUploadFileAsMultipart(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
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
	expectedPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test.png", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.Path != expectedPath {
		t.Logf("file is saved in %v", info.Path)
		t.Fatalf("file should've been saved in %v", expectedPath)
	}

	expectedThumbnailPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_thumb.jpg", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.ThumbnailPath != expectedThumbnailPath {
		t.Logf("file thumbnail is saved in %v", info.ThumbnailPath)
		t.Fatalf("file thumbnail should've been saved in %v", expectedThumbnailPath)
	}

	expectedPreviewPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_preview.jpg", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.PreviewPath != expectedPreviewPath {
		t.Logf("file preview is saved in %v", info.PreviewPath)
		t.Fatalf("file preview should've been saved in %v", expectedPreviewPath)
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if err := th.cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}

	_, resp := Client.UploadFile(data, model.NewId(), "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.UploadFile(data, "../../junk", "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadFile(data, model.NewId(), "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadFile(data, "../../junk", "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadFile(data, channel.Id, "test.png")
	CheckNoError(t, resp)

	enableFileAttachments := *th.App.Config().FileSettings.EnableFileAttachments
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = enableFileAttachments })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })

	_, resp = th.SystemAdminClient.UploadFile(data, channel.Id, "test.png")
	if resp.StatusCode == 0 {
		t.Log("file upload request failed completely")
	} else if resp.StatusCode != http.StatusNotImplemented {
		// This should return an HTTP 501, but it occasionally causes the http client itself to error
		t.Fatalf("should've returned HTTP 501 or failed completely, got %v instead", resp.StatusCode)
	}
}

func TestUploadFileAsRequestBody(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	user := th.BasicUser
	channel := th.BasicChannel

	var uploadInfo *model.FileInfo
	var data []byte
	var err error
	if data, err = readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else if fileResp, resp := Client.UploadFileAsRequestBody(data, channel.Id, "test.png"); resp.Error != nil {
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
	expectedPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test.png", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.Path != expectedPath {
		t.Logf("file is saved in %v", info.Path)
		t.Fatalf("file should've been saved in %v", expectedPath)
	}

	expectedThumbnailPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_thumb.jpg", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.ThumbnailPath != expectedThumbnailPath {
		t.Logf("file thumbnail is saved in %v", info.ThumbnailPath)
		t.Fatalf("file thumbnail should've been saved in %v", expectedThumbnailPath)
	}

	expectedPreviewPath := fmt.Sprintf("%v/teams/%v/channels/%v/users/%v/%v/test_preview.jpg", date, FILE_TEAM_ID, channel.Id, user.Id, info.Id)
	if info.PreviewPath != expectedPreviewPath {
		t.Logf("file preview is saved in %v", info.PreviewPath)
		t.Fatalf("file preview should've been saved in %v", expectedPreviewPath)
	}

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	if err := th.cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}

	_, resp := Client.UploadFileAsRequestBody(data, model.NewId(), "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.UploadFileAsRequestBody(data, "../../junk", "test.png")
	if resp.StatusCode == 0 {
		t.Log("file upload request failed completely")
	} else if resp.StatusCode != http.StatusBadRequest {
		// This should return an HTTP 400, but it occasionally causes the http client itself to error
		t.Fatalf("should've returned HTTP 400 or failed completely, got %v instead", resp.StatusCode)
	}

	_, resp = th.SystemAdminClient.UploadFileAsRequestBody(data, model.NewId(), "test.png")
	CheckForbiddenStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadFileAsRequestBody(data, "../../junk", "test.png")
	if resp.StatusCode == 0 {
		t.Log("file upload request failed completely")
	} else if resp.StatusCode != http.StatusBadRequest {
		// This should return an HTTP 400, but it occasionally causes the http client itself to error
		t.Fatalf("should've returned HTTP 400 or failed completely, got %v instead", resp.StatusCode)
	}

	_, resp = th.SystemAdminClient.UploadFileAsRequestBody(data, channel.Id, "test.png")
	CheckNoError(t, resp)

	enableFileAttachments := *th.App.Config().FileSettings.EnableFileAttachments
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = enableFileAttachments })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.EnableFileAttachments = false })

	_, resp = th.SystemAdminClient.UploadFileAsRequestBody(data, channel.Id, "test.png")
	if resp.StatusCode == 0 {
		t.Log("file upload request failed completely")
	} else if resp.StatusCode != http.StatusNotImplemented {
		// This should return an HTTP 501, but it occasionally causes the http client itself to error
		t.Fatalf("should've returned HTTP 501 or failed completely, got %v instead", resp.StatusCode)
	}
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
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

	if len(data) == 0 {
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

func TestGetFileHeaders(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	testHeaders := func(data []byte, filename string, expectedContentType string, getInline bool) func(*testing.T) {
		return func(t *testing.T) {
			fileResp, resp := Client.UploadFile(data, channel.Id, filename)
			CheckNoError(t, resp)

			fileId := fileResp.FileInfos[0].Id

			_, resp = Client.GetFile(fileId)
			CheckNoError(t, resp)

			if contentType := resp.Header.Get("Content-Type"); !strings.HasPrefix(contentType, expectedContentType) {
				t.Fatal("returned incorrect Content-Type", contentType)
			}

			if getInline {
				if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "inline") {
					t.Fatal("returned incorrect Content-Disposition", contentDisposition)
				}
			} else {
				if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "attachment") {
					t.Fatal("returned incorrect Content-Disposition", contentDisposition)
				}
			}

			_, resp = Client.DownloadFile(fileId, true)
			CheckNoError(t, resp)

			if contentType := resp.Header.Get("Content-Type"); !strings.HasPrefix(contentType, expectedContentType) {
				t.Fatal("returned incorrect Content-Type", contentType)
			}

			if contentDisposition := resp.Header.Get("Content-Disposition"); !strings.HasPrefix(contentDisposition, "attachment") {
				t.Fatal("returned incorrect Content-Disposition", contentDisposition)
			}
		}
	}

	data := []byte("ABC")

	t.Run("png", testHeaders(data, "test.png", "image/png", true))
	t.Run("gif", testHeaders(data, "test.gif", "image/gif", true))
	t.Run("mp4", testHeaders(data, "test.mp4", "video/mp4", true))
	t.Run("mp3", testHeaders(data, "test.mp3", "audio/mpeg", true))
	t.Run("pdf", testHeaders(data, "test.pdf", "application/pdf", false))
	t.Run("txt", testHeaders(data, "test.txt", "text/plain", false))
	t.Run("html", testHeaders(data, "test.html", "text/plain", false))
	t.Run("js", testHeaders(data, "test.js", "text/plain", false))
	t.Run("go", testHeaders(data, "test.go", "application/octet-stream", false))
	t.Run("zip", testHeaders(data, "test.zip", "application/zip", false))
	// Not every platform can recognize these
	//t.Run("exe", testHeaders(data, "test.exe", "application/x-ms", false))
	t.Run("no extension", testHeaders(data, "test", "application/octet-stream", false))
	t.Run("no extension 2", testHeaders([]byte("<html></html>"), "test", "application/octet-stream", false))
}

func TestGetFileThumbnail(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
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

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFileThumbnail(fileId)
	CheckNoError(t, resp)

	if len(data) == 0 {
		t.Fatal("should not be empty")
	}

	_, resp = Client.GetFileThumbnail("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileThumbnail(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileThumbnail(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileThumbnail(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileThumbnail(fileId)
	CheckNoError(t, resp)
}

func TestGetFileLink(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

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

	fileId := ""
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	_, resp := Client.GetFileLink(fileId)
	CheckBadRequestStatus(t, resp)

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = false })
	_, resp = Client.GetFileLink(fileId)
	CheckNotImplementedStatus(t, resp)

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })
	link, resp := Client.GetFileLink(fileId)
	CheckNoError(t, resp)

	if link == "" {
		t.Fatal("should've received public link")
	}

	_, resp = Client.GetFileLink("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileLink(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileLink(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileLink(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileLink(fileId)
	CheckNoError(t, resp)

	if result := <-th.App.Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		th.cleanupTestFile(result.Data.(*model.FileInfo))
	}
}

func TestGetFilePreview(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
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

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	data, resp := Client.GetFilePreview(fileId)
	CheckNoError(t, resp)

	if len(data) == 0 {
		t.Fatal("should not be empty")
	}

	_, resp = Client.GetFilePreview("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFilePreview(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFilePreview(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFilePreview(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFilePreview(fileId)
	CheckNoError(t, resp)
}

func TestGetFileInfo(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	user := th.BasicUser
	channel := th.BasicChannel

	if *th.App.Config().FileSettings.DriverName == "" {
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

	// Wait a bit for files to ready
	time.Sleep(2 * time.Second)

	info, resp := Client.GetFileInfo(fileId)
	CheckNoError(t, resp)

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

	_, resp = Client.GetFileInfo("junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetFileInfo(model.NewId())
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetFileInfo(fileId)
	CheckUnauthorizedStatus(t, resp)

	otherUser := th.CreateUser()
	Client.Login(otherUser.Email, otherUser.Password)
	_, resp = Client.GetFileInfo(fileId)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = th.SystemAdminClient.GetFileInfo(fileId)
	CheckNoError(t, resp)
}

func TestGetPublicFile(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client
	channel := th.BasicChannel

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
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = GenerateTestId() })

	fileId := ""
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileResp, resp := Client.UploadFile(data, channel.Id, "test.png")
		CheckNoError(t, resp)

		fileId = fileResp.FileInfos[0].Id
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(th.App.Srv.Store.FileInfo().AttachToPost(fileId, th.BasicPost.Id))

	result := <-th.App.Srv.Store.FileInfo().Get(fileId)
	info := result.Data.(*model.FileInfo)
	link := th.App.GeneratePublicLink(Client.Url, info)

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

	// test after the salt has changed
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FileSettings.EnablePublicLink = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.PublicLinkSalt = GenerateTestId() })

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link after salt changed")
	}

	if err := th.cleanupTestFile(store.Must(th.App.Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}

	th.cleanupTestFile(info)
}
