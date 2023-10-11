// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type BLVChannel struct {
	Id            string
	Type          model.ChannelType
	UserIDs       []string
	TeamId        []string
	TeamMemberIDs []string
	NameSuggest   []string
}

type BLVUser struct {
	Id                         string
	SuggestionsWithFullname    []string
	SuggestionsWithoutFullname []string
	TeamsIds                   []string
	ChannelsIds                []string
}

type BLVPost struct {
	Id          string
	TeamId      string
	ChannelId   string
	UserId      string
	CreateAt    int64
	Message     string
	Type        string
	Hashtags    []string
	Attachments string
}

type BLVFile struct {
	Id        string
	CreatorId string
	ChannelId string
	CreateAt  int64
	Name      string
	Content   string
	Extension string
}

func BLVChannelFromChannel(channel *model.Channel, userIDs, teamMemberIDs []string) *BLVChannel {
	displayNameInputs := searchengine.GetSuggestionInputsSplitBy(channel.DisplayName, " ")
	nameInputs := searchengine.GetSuggestionInputsSplitByMultiple(channel.Name, []string{"-", "_"})

	return &BLVChannel{
		Id:            channel.Id,
		Type:          channel.Type,
		TeamId:        []string{channel.TeamId},
		NameSuggest:   append(displayNameInputs, nameInputs...),
		UserIDs:       userIDs,
		TeamMemberIDs: teamMemberIDs,
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

	nicknameSuggestions := []string{}
	if user.Nickname != "" {
		nicknameSuggestions = searchengine.GetSuggestionInputsSplitBy(user.Nickname, " ")
	}

	usernameAndNicknameSuggestions := append(usernameSuggestions, nicknameSuggestions...)

	return &BLVUser{
		Id:                         user.Id,
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

func BLVPostFromPost(post *model.Post, teamId string) *BLVPost {
	p := &model.PostForIndexing{
		TeamId: teamId,
	}
	post.ShallowCopy(&p.Post)
	return BLVPostFromPostForIndexing(p)
}

func BLVPostFromPostForIndexing(post *model.PostForIndexing) *BLVPost {
	return &BLVPost{
		Id:        post.Id,
		TeamId:    post.TeamId,
		ChannelId: post.ChannelId,
		UserId:    post.UserId,
		CreateAt:  post.CreateAt,
		Message:   post.Message,
		Type:      post.Type,
		Hashtags:  strings.Fields(post.Hashtags),
	}
}

func splitFilenameWords(name string) string {
	result := name
	result = strings.ReplaceAll(result, "-", " ")
	result = strings.ReplaceAll(result, ".", " ")
	return result
}

func BLVFileFromFileInfo(fileInfo *model.FileInfo, channelId string) *BLVFile {
	return &BLVFile{
		Id:        fileInfo.Id,
		ChannelId: channelId,
		CreatorId: fileInfo.CreatorId,
		CreateAt:  fileInfo.CreateAt,
		Content:   fileInfo.Content,
		Extension: fileInfo.Extension,
		Name:      fileInfo.Name + " " + splitFilenameWords(fileInfo.Name),
	}
}

func BLVFileFromFileForIndexing(file *model.FileForIndexing) *BLVFile {
	return &BLVFile{
		Id:        file.Id,
		ChannelId: file.ChannelId,
		CreatorId: file.CreatorId,
		CreateAt:  file.CreateAt,
		Content:   file.Content,
		Extension: file.Extension,
		Name:      file.Name + " " + splitFilenameWords(file.Name),
	}
}
