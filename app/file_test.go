// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
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

func TestGetInfoForFilename(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	teamId := th.BasicTeam.Id

	info := th.App.GetInfoForFilename(post, teamId, "sometestfile")
	assert.Nil(t, info, "Test bad filename")

	info = th.App.GetInfoForFilename(post, teamId, "/somechannel/someuser/someid/somefile.png")
	assert.Nil(t, info, "Test non-existent file")
}

func TestFindTeamIdForFilename(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	teamId := th.App.FindTeamIdForFilename(th.BasicPost, fmt.Sprintf("/%v/%v/%v/blargh.png", th.BasicChannel.Id, th.BasicUser.Id, "someid"))
	assert.Equal(t, th.BasicTeam.Id, teamId)

	_, err := th.App.CreateTeamWithUser(&model.Team{Email: th.BasicUser.Email, Name: "zz" + model.NewId(), DisplayName: "Joram's Test Team", Type: model.TEAM_OPEN}, th.BasicUser.Id)
	require.Nil(t, err)

	teamId = th.App.FindTeamIdForFilename(th.BasicPost, fmt.Sprintf("/%v/%v/%v/blargh.png", th.BasicChannel.Id, th.BasicUser.Id, "someid"))
	assert.Equal(t, "", teamId)
}

func TestMigrateFilenamesToFileInfos(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	infos := th.App.MigrateFilenamesToFileInfos(post)
	assert.Equal(t, 0, len(infos))

	post.Filenames = []string{fmt.Sprintf("/%v/%v/%v/blargh.png", th.BasicChannel.Id, th.BasicUser.Id, "someid")}
	infos = th.App.MigrateFilenamesToFileInfos(post)
	assert.Equal(t, 0, len(infos))

	path, _ := utils.FindDir("tests")
	file, fileErr := os.Open(filepath.Join(path, "test.png"))
	require.Nil(t, fileErr)
	defer file.Close()

	fpath := fmt.Sprintf("/teams/%v/channels/%v/users/%v/%v/test.png", th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "someid")
	_, err := th.App.WriteFile(file, fpath)
	require.Nil(t, err)
	rpost, err := th.App.CreatePost(&model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Filenames: []string{fmt.Sprintf("/%v/%v/%v/test.png", th.BasicChannel.Id, th.BasicUser.Id, "someid")}}, th.BasicChannel, false)
	require.Nil(t, err)

	infos = th.App.MigrateFilenamesToFileInfos(rpost)
	assert.Equal(t, 1, len(infos))
}

func TestCopyFileInfos(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	teamId := model.NewId()
	channelId := model.NewId()
	userId := model.NewId()
	filename := "test"
	data := []byte("abcd")

	info1, err := th.App.DoUploadFile(time.Date(2007, 2, 4, 1, 2, 3, 4, time.Local), teamId, channelId, userId, filename, data)
	require.Nil(t, err)
	defer func() {
		<-th.App.Srv.Store.FileInfo().PermanentDelete(info1.Id)
		th.App.RemoveFile(info1.Path)
	}()

	infoIds, err := th.App.CopyFileInfos(userId, []string{info1.Id})
	require.Nil(t, err)

	info2, err := th.App.GetFileInfo(infoIds[0])
	require.Nil(t, err)
	defer func() {
		<-th.App.Srv.Store.FileInfo().PermanentDelete(info2.Id)
		th.App.RemoveFile(info2.Path)
	}()

	assert.NotEqual(t, info1.Id, info2.Id, "should not be equal")
	assert.Equal(t, info2.PostId, "", "should be empty string")
}
