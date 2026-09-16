// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// setupBurnOnReadABAC returns a helper with burn-on-read, permission policies
// and ABAC all enabled, plus a mock PDP installed in place of the real access
// control service. The mock denies create_burn_on_read_post and allows every
// other action, so a failure points at this action's gate rather than at some
// unrelated evaluation the request happens to make.
func setupBurnOnReadABAC(t *testing.T, borAllowed bool) *TestHelper {
	th := SetupEnterprise(t).InitBasic(t)

	enableBurnOnReadFeature(th)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.BurnOnRead = true
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.BurnOnReadABACPermission = true
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		*cfg.ServiceSettings.ScheduledPosts = true
	})

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionCreateBurnOnReadPost
	})).Return(model.AccessDecision{Decision: borAllowed}, (*model.AppError)(nil))

	// Anything else the request evaluates must not be what fails the test.
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))

	return th
}

// denyBurnOnReadPolicy swaps in a PDP that denies create_burn_on_read_post and allows
// everything else, for the cases where a policy tightens after a post was scheduled.
func denyBurnOnReadPolicy(th *TestHelper) {
	denyACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = denyACS
	denyACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionCreateBurnOnReadPost
	})).Return(model.AccessDecision{Decision: false}, (*model.AppError)(nil))
	denyACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil))
}

func burnOnReadScheduledPost(th *TestHelper) *model.ScheduledPost {
	return &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "scheduled burn on read message",
			Type:      model.PostTypeBurnOnRead,
		},
		ScheduledAt: model.GetMillis() + 100000,
	}
}

// The policy check lives in postBurnOnReadCheckWithContext, which both
// createPostChecks and scheduledPostChecks call. These three subtests are the
// three entry points that reach it; they exist to catch the two paths drifting
// apart, since nothing in the code prevents that.
func TestBurnOnReadABACEnforcementDenies(t *testing.T) {
	th := setupBurnOnReadABAC(t, false)

	t.Run("createPost", func(t *testing.T) {
		_, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "burn on read message",
			Type:      model.PostTypeBurnOnRead,
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("createScheduledPost", func(t *testing.T) {
		_, resp, err := th.Client.CreateScheduledPost(context.Background(), burnOnReadScheduledPost(th))
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("updateScheduledPost", func(t *testing.T) {
		// The post has to exist before it can be updated, so schedule it while
		// the action is allowed and only then deny — this is the case where a
		// policy tightens after a post was already scheduled.
		allowed := setupBurnOnReadABAC(t, true)
		created, _, err := allowed.Client.CreateScheduledPost(context.Background(), burnOnReadScheduledPost(allowed))
		require.NoError(t, err)
		require.NotNil(t, created)

		denyBurnOnReadPolicy(allowed)

		created.Message = "updated while denied"
		_, resp, err := allowed.Client.UpdateScheduledPost(context.Background(), created)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	// The type is immutable, so the checks have to run against the stored one rather
	// than the request body. A client that leaves type unset — mobile's reschedule
	// builds its payload field by field and omits it — would otherwise be checked as
	// though it were editing an ordinary scheduled post.
	t.Run("updateScheduledPost with type unset by the client", func(t *testing.T) {
		allowed := setupBurnOnReadABAC(t, true)
		created, _, err := allowed.Client.CreateScheduledPost(context.Background(), burnOnReadScheduledPost(allowed))
		require.NoError(t, err)
		require.NotNil(t, created)

		denyBurnOnReadPolicy(allowed)

		created.Message = "updated while denied"
		created.Type = ""
		_, resp, err := allowed.Client.UpdateScheduledPost(context.Background(), created)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	// The action governs burn-on-read specifically. A deny must not stop the
	// user posting normally in the same channel, which is the failure mode if
	// the check is ever hoisted above the post-type test.
	t.Run("ordinary post is unaffected", func(t *testing.T) {
		created, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "ordinary message",
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
	})
}

func TestBurnOnReadABACEnforcementAllows(t *testing.T) {
	th := setupBurnOnReadABAC(t, true)

	t.Run("createPost", func(t *testing.T) {
		created, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "burn on read message",
			Type:      model.PostTypeBurnOnRead,
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, model.PostTypeBurnOnRead, created.Type)
	})

	t.Run("createScheduledPost", func(t *testing.T) {
		created, resp, err := th.Client.CreateScheduledPost(context.Background(), burnOnReadScheduledPost(th))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, created)
	})
}

// With the sub-flag off the action is not evaluated at all, so a PDP that would
// deny it has no effect. This is the client-side gate's counterpart: the webapp
// hides the row, and the server behaves as though the action does not exist.
func TestBurnOnReadABACEnforcementSkippedWhenFlagOff(t *testing.T) {
	th := setupBurnOnReadABAC(t, false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.BurnOnReadABACPermission = false
	})

	created, resp, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "burn on read message",
		Type:      model.PostTypeBurnOnRead,
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	require.Equal(t, model.PostTypeBurnOnRead, created.Type)
}
