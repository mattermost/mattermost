// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/mattermost/platform/model"
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
	Setup()

	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := DoUploadFile(teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	}

	if info1.Path != fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info1.Id, filename) {
		t.Fatal("stored file at incorrect path", info1.Path)
	}

	info2, err := DoUploadFile(teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	}

	if info2.Path != fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info2.Id, filename) {
		t.Fatal("stored file at incorrect path", info2.Path)
	}

	info3, err := DoUploadFile(teamId, channelId, userId, filename, data)
	if err != nil {
		t.Fatal(err)
	}

	if info3.Path != fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info3.Id, filename) {
		t.Fatal("stored file at incorrect path", info3.Path)
	}

	info4, err := DoUploadFile("../../"+teamId, "../../"+channelId, "../../"+userId, "../../"+filename, data)
	if err != nil {
		t.Fatal(err)
	}

	if info4.Path != fmt.Sprintf("teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info4.Id, filename) {
		t.Fatal("stored file at incorrect path", info4.Path)
	}
}
