// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
	"github.com/stretchr/testify/require"
)

// captureWebSocketEvents runs publish and returns every websocket event it published.
func captureWebSocketEvents(t *testing.T, th *TestHelper, publish func()) []*model.WebSocketEvent {
	t.Helper()

	cluster := &testlib.FakeClusterInterface{}
	th.Server.Platform().SetCluster(cluster)
	t.Cleanup(func() { th.Server.Platform().SetCluster(nil) })
	publish()

	var events []*model.WebSocketEvent
	for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventPublish
	}) {
		event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
		require.NoError(t, err)
		events = append(events, event)
	}
	return events
}

// dmGmReadGoverned puts reading conversations, and nothing else, under a policy.
func dmGmReadGoverned(mockACS *eMocks.AccessControlServiceInterface) {
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionDMGMReadAccess).Return(true, nil)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
}

// createDMGMPost posts as userID in channel. It isn't backdated, which would send the
// notifications through the channel member history fallback.
func createDMGMPost(t *testing.T, th *TestHelper, channel *model.Channel, userID, rootID string) *model.Post {
	t.Helper()
	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    userID,
		ChannelId: channel.Id,
		RootId:    rootID,
		Message:   "message " + model.NewId(),
	}, channel, model.CreatePostFlags{})
	require.Nil(t, appErr)
	return post
}

func TestDMGMEventsCarryTheReadAccessHook(t *testing.T) {
	cases := []struct {
		name string
		// events the publisher is expected to emit about the conversation; every one
		// must carry the hook.
		events []model.WebsocketEventType
		// run publishes, and returns ids that identify its events as being about the
		// conversation, beyond the conversation's own id.
		run func(t *testing.T, f *dmGmFixture) []string
	}{
		{
			name: "posts",
			events: []model.WebsocketEventType{
				model.WebsocketEventPosted,
				model.WebsocketEventPostEdited,
				model.WebsocketEventPostDeleted,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				post := createDMGMPost(t, f.th, f.dm, f.th.BasicUser.Id, "")
				post = post.Clone()
				post.Message = "edited"
				_, _, appErr := f.th.App.UpdatePost(f.rctx, post, nil)
				require.Nil(t, appErr)
				_, appErr = f.th.App.DeletePost(f.rctx, post.Id, f.th.BasicUser.Id)
				require.Nil(t, appErr)
				return nil
			},
		},
		{
			name: "reactions and acknowledgements",
			events: []model.WebsocketEventType{
				model.WebsocketEventReactionAdded,
				model.WebsocketEventReactionRemoved,
				model.WebsocketEventAcknowledgementAdded,
				model.WebsocketEventAcknowledgementRemoved,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				post := createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				reaction := &model.Reaction{UserId: f.th.BasicUser.Id, PostId: post.Id, EmojiName: "smile"}
				_, appErr := f.th.App.SaveReactionForPost(f.rctx, reaction)
				require.Nil(t, appErr)
				require.Nil(t, f.th.App.DeleteReactionForPost(f.rctx, reaction))
				_, appErr = f.th.App.SaveAcknowledgementForPost(f.rctx, post.Id, f.th.BasicUser.Id)
				require.Nil(t, appErr)
				require.Nil(t, f.th.App.DeleteAcknowledgementForPost(f.rctx, post.Id, f.th.BasicUser.Id))
				return nil
			},
		},
		{
			name:   "channel update",
			events: []model.WebsocketEventType{model.WebsocketEventChannelUpdated},
			run: func(t *testing.T, f *dmGmFixture) []string {
				channel := f.dm.DeepCopy()
				channel.Header = "Header revision " + model.NewId()
				_, appErr := f.th.App.UpdateChannel(f.rctx, channel)
				require.Nil(t, appErr)
				return nil
			},
		},
		{
			name:   "direct added",
			events: []model.WebsocketEventType{model.WebsocketEventDirectAdded},
			run: func(t *testing.T, f *dmGmFixture) []string {
				dm, appErr := f.th.App.GetOrCreateDirectChannel(f.th.Context, f.th.BasicUser.Id, f.th.CreateUser(t).Id)
				require.Nil(t, appErr)
				return []string{dm.Id}
			},
		},
		{
			name:   "group added",
			events: []model.WebsocketEventType{model.WebsocketEventGroupAdded},
			run: func(t *testing.T, f *dmGmFixture) []string {
				gm, appErr := f.th.App.CreateGroupChannel(f.th.Context,
					[]string{f.th.BasicUser.Id, f.th.CreateUser(t).Id, f.th.CreateUser(t).Id}, f.th.BasicUser.Id)
				require.Nil(t, appErr)
				return []string{gm.Id}
			},
		},
		{
			name: "threads",
			events: []model.WebsocketEventType{
				model.WebsocketEventThreadUpdated,
				model.WebsocketEventThreadReadChanged,
				model.WebsocketEventThreadFollowChanged,
				model.WebsocketEventPostUnread,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				root := createDMGMPost(t, f.th, f.dm, f.th.BasicUser.Id, "")
				// The reply follows BasicUser into the thread: thread_updated.
				reply := createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, root.Id)

				_, appErr := f.th.App.UpdateThreadReadForUser(f.rctx, f.rctx.Session().Id, f.th.BasicUser.Id, "", root.Id, model.GetMillis())
				require.Nil(t, appErr)
				_, appErr = f.th.App.MarkChannelAsUnreadFromPost(f.rctx, reply.Id, f.th.BasicUser.Id, true)
				require.Nil(t, appErr)
				require.Nil(t, f.th.App.UpdateThreadFollowForUser(f.th.BasicUser.Id, "", root.Id, false))
				return []string{root.Id}
			},
		},
		{
			name: "thread follow from channel add",
			events: []model.WebsocketEventType{
				model.WebsocketEventThreadUpdated,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				root := createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, root.Id)
				require.Nil(t, f.th.App.UpdateThreadFollowForUserFromChannelAdd(f.rctx, f.th.BasicUser.Id, "", root.Id))
				return []string{root.Id}
			},
		},
		{
			name: "marking conversations viewed",
			events: []model.WebsocketEventType{
				model.WebsocketEventMultipleChannelsViewed,
				model.WebsocketEventThreadReadChanged,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				_, appErr := f.th.App.MarkAllDirectAndGroupMessagesViewed(f.rctx, f.th.BasicUser.Id, f.rctx.Session().Id, true)
				require.Nil(t, appErr)
				return nil
			},
		},
		{
			name:   "marking one conversation viewed",
			events: []model.WebsocketEventType{model.WebsocketEventThreadReadChanged},
			run: func(t *testing.T, f *dmGmFixture) []string {
				createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				_, appErr := f.th.App.MarkChannelsAsViewed(f.rctx, []string{f.dm.Id}, f.th.BasicUser.Id, f.rctx.Session().Id, false, true)
				require.Nil(t, appErr)
				return nil
			},
		},
		{
			name: "drafts",
			events: []model.WebsocketEventType{
				model.WebsocketEventDraftCreated,
				model.WebsocketEventDraftDeleted,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				draft, appErr := f.th.App.UpsertDraft(f.rctx, &model.Draft{
					UserId:    f.th.BasicUser.Id,
					ChannelId: f.dm.Id,
					Message:   "draft",
				}, "")
				require.Nil(t, appErr)
				require.Nil(t, f.th.App.DeleteDraft(f.rctx, draft, ""))
				return nil
			},
		},
		{
			name: "scheduled posts",
			events: []model.WebsocketEventType{
				model.WebsocketScheduledPostCreated,
				model.WebsocketScheduledPostDeleted,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				scheduled, appErr := f.th.App.SaveScheduledPost(f.rctx, &model.ScheduledPost{
					Draft:       model.Draft{UserId: f.th.BasicUser.Id, ChannelId: f.dm.Id, Message: "scheduled"},
					ScheduledAt: model.GetMillis() + 100000,
				}, "")
				require.Nil(t, appErr)
				_, appErr = f.th.App.DeleteScheduledPost(f.rctx, f.th.BasicUser.Id, scheduled.Id, "")
				require.Nil(t, appErr)
				return nil
			},
		},
		{
			name: "ephemeral posts",
			events: []model.WebsocketEventType{
				model.WebsocketEventEphemeralMessage,
				model.WebsocketEventPostEdited,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				post := &model.Post{ChannelId: f.dm.Id, Message: "ephemeral"}
				post, _ = f.th.App.SendEphemeralPost(f.rctx, f.th.BasicUser.Id, post)
				post.Message = "edited"
				f.th.App.UpdateEphemeralPost(f.rctx, f.th.BasicUser.Id, post)
				return nil
			},
		},
		{
			name:   "persistent notifications",
			events: []model.WebsocketEventType{model.WebsocketEventPersistentNotificationTriggered},
			run: func(t *testing.T, f *dmGmFixture) []string {
				post := createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				require.NoError(t, f.th.App.sendPersistentNotifications(post, f.dm, &model.Team{},
					&MentionResults{Mentions: map[string]MentionType{f.th.BasicUser.Id: KeywordMention}},
					model.UserMap{f.th.BasicUser.Id: f.th.BasicUser, f.th.BasicUser2.Id: f.th.BasicUser2}, nil))
				return nil
			},
		},
		{
			name: "burn on read",
			events: []model.WebsocketEventType{
				model.WebsocketEventPostRevealed,
				model.WebsocketEventPostBurned,
				model.WebsocketEventBurnOnReadAllRevealed,
			},
			run: func(t *testing.T, f *dmGmFixture) []string {
				post := createDMGMPost(t, f.th, f.dm, f.th.BasicUser2.Id, "")
				require.Nil(t, f.th.App.publishPostRevealedEventToAuthor(f.rctx, post, f.th.BasicUser.Id, ""))
				require.Nil(t, f.th.App.publishPostRevealedEventToUser(f.rctx, post, f.th.BasicUser.Id, ""))
				require.Nil(t, f.th.App.publishPostBurnedEvent(post.Id, f.dm.Id, f.th.BasicUser.Id, ""))
				require.Nil(t, f.th.App.publishAllRecipientsRevealedEvent(f.rctx, post, 0))
				return nil
			},
		},
		{
			name:   "channel member updates",
			events: []model.WebsocketEventType{model.WebsocketEventChannelMemberUpdated},
			run: func(t *testing.T, f *dmGmFixture) []string {
				_, appErr := f.th.App.UpdateChannelMemberNotifyProps(f.rctx,
					map[string]string{model.DesktopNotifyProp: model.ChannelNotifyMention}, f.dm.Id, f.th.BasicUser.Id)
				require.Nil(t, appErr)
				_, appErr = f.th.App.ToggleMuteChannel(f.rctx, f.dm.Id, f.th.BasicUser.Id)
				require.Nil(t, appErr)
				_, appErr = f.th.App.setChannelsMuted(f.rctx, []string{f.dm.Id}, f.th.BasicUser.Id, false)
				require.Nil(t, appErr)
				require.NoError(t, f.th.App.ClearChannelMembersCache(f.rctx, f.dm.Id))
				return nil
			},
		},
		{
			name:   "guest promotion",
			events: []model.WebsocketEventType{model.WebsocketEventChannelMemberUpdated},
			run: func(t *testing.T, f *dmGmFixture) []string {
				require.Nil(t, f.th.App.DemoteUserToGuest(f.rctx, f.th.BasicUser2))
				require.Nil(t, f.th.App.PromoteGuestToUser(f.rctx, f.th.BasicUser2, f.th.BasicUser.Id))
				return nil
			},
		},
	}

	// about reports whether event concerns the conversation: it is addressed to it, or
	// names it, or one of ids, in its payload.
	about := func(event *model.WebSocketEvent, ids []string) bool {
		if slices.Contains(ids, event.GetBroadcast().ChannelId) {
			return true
		}
		data, err := event.ToJSON()
		if err != nil {
			return false
		}
		return slices.ContainsFunc(ids, func(id string) bool { return strings.Contains(string(data), id) })
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			f := setupDMGMAccessTest(t)
			f.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.CollapsedThreads = model.CollapsedThreadsAlwaysOn
				*cfg.ServiceSettings.ScheduledPosts = true
				*cfg.ServiceSettings.PostPriority = true
				*cfg.ServiceSettings.AllowPersistentNotificationsForGuests = true
			})
			f.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
			mockACS := f.mockACS(t)
			dmGmReadGoverned(mockACS)
			mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, nil)

			var ids []string
			events := captureWebSocketEvents(t, f.th, func() { ids = append(tc.run(t, f), f.dm.Id) })
			for _, eventType := range tc.events {
				published := 0
				for _, event := range events {
					if event.EventType() != eventType || !about(event, ids) {
						continue
					}
					published++
					require.Contains(t, event.GetBroadcast().BroadcastHooks, broadcastDMGMReadAccess, "%s", eventType)
				}
				require.NotZero(t, published, "%s was not published", eventType)
			}

			// Turning ABAC off rather than dropping the license, so that the
			// publishers under test keep whatever licensing they need of their own.
			f.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})
			events = captureWebSocketEvents(t, f.th, func() { tc.run(t, f) })
			require.NotEmpty(t, events)
			for _, event := range events {
				require.NotContains(t, event.GetBroadcast().BroadcastHooks, broadcastDMGMReadAccess, "%s", event.EventType())
			}
		})
	}
}

func TestDMGMReadAccessHookOnlyForConversations(t *testing.T) {
	hooks := func(t *testing.T, setup func(*model.WebSocketEvent)) []string {
		t.Helper()
		message := model.NewWebSocketEvent(model.WebsocketEventDraftCreated, "", "", model.NewId(), nil, "")
		setup(message)
		return message.GetBroadcast().BroadcastHooks
	}

	t.Run("a conversation, while reading conversations is governed", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		dmGmReadGoverned(f.mockACS(t))
		for _, channel := range []*model.Channel{f.dm, f.gm} {
			require.Equal(t, []string{broadcastDMGMReadAccess}, hooks(t, func(m *model.WebSocketEvent) {
				f.th.App.setupBroadcastHookForDirectAndGroupReadAccessByID(channel.Id, m)
			}))
		}
	})

	t.Run("not while reading conversations is ungoverned", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		f.mockACS(t).On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil)
		require.Empty(t, hooks(t, func(m *model.WebSocketEvent) {
			f.th.App.setupBroadcastHookForDirectAndGroupReadAccessByID(f.dm.Id, m)
		}))
		require.Empty(t, hooks(t, f.th.App.setupBroadcastHookForConversationReadAccess))
	})

	t.Run("not for a channel", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		// No expectations: the check must not reach the access control service.
		f.mockACS(t)
		require.Empty(t, hooks(t, func(m *model.WebSocketEvent) {
			f.th.App.setupBroadcastHookForDirectAndGroupReadAccessByID(f.th.BasicChannel.Id, m)
		}))
	})

	t.Run("a channel that can't be loaded gets the channel read hook", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		f.mockACS(t)
		require.Equal(t, []string{broadcastChannelReadAccess}, hooks(t, func(m *model.WebSocketEvent) {
			f.th.App.setupBroadcastHookForDirectAndGroupReadAccessByID(model.NewId(), m)
		}))
	})
}

func TestDMGMReadDecisionCache(t *testing.T) {
	setup := func(t *testing.T) (*dmGmFixture, *eMocks.AccessControlServiceInterface) {
		t.Helper()
		f := setupDMGMAccessTest(t)
		enableSessionAttributesCollection(t, f.th)
		require.NoError(t, f.th.App.Srv().Store().SessionAttribute().Refresh(f.rctx.Session().Id,
			map[string]any{model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10"}, model.GetMillis()))
		mockACS := f.mockACS(t)
		dmGmReadGoverned(mockACS)
		decidesDMGM(mockACS, map[string]bool{model.AccessControlPolicyActionDMGMReadAccess: true})
		return f, mockACS
	}
	session := func(f *dmGmFixture) *model.Session {
		return f.rctx.Session()
	}
	// read asks with a context that has the session and no per-request memo, as the
	// WebSocket hook's has.
	read := func(f *dmGmFixture, s *model.Session) bool {
		return f.th.App.HasDirectAndGroupReadAccessForSession(f.th.Context.WithSession(s))
	}

	t.Run("reuses a decision while its inputs are unchanged", func(t *testing.T) {
		f, mockACS := setup(t)
		require.True(t, read(f, session(f)))
		require.True(t, read(f, session(f)))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 1)
	})

	t.Run("does not share a decision between sessions", func(t *testing.T) {
		f, mockACS := setup(t)
		other, appErr := f.th.App.CreateSession(f.th.Context, &model.Session{UserId: f.th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)

		require.True(t, read(f, session(f)))
		require.True(t, read(f, other))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	t.Run("does not cache an evaluation error", func(t *testing.T) {
		f := setupDMGMAccessTest(t)
		mockACS := f.mockACS(t)
		dmGmReadGoverned(mockACS)
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", 500))

		require.False(t, read(f, session(f)))
		require.False(t, read(f, session(f)))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	for name, change := range map[string]func(t *testing.T, f *dmGmFixture) *model.Session{
		"the session attributes change": func(t *testing.T, f *dmGmFixture) *model.Session {
			require.NoError(t, f.th.App.Srv().Store().SessionAttribute().Refresh(session(f).Id,
				map[string]any{model.SessionAttributesPropertyFieldIPAddress: "192.0.2.11"}, model.GetMillis()))
			return session(f)
		},
		"the user's property values change": func(t *testing.T, f *dmGmFixture) *model.Session {
			_, err := f.th.App.Srv().Store().PropertyValue().Create(&model.PropertyValue{
				TargetID:   f.th.BasicUser.Id,
				TargetType: model.PropertyValueTargetTypeUser,
				GroupID:    model.NewId(),
				FieldID:    model.NewId(),
				Value:      []byte(`"value"`),
			})
			require.NoError(t, err)
			f.th.App.Srv().Store().Attributes().InvalidateUserPropertyValuesEpoch(f.th.BasicUser.Id)
			return session(f)
		},
		"the session roles change": func(t *testing.T, f *dmGmFixture) *model.Session {
			s := session(f).DeepCopy()
			s.Roles = model.SystemUserRoleId + " " + model.SystemAdminRoleId
			return s
		},
		"the user changes": func(t *testing.T, f *dmGmFixture) *model.Session {
			// Strictly later than the user's current UpdateAt.
			time.Sleep(time.Millisecond)
			_, err := f.th.App.Srv().Store().User().UpdateUpdateAt(f.th.BasicUser.Id)
			require.NoError(t, err)
			f.th.App.InvalidateCacheForUser(f.th.BasicUser.Id)
			return session(f)
		},
		"a permission policy changes": func(t *testing.T, f *dmGmFixture) *model.Session {
			policy, err := f.th.App.Srv().Store().AccessControlPolicy().Save(f.rctx, &model.AccessControlPolicy{
				ID:       model.NewId(),
				Type:     model.AccessControlPolicyTypePermission,
				Name:     "dm-gm-read",
				Active:   true,
				Revision: 1,
				Version:  model.AccessControlPolicyVersionV0_3,
				Roles:    []string{model.SystemUserRoleId},
				Rules: []model.AccessControlPolicyRule{
					{Actions: []string{model.AccessControlPolicyActionDMGMReadAccess}, Expression: "true"},
				},
			})
			require.NoError(t, err)
			t.Cleanup(func() { _ = f.th.App.Srv().Store().AccessControlPolicy().Delete(f.rctx, policy.ID) })
			f.th.App.Srv().Store().AccessControlPolicy().ClearEtagCache()
			return session(f)
		},
	} {
		t.Run("evaluates again when "+name, func(t *testing.T) {
			f, mockACS := setup(t)
			require.True(t, read(f, session(f)))
			require.True(t, read(f, change(t, f)))
			mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
		})
	}

	t.Run("evaluates again once the decision expires", func(t *testing.T) {
		f, mockACS := setup(t)
		original := f.th.App.ch.dmGmReadDecisions
		f.th.App.ch.dmGmReadDecisions = cache.NewLRU(&cache.CacheOptions{Size: 10, DefaultExpiry: time.Millisecond})
		t.Cleanup(func() { f.th.App.ch.dmGmReadDecisions = original })

		require.True(t, read(f, session(f)))
		time.Sleep(5 * time.Millisecond)
		require.True(t, read(f, session(f)))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	t.Run("allows without reading anything while enforcement is off", func(t *testing.T) {
		f, mockACS := setup(t)
		f.th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})
		require.True(t, read(f, session(f)))
		require.Empty(t, mockACS.Calls)
	})
}
