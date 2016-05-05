// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestUploadFile(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	channel := th.BasicChannel

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "../test.png")
	if err != nil {
		t.Fatal(err)
	}

	path := utils.FindDir("tests")
	file, err := os.Open(path + "/test.png")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()

	_, err = io.Copy(part, file)
	if err != nil {
		t.Fatal(err)
	}

	field, err := writer.CreateFormField("channel_id")
	if err != nil {
		t.Fatal(err)
	}

	_, err = field.Write([]byte(channel.Id))
	if err != nil {
		t.Fatal(err)
	}

	err = writer.Close()
	if err != nil {
		t.Fatal(err)
	}

	resp, appErr := Client.UploadPostAttachment(body.Bytes(), writer.FormDataContentType())
	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		if appErr != nil {
			t.Fatal(appErr)
		}

		filenames := strings.Split(resp.Data.(*model.FileUploadResponse).Filenames[0], "/")
		filename := filenames[len(filenames)-2] + "/" + filenames[len(filenames)-1]
		if strings.Contains(filename, "../") {
			t.Fatal("relative path should have been sanitized out")
		}
		fileId := strings.Split(filename, ".")[0]

		var auth aws.Auth
		auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
		auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
		bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + filename)
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_thumb.jpg")
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_preview.jpg")
		if err != nil {
			t.Fatal(err)
		}
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		filenames := strings.Split(resp.Data.(*model.FileUploadResponse).Filenames[0], "/")
		filename := filenames[len(filenames)-2] + "/" + filenames[len(filenames)-1]
		if strings.Contains(filename, "../") {
			t.Fatal("relative path should have been sanitized out")
		}
		fileId := strings.Split(filename, ".")[0]

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		path := utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + filename
		if err := os.Remove(path); err != nil {
			t.Fatal("Couldn't remove file at " + path)
		}

		path = utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_thumb.jpg"
		if err := os.Remove(path); err != nil {
			t.Fatal("Couldn't remove file at " + path)
		}

		path = utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_preview.jpg"
		if err := os.Remove(path); err != nil {
			t.Fatal("Couldn't remove file at " + path)
		}
	} else {
		if appErr == nil {
			t.Fatal("S3 and local storage not configured, should have failed")
		}
	}
}

func TestGetFile(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	channel := th.BasicChannel

	if utils.Cfg.FileSettings.DriverName != "" {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("files", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		path := utils.FindDir("tests")
		file, err := os.Open(path + "/test.png")
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()

		_, err = io.Copy(part, file)
		if err != nil {
			t.Fatal(err)
		}

		field, err := writer.CreateFormField("channel_id")
		if err != nil {
			t.Fatal(err)
		}

		_, err = field.Write([]byte(channel.Id))
		if err != nil {
			t.Fatal(err)
		}

		err = writer.Close()
		if err != nil {
			t.Fatal(err)
		}

		resp, upErr := Client.UploadPostAttachment(body.Bytes(), writer.FormDataContentType())
		if upErr != nil {
			t.Fatal(upErr)
		}

		filenames := resp.Data.(*model.FileUploadResponse).Filenames

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		if _, downErr := Client.GetFile(filenames[0], false); downErr != nil {
			t.Fatal(downErr)
		}

		if resp, downErr := Client.GetFileInfo(filenames[0]); downErr != nil {
			t.Fatal(downErr)
		} else {
			info := resp.Data.(*model.FileInfo)
			if info.Size == 0 {
				t.Fatal("No file size returned")
			}
		}

		if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
			var auth aws.Auth
			auth.AccessKey = utils.Cfg.FileSettings.AmazonS3AccessKeyId
			auth.SecretKey = utils.Cfg.FileSettings.AmazonS3SecretAccessKey

			s := s3.New(auth, aws.Regions[utils.Cfg.FileSettings.AmazonS3Region])
			bucket := s.Bucket(utils.Cfg.FileSettings.AmazonS3Bucket)

			filenames := strings.Split(resp.Data.(*model.FileUploadResponse).Filenames[0], "/")
			filename := filenames[len(filenames)-2] + "/" + filenames[len(filenames)-1]
			fileId := strings.Split(filename, ".")[0]

			err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + filename)
			if err != nil {
				t.Fatal(err)
			}

			err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_thumb.jpg")
			if err != nil {
				t.Fatal(err)
			}

			err = bucket.Del("teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_preview.jpg")
			if err != nil {
				t.Fatal(err)
			}
		} else {
			filenames := strings.Split(resp.Data.(*model.FileUploadResponse).Filenames[0], "/")
			filename := filenames[len(filenames)-2] + "/" + filenames[len(filenames)-1]
			fileId := strings.Split(filename, ".")[0]

			path := utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + filename
			if err := os.Remove(path); err != nil {
				t.Fatal("Couldn't remove file at " + path)
			}

			path = utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_thumb.jpg"
			if err := os.Remove(path); err != nil {
				t.Fatal("Couldn't remove file at " + path)
			}

			path = utils.Cfg.FileSettings.Directory + "teams/" + team.Id + "/channels/" + channel.Id + "/users/" + user.Id + "/" + fileId + "_preview.jpg"
			if err := os.Remove(path); err != nil {
				t.Fatal("Couldn't remove file at " + path)
			}
		}
	} else {
		if _, downErr := Client.GetFile("/files/get/yxebdmbz5pgupx7q6ez88rw11a/n3btzxu9hbnapqk36iwaxkjxhc/junk.jpg", false); downErr.StatusCode != http.StatusNotImplemented {
			t.Fatal("Status code should have been 501 - Not Implemented")
		}
	}
}

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
		t.Fatal("should've failed to get image with public link while logged in without query params", resp.Status)
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "&")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while logged in without second query param")
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")] + "?" + link[strings.LastIndex(link, "&"):]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while logged in without first query param")
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
		t.Fatal("should've failed to get image with public link while not logged in without query params")
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "&")]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while not logged in without second query param")
	}

	if resp, err := http.Get(link[:strings.LastIndex(link, "?")] + "?" + link[strings.LastIndex(link, "&"):]); err == nil && resp.StatusCode != http.StatusBadRequest {
		t.Fatal("should've failed to get image with public link while not logged in without first query param")
	}

	utils.Cfg.FileSettings.EnablePublicLink = false
	if resp, err := http.Get(link); err == nil && resp.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed to get image with disabled public link while not logged in")
	}

	utils.Cfg.FileSettings.EnablePublicLink = true

	// test a user that's logged in after the salt has changed
	utils.Cfg.FileSettings.PublicLinkSalt = model.NewId()

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

func TestGetPublicLink(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	channel := th.BasicChannel

	enablePublicLink := utils.Cfg.FileSettings.EnablePublicLink
	driverName := utils.Cfg.FileSettings.DriverName
	defer func() {
		utils.Cfg.FileSettings.EnablePublicLink = enablePublicLink
		utils.Cfg.FileSettings.DriverName = driverName
	}()
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

	utils.Cfg.FileSettings.EnablePublicLink = false
	if _, err := Client.GetPublicLink(filenames[0]); err == nil || err.StatusCode != http.StatusNotImplemented {
		t.Fatal("should've failed when public links are disabled", err)
	}

	utils.Cfg.FileSettings.EnablePublicLink = true

	if _, err := Client.GetPublicLink("garbage"); err == nil {
		t.Fatal("should've failed for invalid link")
	}

	if _, err := Client.GetPublicLink(filenames[0]); err != nil {
		t.Fatal("should've gotten link for file", err)
	}

	th.LoginBasic2()

	if _, err := Client.GetPublicLink(filenames[0]); err == nil {
		t.Fatal("should've failed, user not member of channel")
	}

	th.LoginBasic()

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
