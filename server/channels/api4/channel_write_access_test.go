// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

const abacWriteDeniedErrorID = "api.channel.channel_write_access.abac_denied.app_error"

type channelWriteAccessSurface struct {
	name string
	call func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error)
}

// post is authored by the acting session: th.BasicPost belongs to TeamAdminUser,
// which would make the post surfaces fail RBAC on the *_others_posts permissions
// before channel_write_access is ever consulted.
type channelWriteAccessFixture struct {
	th   *TestHelper
	post *model.Post
}

var channelWriteAccessEvaluation = mock.MatchedBy(func(req model.AccessRequest) bool {
	return req.Action == model.AccessControlPolicyActionChannelWriteAccess
})

var channelReadAccessEvaluationForWrite = mock.MatchedBy(func(req model.AccessRequest) bool {
	return req.Action == model.AccessControlPolicyActionChannelReadAccess
})

// setupChannelWriteAccessAPI stands up a server where channel_write_access is
// governed and decides `allow`, and channel_read_access allows. Isolating the
// write action is the point: the gate consults both, so a read denial here would
// make every assertion ambiguous.
func setupChannelWriteAccessAPI(t *testing.T, allow bool) (*channelWriteAccessFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelAccessABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	// Authored before the mock is installed, so creating it is not itself a surface
	// under test.
	post := th.CreatePost(t)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, channelWriteAccessEvaluation).
		Return(model.AccessDecision{Decision: allow}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return &channelWriteAccessFixture{th: th, post: post}, mockACS
}

// Every write the action governs. A denial must reach each of these, whether it
// rides a permission choke point or an explicit gate in the handler.
func channelWriteAccessSurfaces() []channelWriteAccessSurface {
	write := func(name string, fn func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error)) channelWriteAccessSurface {
		return channelWriteAccessSurface{name: name, call: fn}
	}

	return []channelWriteAccessSurface{
		write("post create", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.th.BasicChannel.Id, Message: "denied"})
			return resp, err
		}),
		write("post patch", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			message := "patched"
			_, resp, err := f.th.Client.PatchPost(context.Background(), f.post.Id, &model.PostPatch{Message: &message})
			return resp, err
		}),
		write("post update", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			post := f.post.Clone()
			post.Message = "updated"
			_, resp, err := f.th.Client.UpdatePost(context.Background(), post.Id, post)
			return resp, err
		}),
		write("save reaction", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.SaveReaction(context.Background(), &model.Reaction{
				UserId:    f.th.BasicUser.Id,
				PostId:    f.post.Id,
				EmojiName: "+1",
			})
			return resp, err
		}),
		write("delete reaction", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.DeleteReaction(context.Background(), &model.Reaction{
				UserId:    f.th.BasicUser.Id,
				PostId:    f.post.Id,
				EmojiName: "+1",
			})
		}),
		write("upsert draft", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UpsertDraft(context.Background(), &model.Draft{
				UserId:    f.th.BasicUser.Id,
				ChannelId: f.th.BasicChannel.Id,
				Message:   "denied",
			})
			return resp, err
		}),
		write("create bookmark", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
				ChannelId:   f.th.BasicChannel.Id,
				DisplayName: "bookmark",
				LinkUrl:     "https://mattermost.com",
				Type:        model.ChannelBookmarkLink,
			})
			return resp, err
		}),
		write("patch channel", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			purpose := "patched purpose"
			_, resp, err := f.th.Client.PatchChannel(context.Background(), f.th.BasicChannel.Id, &model.ChannelPatch{Purpose: &purpose})
			return resp, err
		}),
		write("update channel", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			channel := f.th.BasicChannel
			channel.Purpose = "updated purpose"
			_, resp, err := f.th.Client.UpdateChannel(context.Background(), channel)
			return resp, err
		}),
		write("add channel member", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.AddChannelMember(context.Background(), f.th.BasicChannel.Id, f.th.BasicUser2.Id)
			return resp, err
		}),
		write("upload file", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UploadFile(context.Background(), []byte("data"), f.th.BasicChannel.Id, "test.txt")
			return resp, err
		}),
		// Last: it destroys the post the surfaces above act on, so anything after it
		// would fail for the wrong reason on the allowed run.
		write("post delete", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.DeletePost(context.Background(), f.post.Id)
		}),
	}
}

// Deliberately gated on read access rather than write: they assert "I can see
// this", not "I can write here". Leaving a channel is ungated outright, so a
// denied user is never trapped as a member.
func channelWriteAccessUngatedSurfaces() []channelWriteAccessSurface {
	ungated := func(name string, fn func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error)) channelWriteAccessSurface {
		return channelWriteAccessSurface{name: name, call: fn}
	}

	return []channelWriteAccessSurface{
		ungated("channel view", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.ViewChannel(context.Background(), f.th.BasicUser.Id, &model.ChannelView{ChannelId: f.th.BasicChannel.Id})
			return resp, err
		}),
		ungated("pin post", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.PinPost(context.Background(), f.post.Id)
		}),
		ungated("set post reminder", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.SetPostReminder(context.Background(), &model.PostReminder{
				PostId:     f.post.Id,
				UserId:     f.th.BasicUser.Id,
				TargetTime: model.GetMillis()/1000 + 3600,
			})
		}),
		ungated("follow thread", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.UpdateThreadFollowForUser(context.Background(), f.th.BasicUser.Id, f.th.BasicTeam.Id, f.post.Id, true)
		}),
		ungated("channel fetch", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannel(context.Background(), f.th.BasicChannel.Id)
			return resp, err
		}),
		ungated("post list", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostsForChannel(context.Background(), f.th.BasicChannel.Id, 0, 10, "", false, false)
			return resp, err
		}),
		// Last: it removes the acting user from the channel, so anything after it
		// would fail for the wrong reason.
		ungated("leave channel", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.RemoveUserFromChannel(context.Background(), f.th.BasicChannel.Id, f.th.BasicUser.Id)
		}),
	}
}

func TestChannelWriteAccessDeniedSurfaces(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, false)

	for _, surface := range channelWriteAccessSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, f)
			require.Error(t, err, "surface must not succeed while the policy denies")
			require.NotNil(t, resp)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, abacWriteDeniedErrorID, appErr.Id,
				"clients switch on this id to disable the editor and to tell a write denial from a read one")
		})
	}
}

func TestChannelWriteAccessAllowedSurfaces(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, true)

	for _, surface := range channelWriteAccessSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				require.False(t, isChannelReadAccessDenial(err, abacWriteDeniedErrorID),
					"channel_write_access allowed, so no surface may report a write denial: %v", err)
			}
		})
	}
}

// Reads are channel_read_access's question alone: a write denial must not hide a
// channel or its content.
func TestChannelWriteAccessDoesNotGateReads(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, false)

	for _, surface := range channelWriteAccessUngatedSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				require.False(t, isChannelReadAccessDenial(err, abacWriteDeniedErrorID),
					"channel_write_access must not gate this surface: %v", err)
				require.False(t, isChannelReadAccessDenial(err, abacDeniedErrorID),
					"channel_read_access allows here, so nothing may report a read denial: %v", err)
			}
		})
	}
}

// Assigning a reviewer is gated by neither channel-access policy. It writes to
// the review record rather than the channel, and content review is a team-level
// duty performed on channels the reviewer is deliberately not a member of — so
// binding triage to either policy would leave flagged posts in a restricted
// channel unassignable. Both actions deny here and the assignment still lands.
func TestChannelAccessDoesNotGateReviewerAssignment(t *testing.T) {
	f, _ := setupContentReviewerChannelAccess(t, false /* read */, false /* write */)

	resp, err := f.reviewerClient.AssignContentFlaggingReviewer(context.Background(), f.post.Id, f.reviewerID)
	require.NoError(t, err, "neither channel-access policy may gate reviewer assignment")
	require.NotNil(t, resp)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

// The truth table's third row: with a write policy in play, both channel-access
// policies must allow. The denial reports the read action, because that is what
// actually refused.
func TestChannelWriteAccessRequiresReadAccess(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelAccessABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, channelReadAccessEvaluationForWrite).
		Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	_, resp, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: th.BasicChannel.Id, Message: "denied"})
	require.Error(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	appErr, ok := err.(*model.AppError)
	require.True(t, ok, "expected an AppError, got %T", err)
	require.Equal(t, abacDeniedErrorID, appErr.Id,
		"a write refused by the read policy reports the read denial, so the client can tell why")
}

// The gate is inert until a channel_write_access policy governs the channel: a
// deployment that only restricts reading must not start refusing posts. This is
// the inverse of TestChannelWriteAccessRequiresReadAccess, and the reason
// TestChannelReadAccessDoesNotGateWrites is still true.
func TestChannelWriteAccessInertWithoutAWritePolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelAccessABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).
		Return(false, nil)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	// Everything denies. Only the absence of a write policy keeps the post alive.
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, nil)

	_, _, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: th.BasicChannel.Id, Message: "allowed"})
	require.NoError(t, err, "no channel_write_access policy governs, so the write gate must not fire")
}

// While the flag is off the gate short-circuits to allow, whatever the policy says.
func TestChannelWriteAccessFeatureFlagOff(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.ChannelAccessABACPermission = false
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, nil)

	_, _, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: th.BasicChannel.Id, Message: "allowed"})
	require.NoError(t, err, "the gate must be inert while ChannelAccessABACPermission is off")
}
