// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
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

	enablePublicLink := utils.Cfg.FileSettings.EnablePublicLink
	defer func() {
		utils.Cfg.FileSettings.EnablePublicLink = enablePublicLink
	}()
	utils.Cfg.FileSettings.EnablePublicLink = true

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

		team2 := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
		team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

		user2 := &model.User{Email: model.NewId() + "success+test@simulator.amazonses.com", Nickname: "Corey Hulen", Password: "pwd"}
		user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
		LinkUserToTeam(user2, team2)
		store.Must(Srv.Store.User().VerifyEmail(user2.Id))

		newProps := make(map[string]string)
		newProps["filename"] = filenames[0]
		newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

		data := model.MapToJson(newProps)
		hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.FileSettings.PublicLinkSalt))

		Client.LoginByEmail(team2.Name, user2.Email, "pwd")
		Client.SetTeamId(team2.Id)

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t="+team.Id, false); downErr != nil {
			t.Fatal(downErr)
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash), false); downErr == nil {
			t.Fatal("Should have errored - missing team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t=junk", false); downErr == nil {
			t.Fatal("Should have errored - bad team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t=12345678901234567890123456", false); downErr == nil {
			t.Fatal("Should have errored - bad team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&t="+team.Id, false); downErr == nil {
			t.Fatal("Should have errored - missing hash")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h=junk&t="+team.Id, false); downErr == nil {
			t.Fatal("Should have errored - bad hash")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?h="+url.QueryEscape(hash)+"&t="+team.Id, false); downErr == nil {
			t.Fatal("Should have errored - missing data")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d=junk&h="+url.QueryEscape(hash)+"&t="+team.Id, false); downErr == nil {
			t.Fatal("Should have errored - bad data")
		}

		if _, downErr := Client.GetFile(filenames[0], true); downErr == nil {
			t.Fatal("Should have errored - user not logged in and link not public")
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

func TestGetPublicLink(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient
	team := th.BasicTeam
	user := th.BasicUser
	channel := th.BasicChannel

	if utils.Cfg.FileSettings.DriverName != "" {
		enablePublicLink := utils.Cfg.FileSettings.EnablePublicLink
		defer func() {
			utils.Cfg.FileSettings.EnablePublicLink = enablePublicLink
		}()
		utils.Cfg.FileSettings.EnablePublicLink = true

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

		post1 := &model.Post{ChannelId: channel.Id, Message: "a" + model.NewId() + "a", Filenames: filenames}

		rpost1, postErr := Client.CreatePost(post1)
		if postErr != nil {
			t.Fatal(postErr)
		}

		if rpost1.Data.(*model.Post).Filenames[0] != filenames[0] {
			t.Fatal("filenames don't match")
		}

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		data := make(map[string]string)
		data["filename"] = filenames[0]

		if _, err := Client.GetPublicLink(data); err != nil {
			t.Fatal(err)
		}

		data["filename"] = "junk"

		if _, err := Client.GetPublicLink(data); err == nil {
			t.Fatal("Should have errored - bad file path")
		}

		th.LoginBasic2()

		data["filename"] = filenames[0]
		if _, err := Client.GetPublicLink(data); err == nil {
			t.Fatal("should have errored, user not member of channel")
		}

		if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
			// perform clean-up on s3
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
		data := make(map[string]string)
		if _, err := Client.GetPublicLink(data); err.StatusCode != http.StatusNotImplemented {
			t.Fatal("Status code should have been 501 - Not Implemented")
		}
	}
}
