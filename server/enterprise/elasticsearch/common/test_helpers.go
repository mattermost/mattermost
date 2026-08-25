// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/password/hashers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
	if err := user.PreSave(hashers.GetLatestHasher()); err != nil {
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

// NodesPluginsResponse builds a single-node response for the node info plugins metric reporting the
// given plugin names.
func NodesPluginsResponse(pluginNames ...string) string {
	plugins := make([]string, 0, len(pluginNames))
	for _, name := range pluginNames {
		plugins = append(plugins, fmt.Sprintf(`{"name":%q}`, name))
	}

	return fmt.Sprintf(`{"_nodes":{"total":1,"successful":1,"failed":0},"nodes":{"node-1":{"name":"node-1","plugins":[%s]}}}`,
		strings.Join(plugins, ","))
}

// MessageMappingFields returns the message sub-fields mapped to their analyzer, plus the names of
// the analyzers declared by a posts index template request body.
func MessageMappingFields(t *testing.T, body []byte) (map[string]string, []string) {
	t.Helper()

	var request struct {
		Template struct {
			Settings struct {
				Analysis struct {
					Analyzer map[string]json.RawMessage `json:"analyzer"`
				} `json:"analysis"`
			} `json:"settings"`
			Mappings struct {
				Properties map[string]struct {
					Fields map[string]struct {
						Analyzer string `json:"analyzer"`
					} `json:"fields"`
				} `json:"properties"`
			} `json:"mappings"`
		} `json:"template"`
	}
	require.NoError(t, json.Unmarshal(body, &request))

	fields := map[string]string{}
	for name, field := range request.Template.Mappings.Properties["message"].Fields {
		fields[name] = field.Analyzer
	}

	analyzers := make([]string, 0, len(request.Template.Settings.Analysis.Analyzer))
	for name := range request.Template.Settings.Analysis.Analyzer {
		analyzers = append(analyzers, name)
	}

	return fields, analyzers
}

// SimpleQueryStringFields collects the field list of every simple_query_string clause in a search
// request body, in the order the clauses appear.
func SimpleQueryStringFields(t *testing.T, body []byte) [][]string {
	t.Helper()

	var doc any
	require.NoError(t, json.Unmarshal(body, &doc))

	var collected [][]string
	var walk func(node any)
	walk = func(node any) {
		switch typed := node.(type) {
		case map[string]any:
			if clause, ok := typed["simple_query_string"].(map[string]any); ok {
				rawFields, ok := clause["fields"].([]any)
				require.True(t, ok, "simple_query_string clause without fields: %v", clause)
				fields := make([]string, 0, len(rawFields))
				for _, rawField := range rawFields {
					field, ok := rawField.(string)
					require.True(t, ok, "non-string field name: %v", rawField)
					fields = append(fields, field)
				}
				collected = append(collected, fields)
			}
			for _, value := range typed {
				walk(value)
			}
		case []any:
			for _, value := range typed {
				walk(value)
			}
		}
	}
	walk(doc)

	return collected
}

func CheckMatchesEqual(t *testing.T, expected model.PostSearchMatches, actual map[string][]string) {
	a := assert.New(t)

	a.Len(actual, len(expected), "Received matches for a different number of posts")

	for postId, expectedMatches := range expected {
		a.ElementsMatch(expectedMatches, actual[postId], fmt.Sprintf("%v: expected %v, got %v", postId, expectedMatches, actual[postId]))
	}
}
