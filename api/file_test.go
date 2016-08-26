// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	// "encoding/base64"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"io"
	"io/ioutil"
	// "net/http"
	"os"
	// "strings"
	"testing"
	"time"
)

func TestUploadFile(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Logf("skipping because no file driver is enabled")
		return
	}

	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	channel := th.BasicChannel

	var fileId string
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else if resp, err := Client.UploadPostAttachment(data, channel.Id, "test.png"); err != nil {
		t.Fatal(err)
	} else if len(resp.FileIds) != 1 {
		t.Fatal("should've returned a single file id")
	} else {
		fileId = resp.FileIds[0]
	}

	var info *model.FileInfo
	if result := <-Srv.Store.FileInfo().Get(fileId); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		info = result.Data.(*model.FileInfo)
	}

	if info.UserId != user.Id {
		t.Fatal("file should be assigned to user")
	} else if info.PostId != "" {
		t.Fatal("file shouldn't have a post")
	} else if info.Path == "" {
		t.Fatal("file path should be set")
	}

	// This also makes sure that the relative path provided above is sanitized out
	expectedPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test.png", team.Id, channel.Id, user.Id, info.Id)
	if info.Path != expectedPath {
		t.Logf("file is saved in %v", info.Path)
		t.Fatalf("file should've been saved in %v", expectedPath)
	}

	expectedThumbnailPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test_thumb.jpg", team.Id, channel.Id, user.Id, info.Id)
	if info.ThumbnailPath != expectedThumbnailPath {
		t.Logf("file thumbnail is saved in %v", info.ThumbnailPath)
		t.Fatalf("file thumbnail should've been saved in %v", expectedThumbnailPath)
	}

	expectedPreviewPath := fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/test_preview.jpg", team.Id, channel.Id, user.Id, info.Id)
	if info.PreviewPath != expectedPreviewPath {
		t.Logf("file preview is saved in %v", info.PreviewPath)
		t.Fatalf("file preview should've been saved in %v", expectedPreviewPath)
	}

	// Wait a bit for files to ready
	time.Sleep(5 * time.Second)

	if err := cleanupTestFile(info); err != nil {
		t.Fatal(err)
	}
}

func TestGetFileInfo(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	user := th.BasicUser
	channel := th.BasicChannel

	var fileId string
	if data, err := readTestFile("test.png"); err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileIds[0]
	}

	info, err := Client.GetFileInfo(fileId)
	if err != nil {
		t.Fatal(err)
	} else if info.Id != fileId {
		t.Fatal("got incorrect file")
	} else if info.UserId != user.Id {
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
	time.Sleep(5 * time.Second)

	// Other user shouldn't be able to get file info for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetFileInfo(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file info before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(Srv.Store.FileInfo().AttachToPost(info, th.BasicPost.Id))

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

	if err := cleanupTestFile(store.Must(Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileIds[0]
	}

	info := Client.MustGeneric(Client.GetFileInfo(fileId)).(*model.FileInfo)

	// Wait a bit for files to ready
	time.Sleep(5 * time.Second)

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
	store.Must(Srv.Store.FileInfo().AttachToPost(info, th.BasicPost.Id))

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

	if err := cleanupTestFile(store.Must(Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}
}

func TestGetFileThumbnail(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileIds[0]
	}

	info := Client.MustGeneric(Client.GetFileInfo(fileId)).(*model.FileInfo)

	// Wait a bit for files to ready
	time.Sleep(5 * time.Second)

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
	store.Must(Srv.Store.FileInfo().AttachToPost(info, th.BasicPost.Id))

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

	if err := cleanupTestFile(store.Must(Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}
}

func TestGetFilePreview(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileIds[0]
	}

	info := Client.MustGeneric(Client.GetFileInfo(fileId)).(*model.FileInfo)

	// Wait a bit for files to ready
	time.Sleep(5 * time.Second)

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
	store.Must(Srv.Store.FileInfo().AttachToPost(info, th.BasicPost.Id))

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

	if err := cleanupTestFile(store.Must(Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}
}

func TestGetPublicLink(t *testing.T) {
	th := Setup().InitBasic()

	if utils.Cfg.FileSettings.DriverName == "" {
		t.Skip("skipping because no file driver is enabled")
	}

	enablePublicLink := utils.Cfg.FileSettings.EnablePublicLink
	defer func() {
		utils.Cfg.FileSettings.EnablePublicLink = enablePublicLink
	}()
	utils.Cfg.FileSettings.EnablePublicLink = false

	Client := th.BasicClient
	channel := th.BasicChannel

	var fileId string
	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	} else {
		fileId = Client.MustGeneric(Client.UploadPostAttachment(data, channel.Id, "test.png")).(*model.FileUploadResponse).FileIds[0]
	}

	info := Client.MustGeneric(Client.GetFileInfo(fileId)).(*model.FileInfo)

	// Wait a bit for files to ready
	time.Sleep(5 * time.Second)

	if _, err := Client.GetPublicLink(fileId); err == nil {
		t.Fatal("should've failed to get public link when disabled")
	}

	utils.Cfg.FileSettings.EnablePublicLink = true

	if link, err := Client.GetPublicLink(fileId); err != nil {
		t.Fatal(err)
	} else if link == "" {
		t.Fatal("should've received public link")
	}

	// Other user shouldn't be able to get public link for this file before it's attached to a post
	th.LoginBasic2()

	if _, err := Client.GetPublicLink(fileId); err == nil {
		t.Fatal("other user shouldn't be able to get file before it's attached to a post")
	}

	// Hacky way to assign file to a post (usually would be done by CreatePost call)
	store.Must(Srv.Store.FileInfo().AttachToPost(info, th.BasicPost.Id))

	// Other user shouldn't be able to get public link for this file if they're not in the channel for it
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

	if err := cleanupTestFile(store.Must(Srv.Store.FileInfo().Get(fileId)).(*model.FileInfo)); err != nil {
		t.Fatal(err)
	}
}

func TestGeneratePublicLinkHash(t *testing.T) {
	filename1 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	filename2 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	salt1 := model.NewRandomString(32)
	salt2 := model.NewRandomString(32)

	hash1 := generatePublicLinkHash(filename1, salt1)
	hash2 := generatePublicLinkHash(filename2, salt1)
	hash3 := generatePublicLinkHash(filename1, salt2)

	if hash1 != generatePublicLinkHash(filename1, salt1) {
		t.Fatal("hash should be equal for the same file name and salt")
	}

	if hash1 == hash2 {
		t.Fatal("hashes for different files should not be equal")
	}

	if hash1 == hash3 {
		t.Fatal("hashes for the same file with different salts should not be equal")
	}
}

func readTestFile(name string) ([]byte, error) {
	path := utils.FindDir("tests")
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

func cleanupTestFile(info *model.FileInfo) error {
	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		if err := bucket.Del(info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := bucket.Del(info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := bucket.Del(info.PreviewPath); err != nil {
				return err
			}
		}
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := os.Remove(utils.Cfg.FileSettings.Directory + info.Path); err != nil {
			return err
		}

		if info.ThumbnailPath != "" {
			if err := os.Remove(utils.Cfg.FileSettings.Directory + info.ThumbnailPath); err != nil {
				return err
			}
		}

		if info.PreviewPath != "" {
			if err := os.Remove(utils.Cfg.FileSettings.Directory + info.PreviewPath); err != nil {
				return err
			}
		}
	}

	return nil
}

/*

func TestGetPublicFile(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	enablePublicLink := utils.Cfg.FileSettings.EnablePublicLink
	driverName := utils.Cfg.FileSettings.DriverName
	defer func() {
		utils.Cfg.FileSettings.EnablePublicLink = enablePublicLink
		utils.Cfg.FileSettings.DriverName = driverName
	}()
	utils.Cfg.FileSettings.EnablePublicLink = true
	if driverName == "" {
		driverName = model.IMAGE_DRIVER_LOCAL
	}

	filenames, err := uploadTestFile(Client, channel.Id)
	if err != nil {
		t.Fatal("failed to upload test file", err)
	}

	post1 := &model.Post{ChannelId: channel.Id, Message: "a" + model.NewId() + "a", Filenames: filenames}

	if rpost1, postErr := Client.CreatePost(post1); postErr != nil {
		t.Fatal(postErr)
	} else {
		post1 = rpost1.Data.(*model.Post)
	}

	var link string
	if result, err := Client.GetPublicLink(filenames[0]); err != nil {
		t.Fatal("failed to get public link")
	} else {
		link = result.Data.(string)
	}

	// test a user that's logged in
	if resp, err := http.Get(link); err != nil && resp.StatusCode != http.StatusOK {
		t.Fatal("failed to get image with public link while logged in", err)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while logged in without hash", resp.Status)
	}

	utils.Cfg.FileSettings.EnablePublicLink = false
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link while logged in")
	}

	utils.Cfg.FileSettings.EnablePublicLink = true

	// test a user that's logged out
	Client.Must(Client.Logout())

	if resp, err := http.Get(link); err != nil && resp.StatusCode != http.StatusOK {
		t.Fatal("failed to get image with public link while not logged in", err)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while not logged in without hash")
	}

	utils.Cfg.FileSettings.EnablePublicLink = false
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link while not logged in")
	}

	utils.Cfg.FileSettings.EnablePublicLink = true

	// test a user that's logged in after the salt has changed
	*utils.Cfg.FileSettings.PublicLinkSalt = model.NewId()

	th.LoginBasic()
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while logged in after salt changed")
	}

	Client.Must(Client.Logout())
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while not logged in after salt changed")
	}

	if err := cleanupTestFile(filenames[0], th.BasicTeam.Id, channel.Id, th.BasicUser.Id); err != nil {
		t.Fatal("failed to cleanup test file", err)
	}
}

func uploadTestFile(Client *model.Client, channelId string) ([]string, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "test.png")
	if err != nil {
		return nil, err
	}

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	file, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")

	if _, err := io.Copy(part, bytes.NewReader(file)); err != nil {
		return nil, err
	}

	field, err := writer.CreateFormField("channel_id")
	if err != nil {
		return nil, err
	}

	if _, err := field.Write([]byte(channelId)); err != nil {
		return nil, err
	}

	if err := writer.Close(); err != nil {
		return nil, err
	}

	if resp, err := Client.UploadPostAttachment(body.Bytes(), writer.FormDataContentType()); err != nil {
		return nil, err
	} else {
		return resp.Data.(*model.FileUploadResponse).Filenames, nil
	}
}

func cleanupTestFile(fullFilename, teamId, channelId, userId string) error {
	filenames := strings.Split(fullFilename, "/")
	filename := filenames[len(filenames)-2] + "/" + filenames[len(filenames)-1]
	fileId := strings.Split(filename, ".")[0]

	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		// perform clean-up on s3
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		if err := bucket.Del("teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename); err != nil {
			return err
		}

		if err := bucket.Del("teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + fileId + "_thumb.jpg"); err != nil {
			return err
		}

		if err := bucket.Del("teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + fileId + "_preview.jpg"); err != nil {
			return err
		}
	} else {
		path := utils.Cfg.FileSettings.Directory + "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + filename
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("Couldn't remove file at " + path)
		}

		path = utils.Cfg.FileSettings.Directory + "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + fileId + "_thumb.jpg"
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("Couldn't remove file at " + path)
		}

		path = utils.Cfg.FileSettings.Directory + "teams/" + teamId + "/channels/" + channelId + "/users/" + userId + "/" + fileId + "_preview.jpg"
		if err := os.Remove(path); err != nil {
			return fmt.Errorf("Couldn't remove file at " + path)
		}
	}

	return nil
}
*/
