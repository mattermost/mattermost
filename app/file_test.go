// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
)

func TestGeneratePublicLinkHash(t *testing.T) {
	filename1 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	filename2 := model.NewId() + "/" + model.NewRandomString(16) + ".txt"
	salt1 := model.NewRandomString(32)
	salt2 := model.NewRandomString(32)

	hash1 := GeneratePublicLinkHash(filename1, salt1)
	hash2 := GeneratePublicLinkHash(filename2, salt1)
	hash3 := GeneratePublicLinkHash(filename1, salt2)

	if hash1 != GeneratePublicLinkHash(filename1, salt1) {
		t.Fatal("hash should be equal for the same file name and salt")
	}

	if hash1 == hash2 {
		t.Fatal("hashes for different files should not be equal")
	}

	if hash1 == hash3 {
		t.Fatal("hashes for the same file with different salts should not be equal")
	}
}

func TestDoUploadFile(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			<-th.App.Srv.Store.FileInfo().PermanentDelete(info1.Id)
			th.App.RemoveFile(info1.Path)
		}()
	}

	if info1.Path != fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info1.Id, filename) {
		t.Fatal("stored file at incorrect path", info1.Path)
	}

	info2, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			<-th.App.Srv.Store.FileInfo().PermanentDelete(info2.Id)
			th.App.RemoveFile(info2.Path)
		}()
	}

	if info2.Path != fmt.Sprintf("20070204/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info2.Id, filename) {
		t.Fatal("stored file at incorrect path", info2.Path)
	}

	info3, err := th.App.DoUploadFile(time.Date(2008, 3, 5, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			<-th.App.Srv.Store.FileInfo().PermanentDelete(info3.Id)
			th.App.RemoveFile(info3.Path)
		}()
	}

	if info3.Path != fmt.Sprintf("20080305/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info3.Id, filename) {
		t.Fatal("stored file at incorrect path", info3.Path)
	}

	info4, err := th.App.DoUploadFile(time.Date(2009, 3, 5, 1, 2, 3, 4, time.Local), "../../"+teamId, "../../"+channelId, "../../"+userId, "../../"+filename, data)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			<-th.App.Srv.Store.FileInfo().PermanentDelete(info3.Id)
			th.App.RemoveFile(info3.Path)
		}()
	}

	if info4.Path != fmt.Sprintf("20090305/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info4.Id, filename) {
		t.Fatal("stored file at incorrect path", info4.Path)
	}
}
