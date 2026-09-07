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

// accessChannelSurface is one API call the access_channel policy has to cover.
// wantDeniedStatus and wantDeniedErrorID say what the surface reports on a denial:
// most return 403 with the distinct id, but a few deliberately differ — getPostInfo
// hides behind a 404 so a denial is indistinguishable from a missing post.
type accessChannelSurface struct {
	name              string
	call              func(t *testing.T, f *accessChannelFixture) (*model.Response, error)
	wantDeniedStatus  int
	wantDeniedErrorID string
}

const abacDeniedErrorID = "api.channel.access_channel.abac_denied.app_error"

// accessChannelFixture is what the surfaces act on. post is authored by the acting
// session: th.BasicPost belongs to TeamAdminUser, which would make the post
// surfaces fail RBAC on the *_others_posts permissions before access_channel is
// ever consulted.
type accessChannelFixture struct {
	th   *TestHelper
	post *model.Post
}

func accessChannelSurfaces() []accessChannelSurface {
	get := func(name string, fn func(t *testing.T, f *accessChannelFixture) (*model.Response, error)) accessChannelSurface {
		return accessChannelSurface{name: name, call: fn, wantDeniedStatus: http.StatusForbidden, wantDeniedErrorID: abacDeniedErrorID}
	}

	return []accessChannelSurface{
		get("channel fetch by id", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannel(context.Background(), f.th.BasicChannel.Id)
			return resp, err
		}),
		get("channel fetch by name", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelByName(context.Background(), f.th.BasicChannel.Name, f.th.BasicTeam.Id, "")
			return resp, err
		}),
		get("channel fetch by name for team name", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelByNameForTeamName(context.Background(), f.th.BasicChannel.Name, f.th.BasicTeam.Name, "")
			return resp, err
		}),
		get("channel unread", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelUnread(context.Background(), f.th.BasicChannel.Id, f.th.BasicUser.Id)
			return resp, err
		}),
		get("channel stats", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelStats(context.Background(), f.th.BasicChannel.Id, "", false)
			return resp, err
		}),
		get("channel members", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMembers(context.Background(), f.th.BasicChannel.Id, 0, 60, "")
			return resp, err
		}),
		get("single channel member", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMember(context.Background(), f.th.BasicChannel.Id, f.th.BasicUser.Id, "")
			return resp, err
		}),
		get("channel members by ids", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMembersByIds(context.Background(), f.th.BasicChannel.Id, []string{f.th.BasicUser.Id})
			return resp, err
		}),
		get("channel member timezones", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMembersTimezones(context.Background(), f.th.BasicChannel.Id)
			return resp, err
		}),
		get("pinned posts", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPinnedPosts(context.Background(), f.th.BasicChannel.Id, "")
			return resp, err
		}),
		get("posts for channel", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostsForChannel(context.Background(), f.th.BasicChannel.Id, 0, 60, "", false, false)
			return resp, err
		}),
		get("posts around last unread", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostsAroundLastUnread(context.Background(), f.th.BasicUser.Id, f.th.BasicChannel.Id, 20, 20, false)
			return resp, err
		}),
		get("single post", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPost(context.Background(), f.post.Id, "")
			return resp, err
		}),
		get("post thread", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostThread(context.Background(), f.post.Id, "", false)
			return resp, err
		}),
		get("post edit history", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetEditHistoryForPost(context.Background(), f.post.Id)
			return resp, err
		}),
		{
			// A denial has to look like a missing post here, not a forbidden one,
			// or the endpoint confirms the post exists to a session that cannot
			// see its channel.
			name: "post info returns not found",
			call: func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
				_, resp, err := f.th.Client.GetPostInfo(context.Background(), f.post.Id)
				return resp, err
			},
			wantDeniedStatus:  http.StatusNotFound,
			wantDeniedErrorID: "app.post.get.app_error",
		},
		get("post create", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.th.BasicChannel.Id, Message: "denied"})
			return resp, err
		}),
		get("post update", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			post := f.post.Clone()
			post.Message = "updated"
			_, resp, err := f.th.Client.UpdatePost(context.Background(), post.Id, post)
			return resp, err
		}),
		get("post patch", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			message := "patched"
			_, resp, err := f.th.Client.PatchPost(context.Background(), f.post.Id, &model.PostPatch{Message: &message})
			return resp, err
		}),
		get("post delete", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			resp, err := f.th.Client.DeletePost(context.Background(), f.post.Id)
			return resp, err
		}),
		get("post file infos", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetFileInfosForPost(context.Background(), f.post.Id, "")
			return resp, err
		}),
		get("read marker", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.ViewChannel(context.Background(), f.th.BasicUser.Id, &model.ChannelView{ChannelId: f.th.BasicChannel.Id})
			return resp, err
		}),
		get("save reaction", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.SaveReaction(context.Background(), &model.Reaction{
				UserId:    f.th.BasicUser.Id,
				PostId:    f.post.Id,
				EmojiName: "+1",
			})
			return resp, err
		}),
		get("get reactions", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetReactions(context.Background(), f.post.Id)
			return resp, err
		}),
		get("follow thread", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			resp, err := f.th.Client.UpdateThreadFollowForUser(context.Background(), f.th.BasicUser.Id, f.th.BasicTeam.Id, f.post.Id, true)
			return resp, err
		}),
		get("set post unread", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			resp, err := f.th.Client.SetPostUnread(context.Background(), f.th.BasicUser.Id, f.post.Id, true)
			return resp, err
		}),
		get("upsert draft", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UpsertDraft(context.Background(), &model.Draft{
				UserId:    f.th.BasicUser.Id,
				ChannelId: f.th.BasicChannel.Id,
				Message:   "denied",
			})
			return resp, err
		}),
		get("channel bookmarks", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.ListChannelBookmarksForChannel(context.Background(), f.th.BasicChannel.Id, 0)
			return resp, err
		}),
		get("users in channel", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetUsersInChannel(context.Background(), f.th.BasicChannel.Id, 0, 60, "")
			return resp, err
		}),
		get("channel member counts by group", func(t *testing.T, f *accessChannelFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMemberCountsByGroup(context.Background(), f.th.BasicChannel.Id, false, "")
			return resp, err
		}),
	}
}

// isAccessChannelDenial reports whether err is the access_channel denial, in the
// shape the surface reports it.
func isAccessChannelDenial(err error, wantID string) bool {
	appErr, ok := err.(*model.AppError)
	return ok && appErr.Id == wantID
}

// accessChannelEvaluation matches only the PDP calls for our action, so the
// pre-existing file-attachment actions can be answered separately.
var accessChannelEvaluation = mock.MatchedBy(func(req model.AccessRequest) bool {
	return req.Action == model.AccessControlPolicyActionAccessChannel
})

// setupAccessChannelAPI returns a helper with access_channel enforceable and a
// mock PDP that answers our action with `allow`. The file-attachment actions some
// of these surfaces also evaluate are answered permissively, so only access_channel
// is under test.
func setupAccessChannelAPI(t *testing.T, allow bool) (*accessChannelFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.AccessChannelABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	// Authored before the mock is installed, so creating it is not itself a
	// surface under test.
	post := th.CreatePost(t)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, accessChannelEvaluation).
		Return(model.AccessDecision{Decision: allow}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return &accessChannelFixture{th: th, post: post}, mockACS
}

func installMockACS(t *testing.T, th *TestHelper) *mocks.AccessControlServiceInterface {
	t.Helper()

	mockACS := &mocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })
	return mockACS
}

// TestAccessChannelDeniedSurfaces walks every surface the spec puts behind
// access_channel and asserts the denial reaches the wire with the id clients
// switch on. One helper for the whole table: a denial mutates nothing.
func TestAccessChannelDeniedSurfaces(t *testing.T) {
	f, _ := setupAccessChannelAPI(t, false)

	for _, surface := range accessChannelSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, f)
			require.Error(t, err, "surface must not succeed while the policy denies")
			require.NotNil(t, resp)
			require.Equal(t, surface.wantDeniedStatus, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, surface.wantDeniedErrorID, appErr.Id,
				"clients switch on this id to tell a policy denial from being removed from the channel")
		})
	}
}

// TestAccessChannelAllowedSurfaces is the other half: an allow decision must never
// be what blocks a surface.
//
// It asserts the absence of a policy denial rather than the absence of any error,
// because several of these endpoints have their own preconditions — an unedited
// post has no edit history, and deleting a post makes the later post surfaces
// return not-found. Those are the endpoints' own behaviour and not what is under
// test here; the deny table above is what pins the positive contract.
func TestAccessChannelAllowedSurfaces(t *testing.T) {
	f, _ := setupAccessChannelAPI(t, true)

	for _, surface := range accessChannelSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				require.False(t, isAccessChannelDenial(err, surface.wantDeniedErrorID),
					"an allow decision must not deny the surface: %v", err)
			}
		})
	}
}

// TestAccessChannelFlagOffCostsNothing pins the inert path: with the sub-flag off
// no surface asks the PDP about access_channel at all. The file-attachment actions
// are still evaluated — they are behind the umbrella flag, not this one — so the
// assertion is scoped to our action rather than to the PDP as a whole.
func TestAccessChannelFlagOffCostsNothing(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.AccessChannelABACPermission = false
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := installMockACS(t, th)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	f := &accessChannelFixture{th: th, post: th.CreatePost(t)}
	for _, surface := range accessChannelSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				require.False(t, isAccessChannelDenial(err, abacDeniedErrorID),
					"nothing should be denied by a flag that is off: %v", err)
			}
		})
	}

	mockACS.AssertNotCalled(t, "ActionHasPermissionPolicy", mock.Anything, mock.Anything)
	mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, accessChannelEvaluation)
}
