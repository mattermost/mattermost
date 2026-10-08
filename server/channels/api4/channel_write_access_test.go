// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

const (
	abacWriteDeniedErrorID      = "api.channel.channel_write_access.abac_denied.app_error"
	abacManagementDeniedErrorID = "api.channel.channel_management_access.abac_denied.app_error"

	// What a management slash command replies with when the policy refuses it.
	managementDeniedCommandText = "You do not currently have permission to manage this channel."
)

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
	// A channel-scoped property field definition, for the patch/delete surfaces.
	// Scope is immutable via patch, so the gate has to read it off the stored field.
	propertyGroup string
	propertyField *model.PropertyField
}

var channelWriteAccessEvaluation = mock.MatchedBy(func(req model.AccessRequest) bool {
	return req.Action == model.AccessControlPolicyActionChannelWriteAccess
})

var channelManagementAccessEvaluation = mock.MatchedBy(func(req model.AccessRequest) bool {
	return req.Action == model.AccessControlPolicyActionChannelManagementAccess
})

// setupChannelActionAccessAPI stands up a server where every channel-access action is
// governed, the evaluations matching `evaluation` decide `allow`, and every other
// evaluation allows. Isolating one action is the point: a denial can only come from it.
func setupChannelActionAccessAPI(t *testing.T, evaluation any, allow bool) (*channelWriteAccessFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	// Authored before the mock is installed, so creating it is not itself a surface
	// under test.
	post := th.CreatePost(t)
	propertyGroup, propertyField := createChannelScopedPropertyField(t, th)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, evaluation).
		Return(model.AccessDecision{Decision: allow}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return &channelWriteAccessFixture{
		th:            th,
		post:          post,
		propertyGroup: propertyGroup,
		propertyField: propertyField,
	}, mockACS
}

func setupChannelWriteAccessAPI(t *testing.T, allow bool) (*channelWriteAccessFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()
	return setupChannelActionAccessAPI(t, channelWriteAccessEvaluation, allow)
}

func setupChannelManagementAccessAPI(t *testing.T, allow bool) (*channelWriteAccessFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()
	return setupChannelActionAccessAPI(t, channelManagementAccessEvaluation, allow)
}

// createChannelScopedPropertyField registers a group and a channel-scoped field on
// BasicChannel, outside the access_control group so the channel-attributes license
// gate stays out of the way. Member-level permissions keep the per-field tier checks
// satisfied, so a denial can only come from the channel gate.
func createChannelScopedPropertyField(t *testing.T, th *TestHelper) (groupName string, field *model.PropertyField) {
	t.Helper()

	groupName = "test_channel_write_access_" + model.NewId()
	group, appErr := th.App.RegisterPropertyGroup(th.Context, &model.PropertyGroup{
		Name:    groupName,
		Version: model.PropertyGroupVersionV2,
	})
	require.Nil(t, appErr)

	memberLevel := model.PermissionLevelMember
	field, resp, err := th.Client.CreatePropertyField(context.Background(), group.Name, model.PropertyFieldObjectTypeChannel, &model.PropertyField{
		Name:              model.NewId(),
		Type:              model.PropertyFieldTypeText,
		TargetType:        string(model.PropertyFieldTargetLevelChannel),
		TargetID:          th.BasicChannel.Id,
		PermissionField:   &memberLevel,
		PermissionValues:  &memberLevel,
		PermissionOptions: &memberLevel,
	})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	return group.Name, field
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
		write("delete draft", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.DeleteDraft(context.Background(), f.th.BasicUser.Id, f.th.BasicChannel.Id, "")
			return resp, err
		}),
		write("upload file", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UploadFile(context.Background(), []byte("data"), f.th.BasicChannel.Id, "test.txt")
			return resp, err
		}),
		write("publish user typing", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.PublishUserTyping(context.Background(), f.th.BasicUser.Id, model.TypingRequest{
				ChannelId: f.th.BasicChannel.Id,
			})
		}),
		write("patch property field", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			name := model.NewId()
			_, resp, err := f.th.Client.PatchPropertyField(context.Background(), f.propertyGroup, model.PropertyFieldObjectTypeChannel, f.propertyField.ID, &model.PropertyFieldPatch{
				Name: &name,
			})
			return resp, err
		}),
		// After the patch: it removes the field the patch surface acts on.
		write("delete property field", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.DeletePropertyField(context.Background(), f.propertyGroup, model.PropertyFieldObjectTypeChannel, f.propertyField.ID)
		}),
		// Last: it destroys the post the surfaces above act on, so anything after it
		// would fail for the wrong reason on the allowed run.
		write("post delete", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.DeletePost(context.Background(), f.post.Id)
		}),
	}
}

// Every change to the channel itself that channel_management_access governs, whether
// it rides a permission choke point or an explicit gate in the handler.
func channelManagementAccessSurfaces() []channelWriteAccessSurface {
	manage := func(name string, fn func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error)) channelWriteAccessSurface {
		return channelWriteAccessSurface{name: name, call: fn}
	}

	return []channelWriteAccessSurface{
		manage("create bookmark", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
				ChannelId:   f.th.BasicChannel.Id,
				DisplayName: "bookmark",
				LinkUrl:     "https://mattermost.com",
				Type:        model.ChannelBookmarkLink,
			})
			return resp, err
		}),
		manage("patch channel", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			purpose := "patched purpose"
			_, resp, err := f.th.Client.PatchChannel(context.Background(), f.th.BasicChannel.Id, &model.ChannelPatch{Purpose: &purpose})
			return resp, err
		}),
		manage("update channel", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			channel := f.th.BasicChannel
			channel.Purpose = "updated purpose"
			_, resp, err := f.th.Client.UpdateChannel(context.Background(), channel)
			return resp, err
		}),
		manage("add channel member", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.AddChannelMember(context.Background(), f.th.BasicChannel.Id, f.th.BasicUser2.Id)
			return resp, err
		}),
		// The options' own permission level is RBAC-only, so these ride an explicit gate.
		manage("create property field options", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreatePropertyFieldOptions(context.Background(), f.propertyGroup, model.PropertyFieldObjectTypeChannel, f.propertyField.ID, []*model.PropertyFieldOption{
				{Name: "option"},
			})
			return resp, err
		}),
		manage("patch property field options", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.PatchPropertyFieldOptions(context.Background(), f.propertyGroup, model.PropertyFieldObjectTypeChannel, f.propertyField.ID, []*model.PropertyFieldOption{
				{ID: model.NewId(), Name: "option"},
			})
			return resp, err
		}),
		manage("delete property field options", func(t *testing.T, f *channelWriteAccessFixture) (*model.Response, error) {
			return f.th.Client.DeletePropertyFieldOptions(context.Background(), f.propertyGroup, model.PropertyFieldObjectTypeChannel, f.propertyField.ID, []string{model.NewId()})
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

// requireDenialOnEverySurface runs each surface and requires the 403 carrying wantID.
func requireDenialOnEverySurface(t *testing.T, f *channelWriteAccessFixture, surfaces []channelWriteAccessSurface, wantID string) {
	t.Helper()

	for _, surface := range surfaces {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, f)
			require.Error(t, err, "surface must not succeed while the policy denies")
			require.NotNil(t, resp)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, wantID, appErr.Id,
				"clients switch on this id to tell a write, management and read denial apart")
		})
	}
}

// requireNoDenialOnAnySurface runs each surface and requires that none of them fails
// with any of the denial ids.
func requireNoDenialOnAnySurface(t *testing.T, f *channelWriteAccessFixture, surfaces []channelWriteAccessSurface, deniedIDs ...string) {
	t.Helper()

	for _, surface := range surfaces {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			if err != nil {
				for _, id := range deniedIDs {
					require.False(t, isChannelReadAccessDenial(err, id), "%s must not refuse this surface: %v", id, err)
				}
			}
		})
	}
}

func TestChannelWriteAccessDeniedSurfaces(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, false)
	requireDenialOnEverySurface(t, f, channelWriteAccessSurfaces(), abacWriteDeniedErrorID)
}

func TestChannelWriteAccessAllowedSurfaces(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, true)
	requireNoDenialOnAnySurface(t, f, channelWriteAccessSurfaces(), abacWriteDeniedErrorID)
}

func TestChannelManagementAccessDeniedSurfaces(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, false)
	requireDenialOnEverySurface(t, f, channelManagementAccessSurfaces(), abacManagementDeniedErrorID)
}

func TestChannelManagementAccessAllowedSurfaces(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, true)
	requireNoDenialOnAnySurface(t, f, channelManagementAccessSurfaces(), abacManagementDeniedErrorID)
}

// The two actions are independent: a denial of one must not reach the other's surfaces.
func TestChannelWriteAccessDoesNotGateManagement(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, false)
	requireNoDenialOnAnySurface(t, f, channelManagementAccessSurfaces(), abacWriteDeniedErrorID)
}

func TestChannelManagementAccessDoesNotGateWrites(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, false)
	requireNoDenialOnAnySurface(t, f, channelWriteAccessSurfaces(), abacManagementDeniedErrorID)
}

// channel_management_access never binds system admins, even where it denies everyone else.
func TestChannelManagementAccessExemptsSystemAdmins(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, false)

	purpose := "patched by a system admin"
	_, _, err := f.th.SystemAdminClient.PatchChannel(context.Background(), f.th.BasicChannel.Id, &model.ChannelPatch{Purpose: &purpose})
	require.NoError(t, err)

	user := f.th.CreateUser(t)
	f.th.LinkUserToTeam(t, user, f.th.BasicTeam)
	_, _, err = f.th.SystemAdminClient.AddChannelMember(context.Background(), f.th.BasicChannel.Id, user.Id)
	require.NoError(t, err)
}

// Joining a public channel you can see is a read-tier action. The management policy
// must not refuse it: the self-add path is authorised on the team's
// join_public_channels permission and never reaches the manage-members check, so a
// management denial would otherwise turn a plainly visible channel into one nobody
// new could enter. Adding *another* user stays gated -- that case is covered as a
// denied management surface above.
func TestChannelManagementAccessDoesNotBlockPublicChannelSelfAdd(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, false)

	// Created by the admin so the acting user is not already a member; self-adding an
	// existing member short-circuits before the join is ever attempted.
	channel := f.th.CreateChannelWithClientAndTeam(t, f.th.SystemAdminClient, model.ChannelTypeOpen, f.th.BasicTeam.Id)

	member, resp, err := f.th.Client.AddChannelMember(context.Background(), channel.Id, f.th.BasicUser.Id)
	require.NoError(t, err, "a management denial must not block joining a readable public channel")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, f.th.BasicUser.Id, member.UserId)
	require.Equal(t, channel.Id, member.ChannelId)
}

// The read policy still gates the same path: a channel the session cannot see must
// not be joinable.
func TestChannelReadAccessBlocksPublicChannelSelfAdd(t *testing.T) {
	f, _ := setupChannelReadAccessAPI(t, false)

	channel := f.th.CreateChannelWithClientAndTeam(t, f.th.SystemAdminClient, model.ChannelTypeOpen, f.th.BasicTeam.Id)

	_, resp, err := f.th.Client.AddChannelMember(context.Background(), channel.Id, f.th.BasicUser.Id)
	require.Error(t, err)
	require.NotNil(t, resp)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.True(t, isChannelReadAccessDenial(err, abacDeniedErrorID),
		"expected the read denial, got %v", err)
}

// Reads are channel_read_access's question alone: neither a write nor a management
// denial may hide a channel or its content.
func TestChannelWriteAccessDoesNotGateReads(t *testing.T) {
	f, _ := setupChannelWriteAccessAPI(t, false)
	requireNoDenialOnAnySurface(t, f, channelWriteAccessUngatedSurfaces(), abacWriteDeniedErrorID, abacDeniedErrorID)
}

func TestChannelManagementAccessDoesNotGateReads(t *testing.T) {
	f, _ := setupChannelManagementAccessAPI(t, false)
	requireNoDenialOnAnySurface(t, f, channelWriteAccessUngatedSurfaces(), abacManagementDeniedErrorID, abacDeniedErrorID)
}

// Assigning a reviewer is gated by none of the channel-access policies. It writes to
// the review record rather than the channel, and content review is a team-level
// duty performed on channels the reviewer is deliberately not a member of — so
// binding triage to any of them would leave flagged posts in a restricted
// channel unassignable. Every action denies here and the assignment still lands.
func TestChannelAccessDoesNotGateReviewerAssignment(t *testing.T) {
	f, _ := setupContentReviewerChannelAccess(t, false /* read */, false /* write */, false /* management */)

	resp, err := f.reviewerClient.AssignContentFlaggingReviewer(context.Background(), f.post.Id, f.reviewerID)
	require.NoError(t, err, "no channel-access policy may gate reviewer assignment")
	require.NotNil(t, resp)
	require.Equal(t, http.StatusOK, resp.StatusCode)
}

// The write and management gates decide on their own action alone: with the read
// policy denying and the action allowing, the call goes through.
func TestChannelAccessActionsIgnoreReadAccess(t *testing.T) {
	for _, tc := range []struct {
		name   string
		action string
		call   func(th *TestHelper) error
	}{
		{"write", model.AccessControlPolicyActionChannelWriteAccess, func(th *TestHelper) error {
			_, _, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: th.BasicChannel.Id, Message: "allowed"})
			return err
		}},
		{"management", model.AccessControlPolicyActionChannelManagementAccess, func(th *TestHelper) error {
			purpose := "allowed"
			_, _, err := th.Client.PatchChannel(context.Background(), th.BasicChannel.Id, &model.ChannelPatch{Purpose: &purpose})
			return err
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			th := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.PermissionPolicies = true
			}).InitBasic(t)
			th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
			})

			mockACS := installMockACS(t, th)
			mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
			mockACS.On("AccessEvaluation", mock.Anything, channelReadAccessEvaluation).
				Return(model.AccessDecision{Decision: false}, nil)
			mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
				Return(model.AccessDecision{Decision: true}, nil)

			require.NoError(t, tc.call(th), "a read denial must not refuse %s", tc.action)
		})
	}
}

// The gate is inert until a channel_write_access policy governs the channel: a
// deployment that only restricts reading must not start refusing posts. This is
// the reason TestChannelReadAccessDoesNotGateWrites is still true.
func TestChannelWriteAccessInertWithoutAWritePolicy(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
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

// The management slash commands check their permissions RBAC-only and executeCommand
// only gates posting, so each has to ask the management gate itself.
func TestChannelManagementAccessGatesSlashCommands(t *testing.T) {
	t.Run("denied", func(t *testing.T) {
		f, _ := setupChannelManagementAccessAPI(t, false)
		th := f.th

		for _, command := range []string{"/header denied header", "/purpose denied purpose", "/rename denied-name"} {
			resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, command)
			require.NoError(t, err, command)
			require.Equal(t, managementDeniedCommandText, resp.Text, command)
		}

		channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
		require.Equal(t, th.BasicChannel.Header, channel.Header)
		require.Equal(t, th.BasicChannel.Purpose, channel.Purpose)
		require.Equal(t, th.BasicChannel.DisplayName, channel.DisplayName)

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/kick @"+th.BasicUser2.Username)
		require.NoError(t, err)
		require.Equal(t, managementDeniedCommandText, resp.Text)
		_, appErr = th.App.GetChannelMember(th.Context, th.BasicChannel.Id, th.BasicUser2.Id)
		require.Nil(t, appErr, "the kick must not have gone through")

		// Invited into another channel than the one the command runs in, whose
		// posting is all executeCommand gates.
		invitee := th.CreateUser(t)
		th.LinkUserToTeam(t, invitee, th.BasicTeam)
		resp, _, err = th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/invite @"+invitee.Username+" ~"+th.BasicChannel2.Name)
		require.NoError(t, err)
		require.Contains(t, resp.Text, fmt.Sprintf("You don't have enough permissions to add %s in %s.", invitee.Username, th.BasicChannel2.Name))
		_, appErr = th.App.GetChannelMember(th.Context, th.BasicChannel2.Id, invitee.Id)
		require.NotNil(t, appErr, "the invite must not have gone through")
	})

	t.Run("allowed", func(t *testing.T) {
		f, _ := setupChannelManagementAccessAPI(t, true)
		th := f.th

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/header allowed header")
		require.NoError(t, err)
		require.NotEqual(t, managementDeniedCommandText, resp.Text)

		channel, appErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, appErr)
		require.Equal(t, "allowed header", channel.Header)
	})
}

// Unarchiving is authorised on team and console permissions, so no channel permission
// check brings the management gate along; the handler asks it directly.
func TestChannelManagementAccessGatesUnarchive(t *testing.T) {
	for _, allow := range []bool{false, true} {
		t.Run(fmt.Sprintf("allow=%t", allow), func(t *testing.T) {
			f, _ := setupChannelManagementAccessAPI(t, allow)
			th := f.th

			teamAdminClient := th.CreateClient()
			th.LoginTeamAdminWithClient(t, teamAdminClient)

			_, resp, err := teamAdminClient.RestoreChannel(context.Background(), th.BasicDeletedChannel.Id)
			if allow {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			require.True(t, isChannelReadAccessDenial(err, abacManagementDeniedErrorID), "expected the management denial, got %v", err)
		})
	}
}

// Sharing with remote workspaces is authorised on a system permission, so no channel
// permission check brings the management gate along; the handlers ask it directly.
func TestChannelManagementAccessGatesSharedChannelInvites(t *testing.T) {
	for _, allow := range []bool{false, true} {
		t.Run(fmt.Sprintf("allow=%t", allow), func(t *testing.T) {
			th := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.PermissionPolicies = true
				*cfg.ConnectedWorkspacesSettings.EnableRemoteClusterService = true
				*cfg.ConnectedWorkspacesSettings.EnableSharedChannels = true
			}).InitBasic(t)
			th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
				*cfg.ServiceSettings.SiteURL = fmt.Sprintf("http://localhost:%d", th.Server.ListenAddr.Port)
			})

			// A shared channel manager holds manage_shared_channels without manage_system,
			// which channel_management_access would exempt.
			_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SharedChannelManagerRoleId, false)
			require.Nil(t, appErr)
			th.LoginBasic(t)

			rc, appErr := th.App.AddRemoteCluster(&model.RemoteCluster{Name: "rc", SiteURL: "http://example.com", CreatorId: th.SystemAdminUser.Id})
			require.Nil(t, appErr)

			mockACS := installMockACS(t, th)
			mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
			mockACS.On("AccessEvaluation", mock.Anything, channelManagementAccessEvaluation).
				Return(model.AccessDecision{Decision: allow}, nil)
			mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
				Return(model.AccessDecision{Decision: true}, nil)

			for name, call := range map[string]func() (*model.Response, error){
				"invite": func() (*model.Response, error) {
					return th.Client.InviteRemoteClusterToChannel(context.Background(), rc.RemoteId, th.BasicChannel.Id)
				},
				"uninvite": func() (*model.Response, error) {
					return th.Client.UninviteRemoteClusterToChannel(context.Background(), rc.RemoteId, th.BasicChannel.Id)
				},
			} {
				resp, err := call()
				if allow {
					// Reaching the remote needs server-to-server traffic; all that matters
					// here is that the gate let the request through.
					require.False(t, isChannelReadAccessDenial(err, abacManagementDeniedErrorID), "%s: %v", name, err)
					continue
				}

				require.Error(t, err, name)
				require.Equal(t, http.StatusForbidden, resp.StatusCode, name)
				require.True(t, isChannelReadAccessDenial(err, abacManagementDeniedErrorID), "%s: expected the management denial, got %v", name, err)
			}

			// The /share-channel command reaches the same change, authorised on the same
			// system permission.
			resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/share-channel invite --connectionID "+rc.RemoteId)
			require.NoError(t, err)
			if allow {
				require.NotEqual(t, managementDeniedCommandText, resp.Text)
			} else {
				require.Equal(t, managementDeniedCommandText, resp.Text)
			}
		})
	}
}

// channelPolicyManagementSurface is one channel-scoped policy-administration call.
type channelPolicyManagementSurface struct {
	name string
	call func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error)
}

// setupChannelPolicyManagementAccessAPI stands up a channel admin acting on their own
// channel's ABAC policy, with channel_management_access governed and deciding `allow`.
// Every other evaluation allows, so any denial below is unambiguously the management
// action.
//
// Masking is off: it makes CreateOrUpdateAccessControlPolicy validate the caller's
// attribute holdings, which has nothing to do with the gate under test.
func setupChannelPolicyManagementAccessAPI(t *testing.T, allow bool) (*TestHelper, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	// Policy administration is authorized on manage_channel_access_rules. Without it
	// every call below would fail RBAC before the management gate was ever consulted,
	// and a 403 would prove nothing.
	th.MakeUserChannelAdmin(t, th.BasicUser, th.BasicChannel)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, channelManagementAccessEvaluation).
		Return(model.AccessDecision{Decision: allow}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return th, mockACS
}

// channelPolicyForManagementAccess is the policy the Membership Policy tab saves. The
// Permissions Policy tab posts a v0.4 body carrying permission-rule actions through the
// same handler branch, so it rides the same gate.
func channelPolicyForManagementAccess(channelID string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		ID:       channelID,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_3,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{
				Expression: "user.attributes.team == 'engineering'",
				Actions:    []string{model.AccessControlPolicyActionMembership},
			},
		},
	}
}

// stubChannelPolicyAdministration lets the policy-administration calls behind the gated
// handlers succeed, so an allowed run reaches a real 200 rather than failing on an
// unstubbed access control service.
func stubChannelPolicyAdministration(t *testing.T, th *TestHelper, mockACS *mocks.AccessControlServiceInterface) {
	t.Helper()

	policy := channelPolicyForManagementAccess(th.BasicChannel.Id)
	mockACS.On("GetPolicy", mock.Anything, th.BasicChannel.Id).Return(policy, nil)
	mockACS.On("GetPolicy", mock.Anything, mock.Anything).
		Return(nil, model.NewAppError("GetPolicy", "app.access_control.not_found.app_error", nil, "", http.StatusNotFound)).
		Maybe()
	mockACS.On("SavePolicy", mock.Anything, mock.AnythingOfType("*model.AccessControlPolicy")).Return(policy, nil)
	mockACS.On("DeletePolicy", mock.Anything, th.BasicChannel.Id).Return(nil)
	mockACS.On("CheckExpression", mock.Anything, mock.Anything).Return([]model.CELExpressionError{}, nil)
	mockACS.On("NormalizePolicy", mock.Anything, mock.Anything).Return(policy, nil).Maybe()

	// The caller must satisfy every rule they save, or checkSelfInclusion rejects the
	// upsert before the handler's own gate can be observed.
	allowSelfInclusion(mockACS, th.BasicUser.Id)
}

// Every way a channel's own policy can be inspected or changed. Editing a channel's
// policies is managing the channel, so a management denial must reach all of them.
func channelPolicyManagementSurfaces() []channelPolicyManagementSurface {
	surface := func(name string, fn func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error)) channelPolicyManagementSurface {
		return channelPolicyManagementSurface{name: name, call: fn}
	}

	return []channelPolicyManagementSurface{
		surface("policy upsert", func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error) {
			_, resp, err := client.CreateAccessControlPolicy(context.Background(), channelPolicyForManagementAccess(th.BasicChannel.Id))
			return resp, err
		}),
		surface("policy fetch", func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error) {
			_, resp, err := client.GetAccessControlPolicy(context.Background(), th.BasicChannel.Id)
			return resp, err
		}),
		surface("expression check", func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error) {
			_, resp, err := client.CheckExpression(context.Background(), "user.attributes.team == 'engineering'", th.BasicChannel.Id)
			return resp, err
		}),
		surface("policy activate", func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error) {
			_, resp, err := client.SetAccessControlPolicyActive(context.Background(), model.AccessControlPolicyActiveUpdateRequest{
				Entries: []model.AccessControlPolicyActiveUpdate{{ID: th.BasicChannel.Id, Active: true}},
			})
			return resp, err
		}),
		// Last: it removes the policy the surfaces above act on.
		surface("policy delete", func(t *testing.T, th *TestHelper, client *model.Client4) (*model.Response, error) {
			return client.DeleteAccessControlPolicy(context.Background(), th.BasicChannel.Id)
		}),
	}
}

func TestChannelManagementAccessDeniesChannelPolicyAdministration(t *testing.T) {
	th, mockACS := setupChannelPolicyManagementAccessAPI(t, false)
	stubChannelPolicyAdministration(t, th, mockACS)

	for _, surface := range channelPolicyManagementSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, th, th.Client)
			require.Error(t, err, "channel_management_access denied, so the call must fail")
			require.NotNil(t, resp)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, abacManagementDeniedErrorID, appErr.Id,
				"the denial must name channel_management_access, not a generic permission error")
		})
	}
}

func TestChannelManagementAccessAllowsChannelPolicyAdministration(t *testing.T) {
	th, mockACS := setupChannelPolicyManagementAccessAPI(t, true)
	stubChannelPolicyAdministration(t, th, mockACS)

	for _, surface := range channelPolicyManagementSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, th, th.Client)
			require.NoError(t, err)
		})
	}
}

// channel_management_access never binds manage_system, so a policy that denies a
// channel's own admins stays repairable through the API — the System Console
// channel-level access rules page is that repair path.
func TestChannelManagementAccessDoesNotGateSystemAdminPolicyAdministration(t *testing.T) {
	th, mockACS := setupChannelPolicyManagementAccessAPI(t, false)
	stubChannelPolicyAdministration(t, th, mockACS)

	for _, surface := range channelPolicyManagementSurfaces() {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, th, th.SystemAdminClient)
			require.NoError(t, err)
		})
	}
}
