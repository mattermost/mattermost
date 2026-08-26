// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"sync"
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

// ClusterRecorder records the request bodies a fake search cluster receives. Its methods are safe
// to call from a test server handler.
type ClusterRecorder struct {
	mut           sync.Mutex
	postsTemplate []byte
	searchBodies  [][]byte
}

func (r *ClusterRecorder) RecordPostsTemplate(body []byte) {
	r.mut.Lock()
	defer r.mut.Unlock()

	r.postsTemplate = body
}

func (r *ClusterRecorder) RecordSearch(body []byte) {
	r.mut.Lock()
	defer r.mut.Unlock()

	r.searchBodies = append(r.searchBodies, body)
}

func (r *ClusterRecorder) PostsTemplate() []byte {
	r.mut.Lock()
	defer r.mut.Unlock()

	return r.postsTemplate
}

func (r *ClusterRecorder) SearchBodies() [][]byte {
	r.mut.Lock()
	defer r.mut.Unlock()

	return slices.Clone(r.searchBodies)
}

func (r *ClusterRecorder) ResetSearches() {
	r.mut.Lock()
	defer r.mut.Unlock()

	r.searchBodies = nil
}

// NodesPluginsResponse builds a response for the node info plugins metric, reporting one node per
// given list of plugin names.
func NodesPluginsResponse(nodePlugins ...[]string) string {
	nodes := make([]string, 0, len(nodePlugins))
	for i, pluginNames := range nodePlugins {
		plugins := make([]string, 0, len(pluginNames))
		for _, name := range pluginNames {
			plugins = append(plugins, fmt.Sprintf(`{"name":%q}`, name))
		}

		name := fmt.Sprintf("node-%d", i+1)
		nodes = append(nodes, fmt.Sprintf(`%q:{"name":%q,"plugins":[%s]}`, name, name, strings.Join(plugins, ",")))
	}

	return fmt.Sprintf(`{"_nodes":{"total":%d,"successful":%d,"failed":0},"nodes":{%s}}`,
		len(nodePlugins), len(nodePlugins), strings.Join(nodes, ","))
}

type indexTemplateRequest struct {
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

func parseIndexTemplate(t *testing.T, body []byte) indexTemplateRequest {
	t.Helper()

	var request indexTemplateRequest
	require.NoError(t, json.Unmarshal(body, &request))

	return request
}

// TemplatePropertyFields returns the sub-fields of the named property mapped to their analyzer, as
// declared by an index template request body.
func TemplatePropertyFields(t *testing.T, body []byte, property string) map[string]string {
	t.Helper()

	fields := map[string]string{}
	for name, field := range parseIndexTemplate(t, body).Template.Mappings.Properties[property].Fields {
		fields[name] = field.Analyzer
	}

	return fields
}

// TemplateAnalyzers returns the names of the analyzers declared by an index template request body.
func TemplateAnalyzers(t *testing.T, body []byte) []string {
	t.Helper()

	declared := parseIndexTemplate(t, body).Template.Settings.Analysis.Analyzer
	analyzers := make([]string, 0, len(declared))
	for name := range declared {
		analyzers = append(analyzers, name)
	}

	return analyzers
}

// SimpleQueryStringFields collects the field list of every simple_query_string clause in a search
// request body. The clauses are collected in an unspecified order.
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

// RequireOnlyBaseFields asserts that the given search field lists cover the base message and
// attachments fields and target no analyzer sub-field such as message.nori.
func RequireOnlyBaseFields(t *testing.T, fields [][]string) {
	t.Helper()

	require.Contains(t, fields, []string{"message"})
	require.Contains(t, fields, []string{"attachments"})
	for _, fieldList := range fields {
		for _, field := range fieldList {
			require.NotContains(t, field, ".", "unexpected analyzer sub-field in %v", fieldList)
		}
	}
}

func CheckMatchesEqual(t *testing.T, expected model.PostSearchMatches, actual map[string][]string) {
	a := assert.New(t)

	a.Len(actual, len(expected), "Received matches for a different number of posts")

	for postId, expectedMatches := range expected {
		a.ElementsMatch(expectedMatches, actual[postId], fmt.Sprintf("%v: expected %v, got %v", postId, expectedMatches, actual[postId]))
	}
}
