// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform1/platform/utils"
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

	info4, err := DoUploadFile(time.Date(2009, 3, 5, 1, 2, 3, 4, time.Local), "../../"+teamId, "../../"+channelId, "../../"+userId, "../../"+filename, data)
	if err != nil {
		t.Fatal(err)
	} else {
		defer func() {
			<-Srv.Store.FileInfo().PermanentDelete(info3.Id)
			utils.RemoveFile(info3.Path)
		}()
	}

	if info4.Path != fmt.Sprintf("20090305/teams/%v/channels/%v/users/%v/%v/%v", teamId, channelId, userId, info4.Id, filename) {
		t.Fatal("stored file at incorrect path", info4.Path)
	}
}
