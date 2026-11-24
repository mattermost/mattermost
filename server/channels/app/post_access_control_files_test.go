// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func createMarkedPost(t *testing.T, th *TestHelper, value string) *model.Post {
	t.Helper()
	post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "marked"}
	post.AddProp(model.PostPropsAccessControlResource, value)
	post, appErr := th.SetupPluginAPI().CreatePost(post)
	require.Nil(t, appErr)
	return post
}

func TestGetPostsByIdsForUserAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	plain := th.CreatePost(t, th.BasicChannel)
	marked := createMarkedPost(t, th, testPostResource(resourceID))
	ids := []string{plain.Id, marked.Id}

	idsOf := func(posts []*model.Post) []string {
		var out []string
		for _, p := range posts {
			out = append(out, p.Id)
		}
		return out
	}

	t.Run("denied users do not get marked posts", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		posts, _, appErr := th.App.GetPostsByIdsForUser(th.Context, th.BasicUser2.Id, ids)
		require.Nil(t, appErr)
		assert.Equal(t, []string{plain.Id}, idsOf(posts))
	})

	t.Run("allowed users get marked posts", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		posts, _, appErr := th.App.GetPostsByIdsForUser(th.Context, th.BasicUser.Id, ids)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, ids, idsOf(posts))
	})

	t.Run("the userless lookup is unfiltered", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		posts, _, appErr := th.App.GetPostsByIds(ids)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, ids, idsOf(posts))
	})

	t.Run("flag off", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PostAccessControlResource = false })

		posts, _, appErr := th.App.GetPostsByIdsForUser(th.Context, th.BasicUser2.Id, ids)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, ids, idsOf(posts))
	})
}

func TestFileInfoAllowedByAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	plain := th.CreatePost(t, th.BasicChannel)
	marked := createMarkedPost(t, th, testPostResource(resourceID))

	markedFile := th.CreateFileInfo(t, th.BasicUser.Id, marked.Id, th.BasicChannel.Id)
	plainFile := th.CreateFileInfo(t, th.BasicUser.Id, plain.Id, th.BasicChannel.Id)
	orphanFile := th.CreateFileInfo(t, th.BasicUser.Id, "", th.BasicChannel.Id)
	goneFile := th.CreateFileInfo(t, th.BasicUser.Id, model.NewId(), th.BasicChannel.Id)

	t.Run("denied user", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		assert.False(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser2.Id, markedFile))
		assert.True(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser2.Id, plainFile))
		assert.True(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser2.Id, orphanFile))
		assert.True(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser2.Id, goneFile))
	})

	t.Run("allowed user", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		assert.True(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser.Id, markedFile))
	})

	t.Run("flag off", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PostAccessControlResource = false })

		assert.True(t, th.App.FileInfoAllowedByAccessControlResource(th.Context, th.BasicUser2.Id, markedFile))
	})
}

func TestSearchFilesAccessControlResource(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		enablePostAccessControlResource(cfg)
		*cfg.ServiceSettings.EnableFileSearch = true
		*cfg.ElasticsearchSettings.EnableSearching = false
	}).InitBasic(t)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	plain := th.CreatePost(t, th.BasicChannel)
	marked := createMarkedPost(t, th, testPostResource(resourceID))

	saveFile := func(post *model.Post) *model.FileInfo {
		info, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			CreatorId: th.BasicUser.Id,
			PostId:    post.Id,
			ChannelId: post.ChannelId,
			Name:      "acrfilesearch",
			Path:      "acrfilesearch/" + model.NewId(),
			Extension: "jpg",
			MimeType:  "image/jpeg",
		})
		require.NoError(t, err)
		return info
	}
	plainFile := saveFile(plain)
	markedFile := saveFile(marked)

	t.Run("a denied file is dropped from results", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		results, _, appErr := th.App.SearchFilesInTeamForUser(th.Context, "acrfilesearch", th.BasicUser2.Id, th.BasicTeam.Id, false, false, 0, 0, 60)
		require.Nil(t, appErr)
		assert.Equal(t, []string{plainFile.Id}, results.Order)
		assert.Contains(t, results.FileInfos, plainFile.Id)
		assert.NotContains(t, results.FileInfos, markedFile.Id)
	})

	t.Run("an allowed user sees both", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		results, _, appErr := th.App.SearchFilesInTeamForUser(th.Context, "acrfilesearch", th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, 0, 60)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, []string{plainFile.Id, markedFile.Id}, results.Order)
	})

	t.Run("flag off", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.PostAccessControlResource = false })

		results, _, appErr := th.App.SearchFilesInTeamForUser(th.Context, "acrfilesearch", th.BasicUser2.Id, th.BasicTeam.Id, false, false, 0, 0, 60)
		require.Nil(t, appErr)
		assert.ElementsMatch(t, []string{plainFile.Id, markedFile.Id}, results.Order)
	})
}
