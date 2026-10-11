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

const (
	dmGmReadDeniedErrorID  = "api.channel.dm_gm_read_access.abac_denied.app_error"
	dmGmWriteDeniedErrorID = "api.channel.dm_gm_write_access.abac_denied.app_error"
)

// dmGmEvaluation matches an evaluation of action on the system permission
// resource, the only resource the direct and group message actions use.
func dmGmEvaluation(action string) any {
	return mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == action &&
			req.Resource.Type == model.AccessControlPolicyTypePermission &&
			req.Resource.ID == ""
	})
}

type dmGmAccessFixture struct {
	th     *TestHelper
	dm     *model.Channel
	gm     *model.Channel
	dmPost *model.Post
	gmPost *model.Post
	// One bookmark per conversation, keyed by channel id.
	bookmarks map[string]*model.ChannelBookmarkWithFileInfo
}

type dmGmAccessSurface struct {
	name string
	call func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error)
}

// setupDMGMAccessAPI stands up a server where every action is governed. The
// direct and group message read and write evaluations decide allowRead and
// allowWrite; every other evaluation allows.
func setupDMGMAccessAPI(t *testing.T, allowRead, allowWrite bool) (*dmGmAccessFixture, *mocks.AccessControlServiceInterface) {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.EnableShiftEscapeToMarkAllRead = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		*cfg.ServiceSettings.ScheduledPosts = true
		// Conversation posts push asynchronously; a push must not reach the access
		// control service after the test has restored it.
		*cfg.EmailSettings.SendPushNotifications = false
	})

	// Created before the mock is installed: a bare mock panics on the broadcast
	// hooks these run.
	dm := th.CreateDmChannel(t, th.BasicUser2)
	gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.SystemAdminUser.Id}, th.BasicUser.Id)
	require.Nil(t, appErr)
	dmPost := th.CreatePostWithClient(t, th.Client, dm)
	gmPost := th.CreatePostWithClient(t, th.Client, gm)

	bookmarks := map[string]*model.ChannelBookmarkWithFileInfo{}
	for _, channel := range []*model.Channel{dm, gm} {
		bookmark, _, err := th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
			ChannelId:   channel.Id,
			DisplayName: "bookmark",
			Type:        model.ChannelBookmarkLink,
			LinkUrl:     "https://mattermost.com",
		})
		require.NoError(t, err)
		bookmarks[channel.Id] = bookmark
	}

	// A saved post and a scheduled post in the DM, for the lists that leave hidden
	// conversations out.
	_, err := th.Client.UpdatePreferences(context.Background(), th.BasicUser.Id, model.Preferences{{
		UserId:   th.BasicUser.Id,
		Category: model.PreferenceCategoryFlaggedPost,
		Name:     dmPost.Id,
		Value:    "true",
	}})
	require.NoError(t, err)
	_, _, err = th.Client.CreateScheduledPost(context.Background(), &model.ScheduledPost{
		Draft:       model.Draft{ChannelId: dm.Id, Message: "scheduled"},
		ScheduledAt: model.GetMillis() + 100000,
	})
	require.NoError(t, err)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, dmGmEvaluation(model.AccessControlPolicyActionDMGMReadAccess)).
		Return(model.AccessDecision{Decision: allowRead}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, dmGmEvaluation(model.AccessControlPolicyActionDMGMWriteAccess)).
		Return(model.AccessDecision{Decision: allowWrite}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return &dmGmAccessFixture{th: th, dm: dm, gm: gm, dmPost: dmPost, gmPost: gmPost, bookmarks: bookmarks}, mockACS
}

func dmGmReadSurfaces() []dmGmAccessSurface {
	return []dmGmAccessSurface{
		{"get channel", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannel(context.Background(), f.dm.Id)
			return resp, err
		}},
		{"get group channel", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannel(context.Background(), f.gm.Id)
			return resp, err
		}},
		{"posts for channel", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostsForChannel(context.Background(), f.dm.Id, 0, 60, "", false, false)
			return resp, err
		}},
		{"single post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPost(context.Background(), f.dmPost.Id, "")
			return resp, err
		}},
		{"post thread", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetPostThread(context.Background(), f.dmPost.Id, "", false)
			return resp, err
		}},
		{"channel members", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelMembers(context.Background(), f.dm.Id, 0, 60, "")
			return resp, err
		}},
		{"view channel", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.ViewChannel(context.Background(), f.th.BasicUser.Id, &model.ChannelView{ChannelId: f.dm.Id})
			return resp, err
		}},
		{"channel stats", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetChannelStats(context.Background(), f.dm.Id, "", false)
			return resp, err
		}},
		{"common teams", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.GetDirectOrGroupMessageMembersCommonTeams(context.Background(), f.gm.Id)
			return resp, err
		}},
	}
}

func dmGmWriteSurfaces() []dmGmAccessSurface {
	return []dmGmAccessSurface{
		{"create post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.dm.Id, Message: "denied"})
			return resp, err
		}},
		{"create post in a group message", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.gm.Id, Message: "denied"})
			return resp, err
		}},
		{"patch post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			message := "patched"
			_, resp, err := f.th.Client.PatchPost(context.Background(), f.dmPost.Id, &model.PostPatch{Message: &message})
			return resp, err
		}},
		{"save reaction", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.SaveReaction(context.Background(), &model.Reaction{
				UserId:    f.th.BasicUser.Id,
				PostId:    f.dmPost.Id,
				EmojiName: "+1",
			})
			return resp, err
		}},
		{"create upload session", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.CreateUpload(context.Background(), &model.UploadSession{
				ChannelId: f.dm.Id,
				Filename:  "test.txt",
				FileSize:  4,
			})
			return resp, err
		}},
		{"upload file", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UploadFile(context.Background(), []byte("data"), f.dm.Id, "test.txt")
			return resp, err
		}},
		{"upsert draft", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			_, resp, err := f.th.Client.UpsertDraft(context.Background(), &model.Draft{
				UserId:    f.th.BasicUser.Id,
				ChannelId: f.dm.Id,
				Message:   "denied",
			})
			return resp, err
		}},
		// Last: it removes the post the surfaces above act on.
		{"delete post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
			return f.th.Client.DeletePost(context.Background(), f.dmPost.Id)
		}},
	}
}

func requireDMGMDenial(t *testing.T, f *dmGmAccessFixture, surfaces []dmGmAccessSurface, wantID string) {
	t.Helper()

	for _, surface := range surfaces {
		t.Run(surface.name, func(t *testing.T) {
			resp, err := surface.call(t, f)
			require.Error(t, err)
			require.NotNil(t, resp)
			require.Equal(t, http.StatusForbidden, resp.StatusCode)
			appErr, ok := err.(*model.AppError)
			require.True(t, ok, "expected an AppError, got %T", err)
			require.Equal(t, wantID, appErr.Id, "clients record the action named by this id as denied")
		})
	}
}

func requireDMGMAllowed(t *testing.T, f *dmGmAccessFixture, surfaces []dmGmAccessSurface) {
	t.Helper()

	for _, surface := range surfaces {
		t.Run(surface.name, func(t *testing.T) {
			_, err := surface.call(t, f)
			require.NoError(t, err)
		})
	}
}

func TestDMGMReadAccessDenied(t *testing.T) {
	f, _ := setupDMGMAccessAPI(t, false, true)
	requireDMGMDenial(t, f, dmGmReadSurfaces(), dmGmReadDeniedErrorID)
}

func TestDMGMWriteAccessDenied(t *testing.T) {
	f, _ := setupDMGMAccessAPI(t, true, false)
	requireDMGMDenial(t, f, dmGmWriteSurfaces(), dmGmWriteDeniedErrorID)
}

func TestDMGMAccessAllowed(t *testing.T) {
	f, _ := setupDMGMAccessAPI(t, true, true)
	requireDMGMAllowed(t, f, dmGmReadSurfaces())
	requireDMGMAllowed(t, f, dmGmWriteSurfaces())
}

func TestDMGMWriteIsIndependentOfRead(t *testing.T) {
	f, _ := setupDMGMAccessAPI(t, false, true)

	_, resp, err := f.th.Client.CreatePost(context.Background(), &model.Post{ChannelId: f.dm.Id, Message: "write without read"})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
}

func TestDMGMChannelPoliciesStayInert(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
	dm := th.CreateDmChannel(t, th.BasicUser2)

	// Every channel action denies; the direct and group message actions are
	// ungoverned.
	mockACS := installMockACS(t, th)
	for _, action := range model.DMGMActions() {
		mockACS.On("ActionHasPermissionPolicy", mock.Anything, action).Return(false, nil)
	}
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: false}, nil)

	_, _, err := th.Client.GetChannel(context.Background(), dm.Id)
	require.NoError(t, err)
	_, resp, err := th.Client.CreatePost(context.Background(), &model.Post{ChannelId: dm.Id, Message: "hello"})
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	for _, call := range mockACS.Calls {
		if call.Method == "AccessEvaluation" {
			req := call.Arguments.Get(1).(model.AccessRequest)
			require.NotEqual(t, dm.Id, req.Resource.ID, "a channel action must not be evaluated on a conversation")
		}
	}
}

func TestDMGMBotAccessTokenIsEvaluated(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		*cfg.ServiceSettings.EnableBotAccountCreation = true
		*cfg.ServiceSettings.EnableUserAccessTokens = true
	})

	bot := th.CreateBotWithSystemAdminClient(t)
	token, appErr := th.App.CreateUserAccessToken(th.Context, &model.UserAccessToken{UserId: bot.UserId, Description: "dm gm"})
	require.Nil(t, appErr)
	dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, bot.UserId, th.BasicUser.Id)
	require.Nil(t, appErr)

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionDMGMWriteAccess && req.Subject.ID == bot.UserId
	})).Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	client := th.CreateClient()
	client.SetToken(token.Token)
	_, resp, err := client.CreatePost(context.Background(), &model.Post{ChannelId: dm.Id, Message: "from a bot"})
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	require.Equal(t, dmGmWriteDeniedErrorID, err.(*model.AppError).Id)
}

// dmGmExplicitWriteSurfaces are the conversation writes that check membership rather
// than a write permission, so they carry their own gate. Each runs on the DM and the GM.
func dmGmExplicitWriteSurfaces() []dmGmAccessSurface {
	var surfaces []dmGmAccessSurface
	for _, conv := range []struct {
		name    string
		channel func(f *dmGmAccessFixture) *model.Channel
		post    func(f *dmGmAccessFixture) *model.Post
	}{
		{"DM", func(f *dmGmAccessFixture) *model.Channel { return f.dm }, func(f *dmGmAccessFixture) *model.Post { return f.dmPost }},
		{"GM", func(f *dmGmAccessFixture) *model.Channel { return f.gm }, func(f *dmGmAccessFixture) *model.Post { return f.gmPost }},
	} {
		surfaces = append(surfaces,
			dmGmAccessSurface{conv.name + " update header", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				channel := conv.channel(f).DeepCopy()
				channel.Header = "updated " + model.NewId()
				_, resp, err := f.th.Client.UpdateChannel(context.Background(), channel)
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " patch header", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				header := "patched " + model.NewId()
				_, resp, err := f.th.Client.PatchChannel(context.Background(), conv.channel(f).Id, &model.ChannelPatch{Header: &header})
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " create bookmark", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				_, resp, err := f.th.Client.CreateChannelBookmark(context.Background(), &model.ChannelBookmark{
					ChannelId:   conv.channel(f).Id,
					DisplayName: "another",
					Type:        model.ChannelBookmarkLink,
					LinkUrl:     "https://mattermost.com",
				})
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " update bookmark", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				name := "renamed"
				channelID := conv.channel(f).Id
				_, resp, err := f.th.Client.UpdateChannelBookmark(context.Background(), channelID, f.bookmarks[channelID].Id, &model.ChannelBookmarkPatch{DisplayName: &name})
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " sort bookmark", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				channelID := conv.channel(f).Id
				_, resp, err := f.th.Client.UpdateChannelBookmarkSortOrder(context.Background(), channelID, f.bookmarks[channelID].Id, 0)
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " acknowledge post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				_, resp, err := f.th.Client.AcknowledgePost(context.Background(), conv.post(f).Id, f.th.BasicUser.Id)
				return resp, err
			}},
			dmGmAccessSurface{conv.name + " unacknowledge post", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				return f.th.Client.UnacknowledgePost(context.Background(), conv.post(f).Id, f.th.BasicUser.Id)
			}},
			// Last for each conversation: it removes the bookmark the surfaces above use.
			dmGmAccessSurface{conv.name + " delete bookmark", func(t *testing.T, f *dmGmAccessFixture) (*model.Response, error) {
				channelID := conv.channel(f).Id
				_, resp, err := f.th.Client.DeleteChannelBookmark(context.Background(), channelID, f.bookmarks[channelID].Id)
				return resp, err
			}},
		)
	}
	return surfaces
}

func TestDMGMWriteAccessGatesExplicitWrites(t *testing.T) {
	t.Run("denied", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, false)
		requireDMGMDenial(t, f, dmGmExplicitWriteSurfaces(), dmGmWriteDeniedErrorID)
	})

	t.Run("allowed", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, true)
		requireDMGMAllowed(t, f, dmGmExplicitWriteSurfaces())
	})
}

// Acknowledgements in channels stay read-gated: only conversations treat them as writes.
func TestDMGMAcknowledgementsInChannelsAreNotWriteGated(t *testing.T) {
	f, _ := setupDMGMAccessAPI(t, true, false)

	_, _, err := f.th.Client.AcknowledgePost(context.Background(), f.th.BasicPost.Id, f.th.BasicUser.Id)
	require.NoError(t, err)
}

func TestDMGMWriteAccessGatesGroupMessageConversion(t *testing.T) {
	convert := func(f *dmGmAccessFixture) error {
		_, err := f.th.Client.DoAPIPostJSON(context.Background(), "/channels/"+f.gm.Id+"/convert_to_channel", &model.GroupMessageConversionRequestBody{
			ChannelID:   f.gm.Id,
			TeamID:      f.th.BasicTeam.Id,
			Name:        "converted-" + model.NewId(),
			DisplayName: "Converted",
		})
		return err
	}

	t.Run("denied", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, false)
		err := convert(f)
		require.Error(t, err)
		require.Equal(t, dmGmWriteDeniedErrorID, err.(*model.AppError).Id)
	})

	t.Run("allowed gets past the gate", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, true)
		// The system admin in the GM isn't on the team, so the conversion itself fails;
		// what matters is that the gate doesn't.
		if err := convert(f); err != nil {
			require.NotEqual(t, dmGmWriteDeniedErrorID, err.(*model.AppError).Id)
		}
	})
}

func TestDMGMReadAccessGatesMarkAllRead(t *testing.T) {
	t.Run("denied", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, false, true)
		_, resp, err := f.th.Client.ReadAllMessages(context.Background(), f.th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		require.Equal(t, dmGmReadDeniedErrorID, err.(*model.AppError).Id)
	})

	t.Run("allowed", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, true)
		_, _, err := f.th.Client.ReadAllMessages(context.Background(), f.th.BasicUser.Id)
		require.NoError(t, err)
	})
}

// The lists that leave hidden conversations out rather than refusing. Each returns how
// many of the fixture's conversation items it returned.
func dmGmHiddenListSurfaces() map[string]func(t *testing.T, f *dmGmAccessFixture) int {
	return map[string]func(t *testing.T, f *dmGmAccessFixture) int{
		"group channel search": func(t *testing.T, f *dmGmAccessFixture) int {
			channels, _, err := f.th.Client.SearchGroupChannels(context.Background(), &model.ChannelSearch{Term: f.th.BasicUser2.Username})
			require.NoError(t, err)
			return len(channels)
		},
		"users in group channels": func(t *testing.T, f *dmGmAccessFixture) int {
			users, _, err := f.th.Client.GetUsersByGroupChannelIds(context.Background(), []string{f.gm.Id})
			require.NoError(t, err)
			return len(users[f.gm.Id])
		},
		"scheduled posts in conversations": func(t *testing.T, f *dmGmAccessFixture) int {
			posts, _, err := f.th.Client.GetUserScheduledPosts(context.Background(), f.th.BasicTeam.Id, true)
			require.NoError(t, err)
			directChannels, ok := posts["directChannels"]
			require.True(t, ok, "the key is still returned")
			return len(directChannels)
		},
		"saved posts in a conversation": func(t *testing.T, f *dmGmAccessFixture) int {
			posts, _, err := f.th.Client.GetFlaggedPostsForUserInChannel(context.Background(), f.th.BasicUser.Id, f.dm.Id, 0, 60)
			require.NoError(t, err)
			return len(posts.Order)
		},
		"direct messages sidebar category": func(t *testing.T, f *dmGmAccessFixture) int {
			categories, _, err := f.th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), f.th.BasicUser.Id, f.th.BasicTeam.Id, "")
			require.NoError(t, err)
			for _, category := range categories.Categories {
				if category.Type == model.SidebarCategoryDirectMessages {
					return len(category.Channels)
				}
			}
			require.Fail(t, "the Direct Messages category is still returned")
			return 0
		},
	}
}

func TestDMGMReadAccessHidesConversationsFromLists(t *testing.T) {
	t.Run("denied", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, false, true)
		for name, list := range dmGmHiddenListSurfaces() {
			t.Run(name, func(t *testing.T) {
				require.Zero(t, list(t, f))
			})
		}
	})

	t.Run("allowed", func(t *testing.T) {
		f, _ := setupDMGMAccessAPI(t, true, true)
		for name, list := range dmGmHiddenListSurfaces() {
			t.Run(name, func(t *testing.T) {
				require.NotZero(t, list(t, f))
			})
		}
	})
}

const dmGmStartDeniedErrorID = "api.channel.dm_gm_start.abac_denied.app_error"

// setupDMGMServer stands up a licensed server with attribute-based access control on
// and no mock installed yet, so a test can create its fixtures first.
func setupDMGMServer(t *testing.T) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
		*cfg.EmailSettings.SendPushNotifications = false
	})
	return th
}

// installDMGMDecisions governs every action, answers the listed direct and group
// message actions for any subject, and allows every other evaluation.
func installDMGMDecisions(t *testing.T, th *TestHelper, allow map[string]bool) *mocks.AccessControlServiceInterface {
	t.Helper()

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	for action, allowed := range allow {
		mockACS.On("AccessEvaluation", mock.Anything, dmGmEvaluation(action)).
			Return(model.AccessDecision{Decision: allowed}, nil)
	}
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)
	return mockACS
}

// evaluatedSubjects lists the subject ids action was evaluated for.
func evaluatedSubjects(mockACS *mocks.AccessControlServiceInterface, action string) []string {
	var subjects []string
	for _, call := range mockACS.Calls {
		if call.Method != "AccessEvaluation" {
			continue
		}
		if req := call.Arguments.Get(1).(model.AccessRequest); req.Action == action {
			subjects = append(subjects, req.Subject.ID)
		}
	}
	return subjects
}

func requireAppErrorID(t *testing.T, err error, wantID string) {
	t.Helper()
	require.Error(t, err)
	appErr, ok := err.(*model.AppError)
	require.True(t, ok, "expected an AppError, got %T", err)
	require.Equal(t, wantID, appErr.Id)
}

func requireNoConversation(t *testing.T, th *TestHelper, name string) {
	t.Helper()
	channel, appErr := th.App.GetDirectOrGroupChannelByName(th.Context, name)
	require.Nil(t, appErr)
	require.Nil(t, channel, "nothing may be created when Start is denied")
}

func TestDMGMStartCreateDirectChannel(t *testing.T) {
	startDenied := map[string]bool{model.AccessControlPolicyActionDMGMStart: false}

	t.Run("a new DM needs Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		installDMGMDecisions(t, th, startDenied)

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, other.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmStartDeniedErrorID)
		requireNoConversation(t, th, model.GetDMNameFromIds(th.BasicUser.Id, other.Id))
	})

	t.Run("a new DM is created when Start allows", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: true})

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, other.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("a new self-DM needs Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		installDMGMDecisions(t, th, startDenied)

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmStartDeniedErrorID)
	})

	t.Run("reopening an existing DM is governed by Read, not Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		th.CreateDmChannel(t, th.BasicUser2)
		mockACS := installDMGMDecisions(t, th, startDenied)

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Empty(t, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})

	t.Run("reopening an existing DM is refused when Read denies", func(t *testing.T) {
		th := setupDMGMServer(t)
		th.CreateDmChannel(t, th.BasicUser2)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmReadDeniedErrorID)
	})

	t.Run("an admin creating a DM for two others is evaluated on their own session", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		mockACS := installDMGMDecisions(t, th, startDenied)

		_, resp, err := th.SystemAdminClient.CreateDirectChannel(context.Background(), th.BasicUser.Id, other.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmStartDeniedErrorID)
		require.Equal(t, []string{th.SystemAdminUser.Id}, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})

	t.Run("an RBAC denial wins without evaluating", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		th.RemovePermissionFromRole(t, model.PermissionCreateDirectChannel.Id, model.SystemUserRoleId)
		t.Cleanup(func() { th.AddPermissionToRole(t, model.PermissionCreateDirectChannel.Id, model.SystemUserRoleId) })
		mockACS := installDMGMDecisions(t, th, startDenied)

		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, other.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, "api.context.permissions.app_error")
		require.Empty(t, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})

	t.Run("a bot using a personal access token is evaluated", func(t *testing.T) {
		th := setupDMGMServer(t)
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableBotAccountCreation = true
			*cfg.ServiceSettings.EnableUserAccessTokens = true
		})
		bot := th.CreateBotWithSystemAdminClient(t)
		token, appErr := th.App.CreateUserAccessToken(th.Context, &model.UserAccessToken{UserId: bot.UserId, Description: "dm gm start"})
		require.Nil(t, appErr)
		mockACS := installDMGMDecisions(t, th, startDenied)

		client := th.CreateClient()
		client.SetToken(token.Token)
		_, resp, err := client.CreateDirectChannel(context.Background(), bot.UserId, th.BasicUser.Id)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmStartDeniedErrorID)
		require.Equal(t, []string{bot.UserId}, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})
}

func TestDMGMStartCreateGroupChannel(t *testing.T) {
	t.Run("a new GM needs Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		ids := []string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), ids)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmStartDeniedErrorID)
		requireNoConversation(t, th, model.GetGroupNameFromUserIds(ids))
	})

	t.Run("a new GM is created when Start allows", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: true})

		// The session user is left out of the request; the handler adds them.
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser2.Id, other.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
	})

	t.Run("reopening an existing GM is governed by Read, not Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		ids := []string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}
		_, appErr := th.App.CreateGroupChannel(th.Context, ids, th.BasicUser.Id)
		require.Nil(t, appErr)
		mockACS := installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser2.Id, other.Id})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Empty(t, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})

	t.Run("reopening an existing GM is refused when Read denies", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		ids := []string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}
		_, appErr := th.App.CreateGroupChannel(th.Context, ids, th.BasicUser.Id)
		require.Nil(t, appErr)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: false})

		_, resp, err := th.Client.CreateGroupChannel(context.Background(), ids)
		CheckForbiddenStatus(t, resp)
		requireAppErrorID(t, err, dmGmReadDeniedErrorID)
	})

	t.Run("a GM of the wrong size keeps its 400", func(t *testing.T) {
		th := setupDMGMServer(t)
		mockACS := installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser2.Id})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		require.Empty(t, evaluatedSubjects(mockACS, model.AccessControlPolicyActionDMGMStart))
	})
}

const (
	dmGmStartDeniedText = "You can't start new direct or group messages."
	dmGmWriteDeniedText = "You do not have permission to send direct or group messages."
)

func TestDMGMSlashCommands(t *testing.T) {
	postCount := func(t *testing.T, th *TestHelper, channelID string) int {
		t.Helper()
		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: channelID, PerPage: 60})
		require.Nil(t, appErr)
		return len(posts.Order)
	}

	t.Run("/msg to someone new needs Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		th.LinkUserToTeam(t, other, th.BasicTeam)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg @"+other.Username)
		require.NoError(t, err)
		require.Equal(t, dmGmStartDeniedText, resp.Text)
		requireNoConversation(t, th, model.GetDMNameFromIds(th.BasicUser.Id, other.Id))
	})

	t.Run("/msg with a message needs Write", func(t *testing.T) {
		th := setupDMGMServer(t)
		dm := th.CreateDmChannel(t, th.BasicUser2)
		before := postCount(t, th, dm.Id)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMWriteAccess: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg @"+th.BasicUser2.Username+" hello")
		require.NoError(t, err)
		require.Equal(t, dmGmWriteDeniedText, resp.Text)
		require.Equal(t, before, postCount(t, th, dm.Id), "nothing may be posted")
	})

	t.Run("/msg to an existing DM does not need Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		dm := th.CreateDmChannel(t, th.BasicUser2)
		before := postCount(t, th, dm.Id)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/msg @"+th.BasicUser2.Username+" hello")
		require.NoError(t, err)
		require.Empty(t, resp.Text)
		require.Equal(t, before+1, postCount(t, th, dm.Id))
	})

	t.Run("/groupmsg to a new group needs Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		th.LinkUserToTeam(t, other, th.BasicTeam)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg @"+th.BasicUser2.Username+",@"+other.Username)
		require.NoError(t, err)
		require.Equal(t, dmGmStartDeniedText, resp.Text)
		requireNoConversation(t, th, model.GetGroupNameFromUserIds([]string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}))
	})

	t.Run("/groupmsg with a message needs Write", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		th.LinkUserToTeam(t, other, th.BasicTeam)
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		before := postCount(t, th, gm.Id)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMWriteAccess: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg @"+th.BasicUser2.Username+",@"+other.Username+" hello")
		require.NoError(t, err)
		require.Equal(t, dmGmWriteDeniedText, resp.Text)
		require.Equal(t, before, postCount(t, th, gm.Id), "nothing may be posted")
	})

	t.Run("/groupmsg to an existing group does not need Start", func(t *testing.T) {
		th := setupDMGMServer(t)
		other := th.CreateUser(t)
		th.LinkUserToTeam(t, other, th.BasicTeam)
		gm, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, other.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)
		before := postCount(t, th, gm.Id)
		installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

		resp, _, err := th.Client.ExecuteCommand(context.Background(), th.BasicChannel.Id, "/groupmsg @"+th.BasicUser2.Username+",@"+other.Username+" hello")
		require.NoError(t, err)
		require.Empty(t, resp.Text)
		require.Equal(t, before+1, postCount(t, th, gm.Id))
	})
}

func TestDMGMStartSearchInUser(t *testing.T) {
	for _, tc := range []struct {
		name   string
		search func(th *TestHelper, terms string) error
	}{
		{"posts", func(th *TestHelper, terms string) error {
			_, _, err := th.Client.SearchPosts(context.Background(), th.BasicTeam.Id, terms, false)
			return err
		}},
		{"files", func(th *TestHelper, terms string) error {
			_, _, err := th.Client.SearchFiles(context.Background(), th.BasicTeam.Id, terms, false)
			return err
		}},
	} {
		t.Run(tc.name+": in:@user creates no DM when Start is denied", func(t *testing.T) {
			th := setupDMGMServer(t)
			other := th.CreateUser(t)
			installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: false})

			require.NoError(t, tc.search(th, "hello in:@"+other.Username))
			requireNoConversation(t, th, model.GetDMNameFromIds(th.BasicUser.Id, other.Id))
		})

		t.Run(tc.name+": in:@user still creates the DM when Start allows", func(t *testing.T) {
			th := setupDMGMServer(t)
			other := th.CreateUser(t)
			installDMGMDecisions(t, th, map[string]bool{model.AccessControlPolicyActionDMGMStart: true})

			require.NoError(t, tc.search(th, "hello in:@"+other.Username))
			channel, appErr := th.App.GetDirectOrGroupChannelByName(th.Context, model.GetDMNameFromIds(th.BasicUser.Id, other.Id))
			require.Nil(t, appErr)
			require.NotNil(t, channel)
		})
	}
}
