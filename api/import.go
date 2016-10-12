// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"io"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

//
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func ImportPost(post *model.Post) {
	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if result := <-Srv.Store.Post().Save(post); result.Err != nil {
		l4g.Debug(utils.T("api.import.import_post.saving.debug"), post.UserId, post.Message)
	}
}

func ImportUser(team *model.Team, user *model.User) *model.User {
	user.MakeNonNil()

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error(utils.T("api.import.import_user.saving.error"), result.Err)
		return nil
	} else {
		ruser := result.Data.(*model.User)

		if cresult := <-Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
			l4g.Error(utils.T("api.import.import_user.set_email.error"), cresult.Err)
		}

		if err := JoinUserToTeam(team, user); err != nil {
			l4g.Error(utils.T("api.import.import_user.join_team.error"), err)
		}

		return ruser
	}
}

func ImportChannel(channel *model.Channel) *model.Channel {
	if result := <-Srv.Store.Channel().Save(channel); result.Err != nil {
		return nil
	} else {
		sc := result.Data.(*model.Channel)

		return sc
	}
}

func ImportFile(file io.Reader, teamId string, channelId string, userId string, fileName string) (*model.FileInfo, error) {
	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)
	data := buf.Bytes()

	previewPathList := []string{}
	thumbnailPathList := []string{}
	imageDataList := [][]byte{}

	fileInfo, err := doUploadFile(teamId, channelId, userId, fileName, data)
	if err != nil {
		return nil, err
	}

	if fileInfo.PreviewPath != "" || fileInfo.ThumbnailPath != "" {
		previewPathList = append(previewPathList, fileInfo.PreviewPath)
		thumbnailPathList = append(thumbnailPathList, fileInfo.ThumbnailPath)
		imageDataList = append(imageDataList, data)
	}

	go handleImages(previewPathList, thumbnailPathList, imageDataList)

	return fileInfo, nil
}
