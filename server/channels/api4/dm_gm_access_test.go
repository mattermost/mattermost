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
