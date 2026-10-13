// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
)

// GetPostIfAuthorized checks the read policy after RBAC, like the other read gates: a
// session RBAC already refuses must not pay for a policy evaluation, or learn from the
// error that the channel has a read rule.
func TestGetPostIfAuthorizedChecksReadAccessAfterRBAC(t *testing.T) {
	t.Run("a non-member gets the generic error without a policy evaluation", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		private, appErr := h.th.App.CreateChannel(h.th.Context, &model.Channel{
			DisplayName: "dn_" + model.NewId(),
			Name:        "name_" + model.NewId(),
			Type:        model.ChannelTypePrivate,
			TeamId:      h.th.BasicTeam.Id,
			CreatorId:   h.th.BasicUser2.Id,
		}, true)
		require.Nil(t, appErr)
		post, _, appErr := h.th.App.CreatePost(h.th.Context, &model.Post{
			UserId:    h.th.BasicUser2.Id,
			ChannelId: private.Id,
			Message:   "not for BasicUser",
		}, private, model.CreatePostFlags{})
		require.Nil(t, appErr)

		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		_, appErr, _ = h.th.App.GetPostIfAuthorized(h.rctx, post.Id, h.rctx.Session(), false)
		require.NotNil(t, appErr)
		require.Equal(t, "api.context.permissions.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("a member the policy denies gets the read-access error", func(t *testing.T) {
		h := setupChannelReadAccessTest(t)
		mockACS := h.mockACS(t)
		governed(mockACS)
		decides(mockACS, false)

		_, appErr, _ := h.th.App.GetPostIfAuthorized(h.rctx, h.th.BasicPost.Id, h.rctx.Session(), false)
		require.NotNil(t, appErr)
		require.Equal(t, "api.channel.channel_read_access.abac_denied.app_error", appErr.Id)
	})
}
