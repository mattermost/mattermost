// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
)

type BLVChannel struct {
	ID          string
	TeamID      []string
	NameSuggest []string
}

type BLVUser struct {
	ID                         string
	SuggestionsWithFullname    []string
	SuggestionsWithoutFullname []string
	TeamsIds                   []string
	ChannelsIds                []string
}

type BLVPost struct {
	ID          string
	TeamID      string
	ChannelID   string
	UserID      string
	CreateAt    int64
	Message     string
	Type        string
	Hashtags    []string
	Attachments string
}

type BLVFile struct {
	Id        string
	CreatorID string
	ChannelID string
	CreateAt  int64
	Name      string
	Content   string
	Extension string
}

func BLVChannelFromChannel(channel *model.Channel) *BLVChannel {
	displayNameInputs := searchengine.GetSuggestionInputsSplitBy(channel.DisplayName, " ")
	nameInputs := searchengine.GetSuggestionInputsSplitByMultiple(channel.Name, []string{"-", "_"})

	return &BLVChannel{
		ID:          channel.Id,
		TeamID:      []string{channel.TeamId},
		NameSuggest: append(displayNameInputs, nameInputs...),
	}
}

func BLVUserFromUserAndTeams(user *model.User, teamsIds, channelsIds []string) *BLVUser {
	usernameSuggestions := searchengine.GetSuggestionInputsSplitByMultiple(user.Username, []string{".", "-", "_"})

	fullnameStrings := []string{}
	if user.FirstName != "" {
		fullnameStrings = append(fullnameStrings, user.FirstName)
	}
	if user.LastName != "" {
		fullnameStrings = append(fullnameStrings, user.LastName)
	}

	fullnameSuggestions := []string{}
	if len(fullnameStrings) > 0 {
		fullname := strings.Join(fullnameStrings, " ")
		fullnameSuggestions = searchengine.GetSuggestionInputsSplitBy(fullname, " ")
	}

	nicknameSuggesitons := []string{}
	if user.Nickname != "" {
		nicknameSuggesitons = searchengine.GetSuggestionInputsSplitBy(user.Nickname, " ")
	}

	usernameAndNicknameSuggestions := append(usernameSuggestions, nicknameSuggesitons...)

	return &BLVUser{
		ID:                         user.Id,
		SuggestionsWithFullname:    append(usernameAndNicknameSuggestions, fullnameSuggestions...),
		SuggestionsWithoutFullname: usernameAndNicknameSuggestions,
		TeamsIds:                   teamsIds,
		ChannelsIds:                channelsIds,
	}
}

func BLVUserFromUserForIndexing(userForIndexing *model.UserForIndexing) *BLVUser {
	user := &model.User{
		Id:        userForIndexing.Id,
		Username:  userForIndexing.Username,
		Nickname:  userForIndexing.Nickname,
		FirstName: userForIndexing.FirstName,
		LastName:  userForIndexing.LastName,
		CreateAt:  userForIndexing.CreateAt,
		DeleteAt:  userForIndexing.DeleteAt,
	}

	return BLVUserFromUserAndTeams(user, userForIndexing.TeamsIds, userForIndexing.ChannelsIds)
}

func BLVPostFromPost(post *model.Post, teamID string) *BLVPost {
	p := &model.PostForIndexing{
		TeamId: teamID,
	}
	post.ShallowCopy(&p.Post)
	return BLVPostFromPostForIndexing(p)
}

func BLVPostFromPostForIndexing(post *model.PostForIndexing) *BLVPost {
	return &BLVPost{
		ID:        post.Id,
		TeamID:    post.TeamId,
		ChannelID: post.ChannelId,
		UserID:    post.UserId,
		CreateAt:  post.CreateAt,
		Message:   post.Message,
		Type:      post.Type,
		Hashtags:  strings.Fields(post.Hashtags),
	}
}

func BLVFileFromFileInfo(fileInfo *model.FileInfo, channelID string) *BLVFile {
	return &BLVFile{
		Id:        fileInfo.Id,
		ChannelID: channelID,
		CreatorID: fileInfo.CreatorId,
		CreateAt:  fileInfo.CreateAt,
		Content:   fileInfo.Content,
		Extension: fileInfo.Extension,
		Name:      fileInfo.Name,
	}
}

func BLVFileFromFileForIndexing(file *model.FileForIndexing) *BLVFile {
	return &BLVFile{
		Id:        file.Id,
		ChannelID: file.ChannelId,
		CreatorID: file.CreatorId,
		CreateAt:  file.CreateAt,
		Content:   file.Content,
		Extension: file.Extension,
		Name:      file.Name,
	}
}
