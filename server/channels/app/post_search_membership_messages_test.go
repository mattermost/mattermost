// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
)

// Search drops join/leave messages from a channel that hides them on every page, whether
// or not channel_read_access is enforced. The database search never returns system posts,
// so the hit comes from a search engine.
func TestSearchPostsForUserDropsSuppressedMembershipPosts(t *testing.T) {
	th := Setup(t).InitBasic(t)

	channel := th.BasicChannel.DeepCopy()
	channel.DisableJoinLeaveMessages = true
	_, appErr := th.App.UpdateChannel(th.Context, channel)
	require.Nil(t, appErr)

	leave, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		Type:      model.PostTypeLeaveChannel,
		Message:   "searchTerm left the channel",
	})
	require.NoError(t, err)
	kept, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "searchTerm",
	}, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	th.App.Srv().SetLicense(model.NewTestLicense("elastic_search"))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.EnableIndexing = true
		*cfg.ElasticsearchSettings.EnableSearching = true
	})
	es := &mocks.SearchEngineInterface{}
	es.On("SearchPosts", mock.Anything, mock.Anything, 0, 10).Return([]string{kept.Id, leave.Id}, nil, nil)
	es.On("Start").Return(nil).Maybe()
	es.On("IsActive").Return(true)
	es.On("IsHealthy").Return(true)
	es.On("IsSearchEnabled").Return(true)
	th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = es
	t.Cleanup(func() { th.App.Srv().Platform().SearchEngine.ElasticsearchEngine = nil })

	results, _, appErr := th.App.SearchPostsForUser(th.Context, "searchTerm", th.BasicUser.Id, th.BasicTeam.Id, false, false, 0, 0, 10)
	require.Nil(t, appErr)
	require.Equal(t, []string{kept.Id}, results.Order)
	require.NotContains(t, results.Posts, leave.Id)
	require.NotContains(t, results.Matches, leave.Id)
}
