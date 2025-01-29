// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/url"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	MaxLineLength = 10000

	URLRegexpRE       = `(\b|^)(?:https?:\/\/)?[a-zA-Z0-9-.]+\.[a-z]+(\s|\)?[a-zA-Z0-9\-._~:/?#\[\]@!$&'\(\)*\+,;=]*)(\b|$)`
	URLMarkdownLinkRE = `(\[[^\]]+\]\([a-zA-Z0-9\-._~:/?#\[\]@!$&'\(\)*\+,;=]+\))`
	EmailRE           = `^[^\s"]+@[^\s"]+$`

	IndexBasePosts       = "posts"
	IndexBasePosts_MONTH = IndexBasePosts + "month"
	IndexBaseChannels    = "channels"
	IndexBaseUsers       = "users"
	IndexBaseFiles       = "files"

	// At the moment, this number is hardcoded. If needed, we can expose
	// this to the config.
	BulkFlushInterval = 5 * time.Second
)

var (
	urlRe          = regexp.MustCompile(URLRegexpRE)
	markdownLinkRe = regexp.MustCompile(URLMarkdownLinkRE)
)

type ESPost struct {
	Id          string   `json:"id"`
	TeamId      string   `json:"team_id"`
	ChannelId   string   `json:"channel_id"`
	UserId      string   `json:"user_id"`
	CreateAt    int64    `json:"create_at"`
	Message     string   `json:"message"`
	Type        string   `json:"type"`
	Hashtags    []string `json:"hashtags"`
	Attachments string   `json:"attachments"`
	URLs        []string `json:"urls"`
}

type ESFile struct {
	Id        string `json:"id"`
	CreatorId string `json:"creator_id"`
	ChannelId string `json:"channel_id"`
	PostId    string `json:"post_id"`
	CreateAt  int64  `json:"create_at"`
	Content   string `json:"content"`
	Extension string `json:"extension"`
	Name      string `json:"name"`
}

type ESChannel struct {
	Id            string            `json:"id"`
	Type          model.ChannelType `json:"type"`
	DeleteAt      int64             `json:"delete_at"`
	UserIDs       []string          `json:"user_ids"`
	TeamId        string            `json:"team_id"`
	TeamMemberIDs []string          `json:"team_member_ids"`
	NameSuggest   []string          `json:"name_suggestions"`
}

type ESUser struct {
	Id                         string   `json:"id"`
	SuggestionsWithFullname    []string `json:"suggestions_with_fullname"`
	SuggestionsWithoutFullname []string `json:"suggestions_without_fullname"`
	DeleteAt                   int64    `json:"delete_at"`
	Roles                      []string `json:"roles"`
	TeamsIds                   []string `json:"team_id"`
	ChannelsIds                []string `json:"channel_id"`
}

func ESPostFromPost(post *model.Post, teamId string) (*ESPost, error) {
	p := &model.PostForIndexing{
		TeamId: teamId,
	}
	err := post.ShallowCopy(&p.Post)
	if err != nil {
		return nil, err
	}
	return ESPostFromPostForIndexing(p), nil
}

func ESPostFromPostForIndexing(post *model.PostForIndexing) *ESPost {
	searchPost := ESPost{
		Id:        post.Id,
		TeamId:    post.TeamId,
		ChannelId: post.ChannelId,
		UserId:    post.UserId,
		CreateAt:  post.CreateAt,
		Message:   post.Message,
		Type:      post.Type,
		Hashtags:  strings.Fields(post.Hashtags),
	}

	var searchAttachments []string

	if attachments := post.GetProp("attachments"); attachments != nil {
		attachmentsInterfaceArray, ok := attachments.([]any)
		if ok {
			for _, attachment := range attachmentsInterfaceArray {
				if attachment != nil {
					if attachmentText := attachment.(map[string]any)["text"]; attachmentText != nil {
						searchAttachments = append(searchAttachments, attachmentText.(string))
					}
				}
			}
		}

		attachmentsArray, ok := attachments.([]*model.SlackAttachment)
		if ok {
			for _, attachment := range attachmentsArray {
				if attachment != nil {
					searchAttachments = append(searchAttachments, attachment.Text)
				}
			}
		}
	}

	searchPost.Attachments = strings.Join(searchAttachments, " ")

	urls := extractURLsFromMessage(post.Message)
	if len(urls) > 0 {
		searchPost.URLs = urls
	}

	if searchPost.Type == "" {
		searchPost.Type = "default"
	}

	return &searchPost
}

func extractURLsFromMessage(message string) []string {
	message = markdownLinkRe.ReplaceAllString(message, "")
	urls := urlRe.FindAllString(message, -1)

	filteredURLs := make([]string, 0)
	for _, u := range urls {
		u = strings.TrimSpace(u)
		urlToCheck := u
		if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
			urlToCheck = "http://" + u
		}
		parsedURL, err := url.Parse(urlToCheck)
		if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
			continue
		}
		filteredURLs = append(filteredURLs, u)
	}

	return filteredURLs
}

func splitFilenameWords(name string) string {
	result := name
	result = strings.ReplaceAll(result, "-", " ")
	result = strings.ReplaceAll(result, ".", " ")
	return result
}

func ESFileFromFileInfo(file *model.FileInfo, channelId string) *ESFile {
	return &ESFile{
		Id:        file.Id,
		CreatorId: file.CreatorId,
		ChannelId: channelId,
		PostId:    file.PostId,
		CreateAt:  file.CreateAt,
		Content:   file.Content,
		Extension: file.Extension,
		Name:      file.Name + " " + splitFilenameWords(file.Name),
	}
}

func ESFileFromFileForIndexing(file *model.FileForIndexing) *ESFile {
	return &ESFile{
		Id:        file.Id,
		CreatorId: file.CreatorId,
		ChannelId: file.ChannelId,
		PostId:    file.PostId,
		CreateAt:  file.CreateAt,
		Content:   file.Content,
		Extension: file.Extension,
		Name:      file.Name + " " + splitFilenameWords(file.Name),
	}
}

func ESChannelFromChannel(channel *model.Channel, userIDs, teamMemberIDs []string) *ESChannel {
	displayNameInputs := searchengine.GetSuggestionInputsSplitBy(channel.DisplayName, " ")
	nameInputs := searchengine.GetSuggestionInputsSplitByMultiple(channel.Name, []string{"-", "_"})

	return &ESChannel{
		Id:            channel.Id,
		Type:          channel.Type,
		DeleteAt:      channel.DeleteAt,
		UserIDs:       userIDs,
		TeamId:        channel.TeamId,
		TeamMemberIDs: teamMemberIDs,
		NameSuggest:   append(displayNameInputs, nameInputs...),
	}
}

func ESUserFromUserAndTeams(user *model.User, teamsIds, channelsIds []string) *ESUser {
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

	return &ESUser{
		Id:                         user.Id,
		SuggestionsWithFullname:    append(usernameAndNicknameSuggestions, fullnameSuggestions...),
		SuggestionsWithoutFullname: usernameAndNicknameSuggestions,
		DeleteAt:                   user.DeleteAt,
		Roles:                      user.GetRoles(),
		TeamsIds:                   teamsIds,
		ChannelsIds:                channelsIds,
	}
}

func ESUserFromUserForIndexing(userForIndexing *model.UserForIndexing) *ESUser {
	user := &model.User{
		Id:        userForIndexing.Id,
		Username:  userForIndexing.Username,
		Nickname:  userForIndexing.Nickname,
		FirstName: userForIndexing.FirstName,
		Roles:     userForIndexing.Roles,
		LastName:  userForIndexing.LastName,
		CreateAt:  userForIndexing.CreateAt,
		DeleteAt:  userForIndexing.DeleteAt,
	}

	return ESUserFromUserAndTeams(user, userForIndexing.TeamsIds, userForIndexing.ChannelsIds)
}

func BuildPostIndexName(aggregateAfterDays int, unaggregatedBase string, aggregatedBase string, now time.Time, createAt int64) string {
	postTime := time.Unix(createAt/1000, 0)
	aggregateCutoffTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local).AddDate(0, 0, -aggregateAfterDays+1)

	if postTime.Before(aggregateCutoffTime) {
		return fmt.Sprintf("%v_%d_%02d", aggregatedBase, postTime.Year(), postTime.Month())
	}

	return fmt.Sprintf("%v_%d_%02d_%02d", unaggregatedBase, postTime.Year(), postTime.Month(), postTime.Day())
}

func NumIndexWorkers() int {
	const maxCPU = 4
	if runtime.NumCPU() > maxCPU {
		return maxCPU
	}
	return runtime.NumCPU()
}

// maxCertFileSizeBytes is an internal constant
// used to limit file size of ClientCert, ClientKey and CA.
const maxCertFileSizeBytes = 1_000_000 // 1MB

func ReadFileSafely(fb filestore.FileBackend, path string) ([]byte, error) {
	rd, err := fb.Reader(path)
	if err != nil {
		return nil, err
	}
	defer rd.Close()

	type resp struct {
		buf []byte
		err error
	}
	ch := make(chan resp)

	go func() {
		buf, err := io.ReadAll(io.LimitReader(rd, maxCertFileSizeBytes))
		ch <- resp{buf, err}
	}()

	select {
	case got := <-ch:
		return got.buf, got.err
	case <-time.After(10 * time.Second): // Adding a timeout for the file read.
		return nil, fmt.Errorf("timed out while reading file: %s", path)
	}
}

func GetMatchesForHit(highlights map[string][]string) ([]string, error) {
	matchMap := make(map[string]bool)

	parseMatches := func(snippets []string) error {
		// Highlighted matches are returned as an array of snippets of the post where
		// each snippet has the highlighted text surrounded by html <em> tags
		for _, snippet := range snippets {
			decoder := xml.NewDecoder(strings.NewReader(snippet))
			inMatch := false

			for {
				token, err := decoder.Token()
				if err == io.EOF {
					break
				} else if err != nil {
					return err
				}

				switch typed := token.(type) {
				case xml.StartElement:
					if typed.Name.Local == "em" {
						inMatch = true
					}
				case xml.EndElement:
					if typed.Name.Local == "em" {
						inMatch = false
					}
				case xml.CharData:
					if inMatch && len(typed) != 0 {
						match := string(typed)
						match = strings.Trim(match, "_*~")

						matchMap[match] = true
					}
				}
			}
		}

		return nil
	}

	if err := parseMatches(highlights["message"]); err != nil {
		return nil, err
	}
	if err := parseMatches(highlights["attachments"]); err != nil {
		return nil, err
	}
	if err := parseMatches(highlights["urls"]); err != nil {
		return nil, err
	}
	if err := parseMatches(highlights["hashtags"]); err != nil {
		return nil, err
	}

	var matches []string
	for match := range matchMap {
		matches = append(matches, match)
	}

	return matches, nil
}
