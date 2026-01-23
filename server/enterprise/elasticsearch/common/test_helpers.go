// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func createPost(userId string, channelId string, message string) *model.Post {
	post := &model.Post{
		Message:       message,
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userId,
		CreateAt:      1000000,
	}
	post.PreSave()

	return post
}

func createChannel(teamId, name, displayName string, channelType model.ChannelType) *model.Channel {
	channel := &model.Channel{
		TeamId:      teamId,
		Type:        channelType,
		Name:        name,
		DisplayName: displayName,
	}
	channel.PreSave()

	return channel
}

func createUser(username, nickname, firstName, lastName string) *model.User {
	user := &model.User{
		Username:  username,
		Password:  username,
		Nickname:  nickname,
		FirstName: firstName,
		LastName:  lastName,
	}
	if err := user.PreSave(); err != nil {
		return nil
	}

	return user
}

func createFile(creatorID, channelID, postID, content, name, extension string) *model.FileInfo {
	file := &model.FileInfo{
		CreatorId: creatorID,
		ChannelId: channelID,
		PostId:    postID,
		Content:   content,
		Name:      name,
		Extension: extension,
	}
	file.PreSave()

	return file
}

func CheckMatchesEqual(t *testing.T, expected model.PostSearchMatches, actual map[string][]string) {
	a := assert.New(t)

	a.Len(actual, len(expected), "Received matches for a different number of posts")

	for postId, expectedMatches := range expected {
		a.ElementsMatch(expectedMatches, actual[postId], fmt.Sprintf("%v: expected %v, got %v", postId, expectedMatches, actual[postId]))
	}
}
