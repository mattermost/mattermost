// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type postPropertyTestHelper struct {
	*TestHelper
	groupID string
}

func setupPostPropertyTest(t *testing.T) *postPropertyTestHelper {
	t.Helper()
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostAttributes = true
	}).InitBasic(t)

	// access_control answers only to an Enterprise licence, in the API and in its hooks.
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)

	return &postPropertyTestHelper{TestHelper: th, groupID: group.ID}
}

func (th *postPropertyTestHelper) registerPSAv2Group(t *testing.T) *model.PropertyGroup {
	t.Helper()
	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
		Name:    "other_psa_v2_" + model.NewId(),
		Version: model.PropertyGroupVersionV2,
	})
	require.Nil(t, appErr)
	return group
}

func (th *postPropertyTestHelper) createField(t *testing.T, groupID, name string) *model.PropertyField {
	t.Helper()
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    groupID,
		Name:       name,
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)
	return field
}

func (th *postPropertyTestHelper) setValue(t *testing.T, groupID, postID, fieldID, raw string) {
	t.Helper()
	_, appErr := th.App.UpsertPropertyValues(th.Context, []*model.PropertyValue{{
		TargetID:   postID,
		TargetType: model.PropertyValueTargetTypePost,
		GroupID:    groupID,
		FieldID:    fieldID,
		Value:      json.RawMessage(raw),
		CreatedBy:  th.BasicUser.Id,
		UpdatedBy:  th.BasicUser.Id,
	}}, model.PropertyValueTargetTypePost, postID, "")
	require.Nil(t, appErr)
}

func TestGetPostWithPropertyGroups(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("returns values for the requested group", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "sensitivity")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

		post, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
			model.GetPostOptions{PropertyGroup: model.AccessControlPropertyGroupName})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, post.Metadata)
		require.Len(t, post.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, post.Metadata.PropertyValues[0].FieldID)
		// A hydrated response always carries the flag, false on success, so a client can clear
		// a true it stored from an earlier failed lookup.
		require.NotNil(t, post.Metadata.PropertyValuesUnavailable)
		assert.False(t, *post.Metadata.PropertyValuesUnavailable)
	})

	// The server omits the flag when hydration was not requested, which decodes as nil. A client
	// reads that as "no information" and keeps what it stored.
	t.Run("an unhydrated response omits the unavailable flag", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "sensitivity")
		searchable := th.CreateMessagePost(t, "flagless"+model.NewId()[:8])
		th.setValue(t, th.groupID, searchable.Id, field.ID, `"confidential"`)

		post, resp, err := th.Client.GetPost(context.Background(), searchable.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, post.Metadata)
		assert.Empty(t, post.Metadata.PropertyValues)
		assert.Nil(t, post.Metadata.PropertyValuesUnavailable)

		list, resp, err := th.Client.SearchPosts(context.Background(), th.BasicTeam.Id, searchable.Message, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		found, ok := list.Posts[searchable.Id]
		require.True(t, ok, "the post should be found by search")
		require.NotNil(t, found.Metadata)
		assert.Empty(t, found.Metadata.PropertyValues)
		assert.Nil(t, found.Metadata.PropertyValuesUnavailable)
	})

	t.Run("an etag is served only when values are not requested", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		groupName := model.AccessControlPropertyGroupName
		field := th.createField(t, th.groupID, "sensitivity")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

		_, plainResp, err := th.Client.GetPost(context.Background(), th.BasicPost.Id, "")
		require.NoError(t, err)
		require.NotEmpty(t, plainResp.Etag)

		_, groupResp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
			model.GetPostOptions{PropertyGroup: groupName})
		require.NoError(t, err)
		assert.Empty(t, groupResp.Etag)

		post, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, plainResp.Etag,
			model.GetPostOptions{PropertyGroup: groupName})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, post)
		assert.Len(t, post.Metadata.PropertyValues, 1)
	})

	t.Run("parameter validation", func(t *testing.T) {
		th := setupPostPropertyTest(t)

		t.Run("a comma-separated value is treated as a single, invalid group name", func(t *testing.T) {
			otherGroup := th.registerPSAv2Group(t)
			_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
				model.GetPostOptions{PropertyGroup: model.AccessControlPropertyGroupName + "," + otherGroup.Name})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("the removed post_attributes group is a 404", func(t *testing.T) {
			_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
				model.GetPostOptions{PropertyGroup: "post_attributes"})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("unknown group is a 404", func(t *testing.T) {
			_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
				model.GetPostOptions{PropertyGroup: "nope"})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("session_attributes stays gated", func(t *testing.T) {
			_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
				model.GetPostOptions{PropertyGroup: model.SessionAttributesPropertyGroupName})
			require.Error(t, err)
			CheckNotImplementedStatus(t, resp)
		})
	})

	t.Run("combines include_deleted with property groups", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		opts := model.GetPostOptions{
			IncludeDeleted: true,
			PropertyGroup:  model.AccessControlPropertyGroupName,
		}

		field := th.createField(t, th.groupID, "sensitivity")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"confidential"`)

		_, err := th.SystemAdminClient.DeletePost(context.Background(), th.BasicPost.Id)
		require.NoError(t, err)

		// include_deleted still requires manage_system, group or no group.
		_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "", opts)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		post, resp, err := th.SystemAdminClient.GetPostWithOptions(context.Background(), th.BasicPost.Id, "", opts)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, th.BasicPost.Id, post.Id)
		// A deleted post is never hydrated, and that is not an unavailability either.
		assert.Empty(t, post.Metadata.PropertyValues)
		assert.Nil(t, post.Metadata.PropertyValuesUnavailable)
	})

	t.Run("accepts any PSAv2 group", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		otherGroup := th.registerPSAv2Group(t)

		field := th.createField(t, otherGroup.ID, "other-attr")
		th.setValue(t, otherGroup.ID, th.BasicPost.Id, field.ID, `"in-progress"`)

		post, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
			model.GetPostOptions{PropertyGroup: otherGroup.Name})
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, post.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, post.Metadata.PropertyValues[0].FieldID)
	})

	t.Run("a V1 group is rejected rather than returning nothing", func(t *testing.T) {
		th := setupPostPropertyTest(t)

		_, resp, err := th.Client.GetPostWithOptions(context.Background(), th.BasicPost.Id, "",
			model.GetPostOptions{PropertyGroup: model.ContentFlaggingGroupName})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)

		// And nothing leaks through the generic parameter for a post that does carry V1 values.
		post, plainResp, err := th.Client.GetPost(context.Background(), th.BasicPost.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, plainResp)
		assert.Empty(t, post.Metadata.PropertyValues)
	})
}

func TestGetPostListWithPropertyGroups(t *testing.T) {
	mainHelper.Parallel(t)

	// getPostsForChannel hydrates.
	t.Run("returns values on channel posts", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "priority")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"high"`)

		list, resp, err := th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, "",
			model.GetPostsOptions{Page: 0, PerPage: 60, PropertyGroup: model.AccessControlPropertyGroupName})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		post, ok := list.Posts[th.BasicPost.Id]
		require.True(t, ok, "BasicPost should be in the page")
		require.NotNil(t, post.Metadata)
		require.Len(t, post.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, post.Metadata.PropertyValues[0].FieldID)
	})

	// getPostThread hydrates.
	t.Run("returns values on post thread", func(t *testing.T) {
		th := setupPostPropertyTest(t)
		field := th.createField(t, th.groupID, "label")
		th.setValue(t, th.groupID, th.BasicPost.Id, field.ID, `"urgent"`)

		list, resp, err := th.Client.GetPostThreadWithOpts(context.Background(), th.BasicPost.Id, "",
			model.GetPostsOptions{PropertyGroup: model.AccessControlPropertyGroupName})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		post, ok := list.Posts[th.BasicPost.Id]
		require.True(t, ok, "root post should be in the thread")
		require.NotNil(t, post.Metadata)
		require.Len(t, post.Metadata.PropertyValues, 1)
		assert.Equal(t, field.ID, post.Metadata.PropertyValues[0].FieldID)
	})

	// Parameter validation on list endpoints mirrors the single-post endpoint.
	t.Run("parameter validation on list endpoint", func(t *testing.T) {
		th := setupPostPropertyTest(t)

		t.Run("a comma-separated value is treated as a single, invalid group name", func(t *testing.T) {
			otherGroup := th.registerPSAv2Group(t)
			_, resp, err := th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, "",
				model.GetPostsOptions{Page: 0, PerPage: 10, PropertyGroup: model.AccessControlPropertyGroupName + "," + otherGroup.Name})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("unknown group is a 404", func(t *testing.T) {
			_, resp, err := th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, "",
				model.GetPostsOptions{Page: 0, PerPage: 10, PropertyGroup: "nope"})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("a V1 group is rejected rather than returning nothing", func(t *testing.T) {
			_, resp, err := th.Client.GetPostsForChannelWithOpts(context.Background(), th.BasicChannel.Id, "",
				model.GetPostsOptions{Page: 0, PerPage: 10, PropertyGroup: model.ContentFlaggingGroupName})
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})
	})
}
