// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/s3"
	"github.com/mattermost/platform/model"
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
	Setup()

	team := &model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	<-Srv.Store.User().VerifyEmail(user1.Id)

	Client.LoginByEmail(team.Domain, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("files", "test.png")
	if err != nil {
		t.Fatal(err)
	}

	path := utils.FindDir("web/static/images")
	file, err := os.Open(path + "/test.png")
	defer file.Close()

	_, err = io.Copy(part, file)
	if err != nil {
		t.Fatal(err)
	}

	field, err := writer.CreateFormField("channel_id")
	if err != nil {
		t.Fatal(err)
	}

	_, err = field.Write([]byte(channel1.Id))
	if err != nil {
		t.Fatal(err)
	}

	err = writer.Close()
	if err != nil {
		t.Fatal(err)
	}

	resp, appErr := Client.UploadFile("/files/upload", body.Bytes(), writer.FormDataContentType())
	if utils.IsS3Configured() {
		if appErr != nil {
			t.Fatal(appErr)
		}

		filenames := resp.Data.(*model.FileUploadResponse).Filenames

		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

		fileId := strings.Split(filenames[0], ".")[0]

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + filenames[0])
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + fileId + "_thumb.jpg")
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + fileId + "_preview.png")
		if err != nil {
			t.Fatal(err)
		}
	} else {
		if appErr == nil {
			t.Fatal("S3 not configured, should have failed")
		}
	}
}

func TestGetFile(t *testing.T) {
	Setup()

	team := &model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	<-Srv.Store.User().VerifyEmail(user1.Id)

	Client.LoginByEmail(team.Domain, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if utils.IsS3Configured() {

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("files", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		path := utils.FindDir("web/static/images")
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

		_, err = field.Write([]byte(channel1.Id))
		if err != nil {
			t.Fatal(err)
		}

		err = writer.Close()
		if err != nil {
			t.Fatal(err)
		}

		resp, upErr := Client.UploadFile("/files/upload", body.Bytes(), writer.FormDataContentType())
		if upErr != nil {
			t.Fatal(upErr)
		}

		filenames := resp.Data.(*model.FileUploadResponse).Filenames

		// wait a bit for files to ready
		time.Sleep(5 * time.Second)

		if _, downErr := Client.GetFile(filenames[0], true); downErr != nil {
			t.Fatal("file get failed")
		}

		team2 := &model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
		team2 = Client.Must(Client.CreateTeam(team2)).Data.(*model.Team)

		user2 := &model.User{TeamId: team2.Id, Email: model.NewId() + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
		user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
		<-Srv.Store.User().VerifyEmail(user2.Id)

		newProps := make(map[string]string)
		newProps["filename"] = filenames[0]
		newProps["time"] = fmt.Sprintf("%v", model.GetMillis())

		data := model.MapToJson(newProps)
		hash := model.HashPassword(fmt.Sprintf("%v:%v", data, utils.Cfg.ServiceSettings.PublicLinkSalt))

		Client.LoginByEmail(team2.Domain, user2.Email, "pwd")

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t="+team.Id, true); downErr != nil {
			t.Fatal(downErr)
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash), true); downErr == nil {
			t.Fatal("Should have errored - missing team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t=junk", true); downErr == nil {
			t.Fatal("Should have errored - bad team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h="+url.QueryEscape(hash)+"&t=12345678901234567890123456", true); downErr == nil {
			t.Fatal("Should have errored - bad team id")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&t="+team.Id, true); downErr == nil {
			t.Fatal("Should have errored - missing hash")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d="+url.QueryEscape(data)+"&h=junk&t="+team.Id, true); downErr == nil {
			t.Fatal("Should have errored - bad hash")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?h="+url.QueryEscape(hash)+"&t="+team.Id, true); downErr == nil {
			t.Fatal("Should have errored - missing data")
		}

		if _, downErr := Client.GetFile(filenames[0]+"?d=junk&h="+url.QueryEscape(hash)+"&t="+team.Id, true); downErr == nil {
			t.Fatal("Should have errored - bad data")
		}

		if _, downErr := Client.GetFile(filenames[0], true); downErr == nil {
			t.Fatal("Should have errored - user not logged in and link not public")
		}

		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

		fileId := strings.Split(filenames[0], ".")[0]

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + filenames[0])
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + fileId + "_thumb.jpg")
		if err != nil {
			t.Fatal(err)
		}

		err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + user1.Id + "/" + fileId + "_preview.png")
		if err != nil {
			t.Fatal(err)
		}
	} else {
		if _, downErr := Client.GetFile("/files/get/yxebdmbz5pgupx7q6ez88rw11a/n3btzxu9hbnapqk36iwaxkjxhc/junk.jpg", false); downErr.StatusCode != http.StatusNotImplemented {
			t.Fatal("Status code should have been 501 - Not Implemented")
		}
	}
}

func TestGetPublicLink(t *testing.T) {
	Setup()

	team := &model.Team{Name: "Name", Domain: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	<-Srv.Store.User().VerifyEmail(user1.Id)

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey@test.com", FullName: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	<-Srv.Store.User().VerifyEmail(user2.Id)

	Client.LoginByEmail(team.Domain, user1.Email, "pwd")

	channel1 := &model.Channel{DisplayName: "Test API Name", Name: "a" + model.NewId() + "a", Type: model.CHANNEL_OPEN, TeamId: team.Id}
	channel1 = Client.Must(Client.CreateChannel(channel1)).Data.(*model.Channel)

	if utils.IsS3Configured() {

		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)
		part, err := writer.CreateFormFile("files", "test.png")
		if err != nil {
			t.Fatal(err)
		}

		path := utils.FindDir("web/static/images")
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

		_, err = field.Write([]byte(channel1.Id))
		if err != nil {
			t.Fatal(err)
		}

		err = writer.Close()
		if err != nil {
			t.Fatal(err)
		}

		resp, upErr := Client.UploadFile("/files/upload", body.Bytes(), writer.FormDataContentType())
		if upErr != nil {
			t.Fatal(upErr)
		}

		filenames := resp.Data.(*model.FileUploadResponse).Filenames

		post1 := &model.Post{ChannelId: channel1.Id, Message: "a" + model.NewId() + "a", Filenames: filenames}

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

		Client.LoginByEmail(team.Domain, user2.Email, "pwd")
		data["filename"] = filenames[0]
		if _, err := Client.GetPublicLink(data); err == nil {
			t.Fatal("should have errored, user not member of channel")
		}

		// perform clean-up on s3
		var auth aws.Auth
		auth.AccessKey = utils.Cfg.AWSSettings.S3AccessKeyId
		auth.SecretKey = utils.Cfg.AWSSettings.S3SecretAccessKey

		s := s3.New(auth, aws.Regions[utils.Cfg.AWSSettings.S3Region])
		bucket := s.Bucket(utils.Cfg.AWSSettings.S3Bucket)

		fileId := strings.Split(filenames[0], ".")[0]

		if err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + rpost1.Data.(*model.Post).UserId + "/" + filenames[0]); err != nil {
			t.Fatal(err)
		}

		if err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + rpost1.Data.(*model.Post).UserId + "/" + fileId + "_thumb.jpg"); err != nil {
			t.Fatal(err)
		}

		if err = bucket.Del("teams/" + team.Id + "/channels/" + channel1.Id + "/users/" + rpost1.Data.(*model.Post).UserId + "/" + fileId + "_preview.png"); err != nil {
			t.Fatal(err)
		}
	} else {
		data := make(map[string]string)
		if _, err := Client.GetPublicLink(data); err.StatusCode != http.StatusNotImplemented {
			t.Fatal("Status code should have been 501 - Not Implemented")
		}
	}
}
