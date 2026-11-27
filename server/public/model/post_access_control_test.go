// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParsePostAccessControlResource(t *testing.T) {
	id := NewId()

	t.Run("round trips a well-formed value", func(t *testing.T) {
		value := NewPostAccessControlResource("com.mattermost.conflux", "page", id, "view")
		parsed, err := ParsePostAccessControlResource(value)
		require.NoError(t, err)
		assert.Equal(t, &PostAccessControlResource{
			PluginID:     "com.mattermost.conflux",
			ResourceType: "page",
			PolicyType:   "com.mattermost.conflux:page",
			ResourceID:   id,
			Action:       "view",
		}, parsed)
		assert.Equal(t, value, parsed.String())
	})

	for name, value := range map[string]string{
		"empty":               "",
		"too few parts":       "com.mattermost.conflux:page:" + id,
		"too many parts":      "com.mattermost.conflux:page:" + id + ":view:extra",
		"bad plugin id":       "Not A Plugin:page:" + id + ":view",
		"bad resource type":   "com.mattermost.conflux:Page Type:" + id + ":view",
		"bad resource id":     "com.mattermost.conflux:page:short:view",
		"bad action":          "com.mattermost.conflux:page:" + id + ":View Action",
		"missing plugin type": ":page:" + id + ":view",
	} {
		t.Run("rejects "+name, func(t *testing.T) {
			_, err := ParsePostAccessControlResource(value)
			require.Error(t, err)
		})
	}
}

func TestPostAccessControlResourceProp(t *testing.T) {
	id := NewId()
	value := NewPostAccessControlResource("com.mattermost.conflux", "page", id, "view")

	t.Run("GetAccessControlResource reads only string values", func(t *testing.T) {
		var nilPost *Post
		assert.Equal(t, "", nilPost.GetAccessControlResource())

		post := &Post{}
		assert.Equal(t, "", post.GetAccessControlResource())
		post.AddProp(PostPropsAccessControlResource, 42)
		assert.Equal(t, "", post.GetAccessControlResource())
		post.AddProp(PostPropsAccessControlResource, value)
		assert.Equal(t, value, post.GetAccessControlResource())
	})

	t.Run("SanitizeProps strips it for local and remote posts", func(t *testing.T) {
		post := &Post{}
		post.AddProp(PostPropsAccessControlResource, value)
		post.SanitizeProps()
		assert.Equal(t, "", post.GetAccessControlResource())

		remote := &Post{RemoteId: NewPointer("remote")}
		remote.AddProp(PostPropsAccessControlResource, value)
		remote.SanitizeProps()
		assert.Equal(t, "", remote.GetAccessControlResource())
	})

	t.Run("SanitizeNonIdentityProps keeps it", func(t *testing.T) {
		post := &Post{}
		post.AddProp(PostPropsAccessControlResource, value)
		post.SanitizeNonIdentityProps()
		assert.Equal(t, value, post.GetAccessControlResource())
	})

	t.Run("PreserveIdentityPropsFrom carries it across an edit", func(t *testing.T) {
		old := &Post{}
		old.AddProp(PostPropsAccessControlResource, value)
		edited := &Post{}
		edited.PreserveIdentityPropsFrom(old)
		assert.Equal(t, value, edited.GetAccessControlResource())
	})

	t.Run("it is an integrations-reserved prop", func(t *testing.T) {
		post := &Post{}
		post.AddProp(PostPropsAccessControlResource, value)
		assert.Contains(t, post.ContainsIntegrationsReservedProps(), PostPropsAccessControlResource)
	})
}
