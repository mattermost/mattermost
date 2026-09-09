// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
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

// contentReviewerFixture is a flagged post with an attachment, in a private channel
// the reviewer is not a member of — the shape the as_content_reviewer surfaces exist
// to serve.
type contentReviewerFixture struct {
	th             *TestHelper
	reviewerClient *model.Client4
	channel        *model.Channel
	post           *model.Post
	fileID         string
	reviewerID     string
}

// setupContentReviewerAccessChannel builds the reviewer scenario, then installs a PDP
// answering access_channel with `allow`.
//
// The mock goes in last on purpose: uploading the file, creating the post and flagging
// it all pass through the same gates under test, so a denying PDP would fail the
// fixture rather than the assertion. The file-attachment actions are answered
// permissively so only access_channel is under test.
func setupContentReviewerAccessChannel(t *testing.T, allow bool) (*contentReviewerFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.AccessChannelABACPermission = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	// A separate user, so the reviewer is genuinely a non-member of the channel and
	// only reviewer status could let them read it.
	reviewer := th.CreateUser(t)
	require.Nil(t, setBasicCommonReviewerConfig(th, reviewer.Id))

	channel := th.CreateChannelWithClient(t, th.Client, model.ChannelTypePrivate)

	sent, fileErr := testutils.ReadTestFile("test.png")
	require.NoError(t, fileErr)
	fileResp, _, err := th.Client.UploadFile(context.Background(), sent, channel.Id, "test.png")
	require.NoError(t, err)
	require.NotEmpty(t, fileResp.FileInfos)

	post := th.CreatePostWithFilesWithClient(t, th.Client, channel, fileResp.FileInfos[0])

	resp, err := th.Client.FlagPostForContentReview(context.Background(), post.Id, &model.FlagContentRequest{
		Reason:  "Classification mismatch",
		Comment: "This is sensitive content",
	})
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	reviewerClient := th.CreateClient()
	_, _, err = reviewerClient.Login(context.Background(), reviewer.Email, reviewer.Password)
	require.NoError(t, err)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, accessChannelEvaluation).
		Return(model.AccessDecision{Decision: allow}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return &contentReviewerFixture{
		th:             th,
		reviewerClient: reviewerClient,
		channel:        channel,
		post:           post,
		fileID:         fileResp.FileInfos[0].Id,
		reviewerID:     reviewer.Id,
	}, mockACS
}

// contentReviewerSurface is one reviewer-only endpoint that reaches channel content
// or acts on it. Each of these was reachable with reviewer status alone.
type contentReviewerSurface struct {
	name string
	call func(t *testing.T, f *contentReviewerFixture) (*model.Response, error)
}

func contentReviewerSurfaces() []contentReviewerSurface {
	action := &model.FlagContentActionRequest{Comment: "reviewed"}

	return []contentReviewerSurface{
		{"channel fetch", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			_, resp, err := f.reviewerClient.GetChannelAsContentReviewer(context.Background(), f.channel.Id, "", f.post.Id)
			return resp, err
		}},
		{"file fetch", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			_, resp, err := f.reviewerClient.GetFileAsContentReviewer(context.Background(), f.fileID, f.post.Id)
			return resp, err
		}},
		{"flagged post fetch", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			_, resp, err := f.reviewerClient.GetContentFlaggedPost(context.Background(), f.post.Id)
			return resp, err
		}},
		{"flagging property values", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			_, resp, err := f.reviewerClient.GetPostPropertyValues(context.Background(), f.post.Id)
			return resp, err
		}},
		{"assign reviewer", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			return f.reviewerClient.AssignContentFlaggingReviewer(context.Background(), f.post.Id, f.reviewerID)
		}},
		{"keep flagged post", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			return f.reviewerClient.KeepFlaggedPost(context.Background(), f.post.Id, action)
		}},
		{"remove flagged post", func(t *testing.T, f *contentReviewerFixture) (*model.Response, error) {
			return f.reviewerClient.RemoveFlaggedPost(context.Background(), f.post.Id, action)
		}},
	}
}

// TestAccessChannelContentReviewerIsNotExempt pins that reviewing flagged content
// overrides channel membership but not the access_channel policy.
//
// getChannel and getFile evaluated the gate inside an `if !isContentReviewer` block,
// so a reviewer skipped it; the content-flagging endpoints never had it at all.
// getFile was the clearest of the two bugs: it still enforced the ABAC
// download_file_attachment action on the same request, honouring one ABAC action
// while skipping the one meant to be its prerequisite.
func TestAccessChannelContentReviewerIsNotExempt(t *testing.T) {
	f, _ := setupContentReviewerAccessChannel(t, false)

	for _, surface := range contentReviewerSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, f)
			require.Error(t, err, "the reviewer path must not bypass the access_channel policy")
			require.NotNil(t, resp)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, abacDeniedErrorID, appErr.Id)
		})
	}
}

// TestAccessChannelContentReviewerAllowed is the other half: gating reviewers must
// not break the review flow for a channel the policy allows. Without it the deny
// table above would still pass if the reviewer paths were broken outright.
//
// It asserts the absence of a policy denial rather than of any error, because these
// surfaces share one flagged post: keeping it resolves the flag the remove call then
// cannot act on. That is the endpoints' own behaviour, not what is under test.
func TestAccessChannelContentReviewerAllowed(t *testing.T) {
	f, _ := setupContentReviewerAccessChannel(t, true)

	for _, surface := range contentReviewerSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				require.False(t, isAccessChannelDenial(err, abacDeniedErrorID),
					"an allow decision must not deny the reviewer surface: %v", err)
			}
		})
	}
}

// TestAccessChannelPolicyAdminEndpointsStayGeneric pins a property that is derived
// rather than stated: the policy-administration surfaces must keep returning the
// generic permission error even while the access_channel policy denies.
//
// They use the RBACOnly gate siblings on purpose — gating the endpoint a client uses
// to *learn* it has been denied on the very policy doing the denying would 403 the
// denial state itself. Because RBACOnly never reaches the policy, no enforcement
// witness is recorded and SetPermissionError falls through to the generic error.
//
// Nothing else would notice a regression here: the existing access-control tests
// assert only on status codes, and both ids are 403.
func TestAccessChannelPolicyAdminEndpointsStayGeneric(t *testing.T) {
	f, _ := setupAccessChannelAPI(t, false)
	th := f.th

	// A channel the user is not a member of, so the RBAC-only gate is what fails.
	other := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypePrivate)

	_, resp, err := th.Client.SearchAccessControlDecisionActions(context.Background(), model.ActionSearchRequest{
		Resource: model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: other.Id},
		Actions:  []string{model.AccessControlPolicyActionAccessChannel},
	})
	require.Error(t, err)
	require.NotNil(t, resp)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)

	appErr, ok := err.(*model.AppError)
	require.True(t, ok, "expected an AppError, got %T", err)
	require.Equal(t, "api.context.permissions.app_error", appErr.Id,
		"the endpoint that reports a denial must not itself be reported as denied")
}
