// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

func createAudit(ss store.Store, userId, sessionId string) *model.Audit {
	audit := model.Audit{
		UserId:    userId,
		SessionId: sessionId,
		IpAddress: "ipaddress",
		Action:    "Action",
	}
	ss.Audit().Save(&audit)
	return &audit
}

func createChannel(ss store.Store, teamId, creatorId string) *model.Channel {
	m := model.Channel{}
	m.TeamId = teamId
	m.CreatorId = creatorId
	m.DisplayName = "Name"
	m.Name = "zz" + model.NewId() + "b"
	m.Type = model.ChannelTypeOpen
	c, _ := ss.Channel().Save(&m, -1)
	return c
}

func createChannelWithSchemeId(ss store.Store, schemeId *string) *model.Channel {
	m := model.Channel{}
	m.SchemeId = schemeId
	m.TeamId = model.NewId()
	m.CreatorId = model.NewId()
	m.DisplayName = "Name"
	m.Name = "zz" + model.NewId() + "b"
	m.Type = model.ChannelTypeOpen
	c, _ := ss.Channel().Save(&m, -1)
	return c
}

func createCommand(ss store.Store, userId, teamId string) *model.Command {
	m := model.Command{}
	m.CreatorId = userId
	m.Method = model.CommandMethodPost
	m.TeamId = teamId
	m.URL = "http://nowhere.com/"
	m.Trigger = "trigger"
	cmd, _ := ss.Command().Save(&m)
	return cmd
}

func createChannelMember(ss store.Store, channelId, userId string) *model.ChannelMember {
	m := model.ChannelMember{}
	m.ChannelId = channelId
	m.UserId = userId
	m.NotifyProps = model.GetDefaultChannelNotifyProps()
	cm, _ := ss.Channel().SaveMember(&m)
	return cm
}

func createChannelMemberHistory(ss store.Store, channelId, userId string) *model.ChannelMemberHistory {
	m := model.ChannelMemberHistory{}
	m.ChannelId = channelId
	m.UserId = userId
	ss.ChannelMemberHistory().LogJoinEvent(userId, channelId, model.GetMillis())
	return &m
}

func createChannelWithTeamId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, id, model.NewId())
}

func createChannelWithCreatorId(ss store.Store, id string) *model.Channel {
	return createChannel(ss, model.NewId(), id)
}

func createChannelMemberWithChannelId(ss store.Store, id string) *model.ChannelMember {
	return createChannelMember(ss, id, model.NewId())
}

func createCommandWebhook(ss store.Store, commandId, userId, channelId string) *model.CommandWebhook {
	m := model.CommandWebhook{}
	m.CommandId = commandId
	m.UserId = userId
	m.ChannelId = channelId
	cwh, _ := ss.CommandWebhook().Save(&m)
	return cwh
}

func createCompliance(ss store.Store, userId string) *model.Compliance {
	m := model.Compliance{}
	m.UserId = userId
	m.Desc = "Audit"
	m.Status = model.ComplianceStatusFailed
	m.StartAt = model.GetMillis() - 1
	m.EndAt = model.GetMillis() + 1
	m.Type = model.ComplianceTypeAdhoc
	c, _ := ss.Compliance().Save(&m)
	return c
}

func createEmoji(ss store.Store, userId string) *model.Emoji {
	m := model.Emoji{}
	m.CreatorId = userId
	m.Name = "emoji"
	emoji, _ := ss.Emoji().Save(&m)
	return emoji
}

func createFileInfo(ss store.Store, postId, userId string) *model.FileInfo {
	m := model.FileInfo{}
	m.PostId = postId
	m.CreatorId = userId
	m.Path = "some/path/to/file"
	info, _ := ss.FileInfo().Save(&m)
	return info
}

func createIncomingWebhook(ss store.Store, userId, channelId, teamId string) *model.IncomingWebhook {
	m := model.IncomingWebhook{}
	m.UserId = userId
	m.ChannelId = channelId
	m.TeamId = teamId
	wh, _ := ss.Webhook().SaveIncoming(&m)
	return wh
}

func createOAuthAccessData(ss store.Store, userId string) *model.AccessData {
	m := model.AccessData{}
	m.ClientId = model.NewId()
	m.UserId = userId
	m.Token = model.NewId()
	m.RefreshToken = model.NewId()
	m.RedirectUri = "http://example.com"
	ad, _ := ss.OAuth().SaveAccessData(&m)
	return ad
}

func createOAuthApp(ss store.Store, userId string) *model.OAuthApp {
	m := model.OAuthApp{}
	m.CreatorId = userId
	m.CallbackUrls = []string{"https://nowhere.com"}
	m.Homepage = "https://nowhere.com"
	m.Id = ""
	m.Name = "TestApp" + model.NewId()
	app, _ := ss.OAuth().SaveApp(&m)
	return app
}

func createOAuthAuthData(ss store.Store, userId string) *model.AuthData {
	m := model.AuthData{}
	m.ClientId = model.NewId()
	m.UserId = userId
	m.Code = model.NewId()
	m.RedirectUri = "http://example.com"
	ad, _ := ss.OAuth().SaveAuthData(&m)
	return ad
}

func createOutgoingWebhook(ss store.Store, userId, channelId, teamId string) *model.OutgoingWebhook {
	m := model.OutgoingWebhook{}
	m.CreatorId = userId
	m.ChannelId = channelId
	m.TeamId = teamId
	m.Token = model.NewId()
	m.CallbackURLs = []string{"http://nowhere.com/"}
	wh, _ := ss.Webhook().SaveOutgoing(&m)
	return wh
}

func createPost(ss store.Store, channelId, userId, rootId, parentId string) *model.Post {
	m := model.Post{}
	m.ChannelId = channelId
	m.UserId = userId
	m.RootId = rootId
	m.Message = "zz" + model.NewId() + "b"
	p, _ := ss.Post().Save(&m)
	return p
}

func createPostWithChannelId(ss store.Store, id string) *model.Post {
	return createPost(ss, id, model.NewId(), "", "")
}

func createPostWithUserId(ss store.Store, id string) *model.Post {
	return createPost(ss, model.NewId(), id, "", "")
}

func createPreferences(ss store.Store, userId string) model.Preferences {
	preferences := model.Preferences{
		{
			UserId:   userId,
			Name:     model.NewId(),
			Category: model.PreferenceCategoryDirectChannelShow,
			Value:    "somevalue",
		},
	}
	ss.Preference().Save(preferences)
	return preferences
}

func createReaction(ss store.Store, userId, postId string) *model.Reaction {
	reaction := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: model.NewId(),
		ChannelId: model.NewId(),
	}
	reaction, _ = ss.Reaction().Save(reaction)
	return reaction
}

func createDefaultRoles(ss store.Store) {
	ss.Role().Save(&model.Role{
		Name:        model.TeamAdminRoleId,
		DisplayName: model.TeamAdminRoleId,
		Permissions: []string{
			model.PermissionDeleteOthersPosts.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TeamUserRoleId,
		DisplayName: model.TeamUserRoleId,
		Permissions: []string{
			model.PermissionViewTeam.Id,
			model.PermissionAddUserToTeam.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TeamGuestRoleId,
		DisplayName: model.TeamGuestRoleId,
		Permissions: []string{
			model.PermissionViewTeam.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.ChannelAdminRoleId,
		DisplayName: model.ChannelAdminRoleId,
		Permissions: []string{
			model.PermissionManagePublicChannelMembers.Id,
			model.PermissionManagePrivateChannelMembers.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.ChannelUserRoleId,
		DisplayName: model.ChannelUserRoleId,
		Permissions: []string{
			model.PermissionReadChannel.Id,
			model.PermissionCreatePost.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.ChannelGuestRoleId,
		DisplayName: model.ChannelGuestRoleId,
		Permissions: []string{
			model.PermissionReadChannel.Id,
			model.PermissionCreatePost.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.PlaybookAdminRoleId,
		DisplayName: model.PlaybookAdminRoleId,
		Permissions: []string{
			model.PermissionPrivatePlaybookManageMembers.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.PlaybookMemberRoleId,
		DisplayName: model.PlaybookMemberRoleId,
		Permissions: []string{
			model.PermissionPrivatePlaybookManageMembers.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.RunAdminRoleId,
		DisplayName: model.RunAdminRoleId,
		Permissions: []string{
			model.PermissionRunManageMembers.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.RunMemberRoleId,
		DisplayName: model.RunMemberRoleId,
		Permissions: []string{
			model.PermissionRunManageMembers.Id,
		},
	})
}

func createScheme(ss store.Store) *model.Scheme {
	m := model.Scheme{}
	m.DisplayName = model.NewId()
	m.Name = model.NewId()
	m.Description = model.NewId()
	m.Scope = model.SchemeScopeChannel
	s, _ := ss.Scheme().Save(&m)
	return s
}

func createSession(ss store.Store, userId string) *model.Session {
	m := model.Session{}
	m.UserId = userId
	s, _ := ss.Session().Save(&m)
	return s
}

func createStatus(ss store.Store, userId string) *model.Status {
	m := model.Status{}
	m.UserId = userId
	m.Status = model.StatusOnline
	ss.Status().SaveOrUpdate(&m)
	return &m
}

func createTeam(ss store.Store) *model.Team {
	m := model.Team{}
	m.DisplayName = "DisplayName"
	m.Type = model.TeamOpen
	m.Email = "test@example.com"
	m.Name = "z-z-z" + model.NewRandomTeamName() + "b"
	t, _ := ss.Team().Save(&m)
	return t
}

func createTeamMember(ss store.Store, teamId, userId string) *model.TeamMember {
	m := model.TeamMember{}
	m.TeamId = teamId
	m.UserId = userId
	tm, _ := ss.Team().SaveMember(&m, -1)
	return tm
}

func createTeamWithSchemeId(ss store.Store, schemeId *string) *model.Team {
	m := model.Team{}
	m.SchemeId = schemeId
	m.DisplayName = "DisplayName"
	m.Type = model.TeamOpen
	m.Email = "test@example.com"
	m.Name = "z-z-z" + model.NewId() + "b"
	t, _ := ss.Team().Save(&m)
	return t
}

func createUser(ss store.Store) *model.User {
	m := model.User{}
	m.Username = model.NewId()
	m.Email = m.Username + "@example.com"
	user, _ := ss.User().Save(&m)
	return user
}

func createUserAccessToken(ss store.Store, userId string) *model.UserAccessToken {
	m := model.UserAccessToken{}
	m.UserId = userId
	m.Token = model.NewId()
	uat, _ := ss.UserAccessToken().Save(&m)
	return uat
}

func TestCheckIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		ss.DropAllTables()
		t.Run("generate reports with no records", func(t *testing.T) {
			results := ss.CheckIntegrity()
			require.NotNil(t, results)
			for result := range results {
				require.IsType(t, model.IntegrityCheckResult{}, result)
				require.NoError(t, result.Err)
				switch data := result.Data.(type) {
				case model.RelationalIntegrityCheckData:
					require.Empty(t, data.Records)
				}
			}
		})
	})
}

func TestCheckParentChildIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		t.Run("should receive an error", func(t *testing.T) {
			config := relationalCheckConfig{
				parentName:   "NotValid",
				parentIdAttr: "NotValid",
				childName:    "NotValid",
				childIdAttr:  "NotValid",
			}
			result := checkParentChildIntegrity(store, config)
			require.Error(t, result.Err)
			require.Empty(t, result.Data)
		})
	})
}

func TestCheckChannelsCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)

		})
		t.Run("should generate a report with one record", func(t *testing.T) {
			channelId := model.NewId()
			cwh := createCommandWebhook(ss, model.NewId(), model.NewId(), channelId)
			result := checkChannelsCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM CommandWebhooks Where Id=?`, cwh.Id)
		})
	})
}

func TestCheckChannelsChannelMemberHistoryIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsChannelMemberHistoryIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			user := createUser(ss)
			cmh := createChannelMemberHistory(ss, channel.Id, user.Id)

			dbmap.Exec(`DELETE FROM Channels Where Id=?`, channel.Id)
			result := checkChannelsChannelMemberHistoryIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &cmh.ChannelId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			dbmap.Exec(`DELETE FROM ChannelMemberHistory`)
		})
	})
}

func TestCheckChannelsChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsChannelMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			member := createChannelMemberWithChannelId(ss, channel.Id)
			dbmap.Exec(`DELETE FROM Channels Where Id=?`, channel.Id)
			result := checkChannelsChannelMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &member.ChannelId,
			}, data.Records[0])
			ss.Channel().PermanentDeleteMembersByChannel(member.ChannelId)
		})
	})
}

func TestCheckChannelsIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channelId := model.NewId()
			wh := createIncomingWebhook(ss, model.NewId(), channelId, model.NewId())
			result := checkChannelsIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM IncomingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckChannelsOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			channelId := channel.Id
			wh := createOutgoingWebhook(ss, model.NewId(), channelId, model.NewId())
			dbmap.Exec(`DELETE FROM Channels Where Id=?`, channel.Id)
			result := checkChannelsOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM OutgoingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckChannelsPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsPostsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithChannelId(ss, model.NewId())
			result := checkChannelsPostsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &post.ChannelId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, post.Id)
		})
	})
}

func TestCheckCommandsCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkCommandsCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			commandId := model.NewId()
			cwh := createCommandWebhook(ss, commandId, model.NewId(), model.NewId())
			result := checkCommandsCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &commandId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM CommandWebhooks Where Id=?`, cwh.Id)
		})
	})
}

func TestCheckPostsFileInfoIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsFileInfoIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			postId := model.NewId()
			info := createFileInfo(ss, postId, model.NewId())
			result := checkPostsFileInfoIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &postId,
				ChildId:  &info.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM FileInfo WHERE Id=?`, info.Id)
		})
	})
}

func TestCheckPostsPostsRootIdIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsPostsRootIdIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			root := createPost(ss, channel.Id, model.NewId(), "", "")
			rootId := root.Id
			post := createPost(ss, channel.Id, model.NewId(), root.Id, root.Id)
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, root.Id)
			result := checkPostsPostsRootIdIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &rootId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, post.Id)
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			dbmap.Exec(`DELETE FROM Threads WHERE PostId=?`, rootId)
		})
	})
}

func TestCheckPostsReactionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsReactionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			postId := model.NewId()
			reaction := createReaction(ss, model.NewId(), postId)
			result := checkPostsReactionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &postId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Reactions WHERE PostId=? AND UserId=? AND EmojiName=?`, reaction.PostId, reaction.UserId, reaction.EmojiName)
		})
	})
}

func TestCheckSchemesChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSchemesChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			createDefaultRoles(ss)
			scheme := createScheme(ss)
			schemeId := scheme.Id
			channel := createChannelWithSchemeId(ss, &schemeId)
			dbmap.Exec(`DELETE FROM Schemes WHERE Id=?`, scheme.Id)
			result := checkSchemesChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &schemeId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
		})
	})
}

func TestCheckSchemesTeamsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSchemesTeamsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			createDefaultRoles(ss)
			scheme := createScheme(ss)
			schemeId := scheme.Id
			team := createTeamWithSchemeId(ss, &schemeId)
			dbmap.Exec(`DELETE FROM Schemes WHERE Id=?`, scheme.Id)
			result := checkSchemesTeamsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &schemeId,
				ChildId:  &team.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Teams WHERE Id=?`, team.Id)
		})
	})
}

func TestCheckSessionsAuditsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSessionsAuditsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			session := createSession(ss, model.NewId())
			sessionId := session.Id
			audit := createAudit(ss, userId, sessionId)
			dbmap.Exec(`DELETE FROM Sessions WHERE Id=?`, session.Id)
			result := checkSessionsAuditsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &sessionId,
				ChildId:  &audit.Id,
			}, data.Records[0])
			ss.Audit().PermanentDeleteByUser(userId)
		})
	})
}

func TestCheckTeamsChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithTeamId(ss, model.NewId())
			result := checkTeamsChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channel.TeamId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
		})

		t.Run("should not include direct channel with empty teamid", func(t *testing.T) {
			channel := createChannelWithTeamId(ss, model.NewId())
			userA := createUser(ss)
			userB := createUser(ss)
			direct, err := ss.Channel().CreateDirectChannel(userA, userB)
			require.NoError(t, err)
			require.NotNil(t, direct)
			result := checkTeamsChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channel.TeamId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, userA.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, userB.Id)
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, direct.Id)
		})

		t.Run("should include direct channel with non empty teamid", func(t *testing.T) {
			channel := createChannelWithTeamId(ss, model.NewId())
			userA := createUser(ss)
			userB := createUser(ss)
			direct, err := ss.Channel().CreateDirectChannel(userA, userB)
			require.NoError(t, err)
			require.NotNil(t, direct)
			_, err = dbmap.Exec(`UPDATE Channels SET TeamId = 'test' WHERE Id = '` + direct.Id + `'`)
			require.NoError(t, err)
			result := checkTeamsChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 2)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channel.TeamId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			require.Equal(t, model.OrphanedRecord{
				ParentId: model.NewString("test"),
				ChildId:  &direct.Id,
			}, data.Records[1])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, userA.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, userB.Id)
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, direct.Id)
			dbmap.Exec("DELETE FROM ChannelMembers")
		})
	})
}

func TestCheckTeamsCommandsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsCommandsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			cmd := createCommand(ss, model.NewId(), teamId)
			result := checkTeamsCommandsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &cmd.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Commands WHERE Id=?`, cmd.Id)
		})
	})
}

func TestCheckTeamsIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			wh := createIncomingWebhook(ss, model.NewId(), model.NewId(), teamId)
			result := checkTeamsIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM IncomingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckTeamsOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			wh := createOutgoingWebhook(ss, model.NewId(), model.NewId(), teamId)
			result := checkTeamsOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM OutgoingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckTeamsTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsTeamMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			team := createTeam(ss)
			member := createTeamMember(ss, team.Id, model.NewId())
			dbmap.Exec(`DELETE FROM Teams WHERE Id=?`, team.Id)
			result := checkTeamsTeamMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &team.Id,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
		})
	})
}

func TestCheckUsersAuditsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersAuditsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			audit := createAudit(ss, userId, model.NewId())
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersAuditsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &audit.Id,
			}, data.Records[0])
			ss.Audit().PermanentDeleteByUser(userId)
		})
	})
}

func TestCheckUsersCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			cwh := createCommandWebhook(ss, model.NewId(), userId, model.NewId())
			result := checkUsersCommandWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM CommandWebhooks WHERE Id=?`, cwh.Id)
		})
	})
}

func TestCheckUsersChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithCreatorId(ss, model.NewId())
			result := checkUsersChannelsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &channel.CreatorId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
		})
	})
}

func TestCheckUsersChannelMemberHistoryIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelMemberHistoryIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			channel := createChannel(ss, model.NewId(), model.NewId())
			cmh := createChannelMemberHistory(ss, channel.Id, user.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersChannelMemberHistoryIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &cmh.UserId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			dbmap.Exec(`DELETE FROM ChannelMemberHistory`)
		})
	})
}

func TestCheckUsersChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			channel := createChannelWithCreatorId(ss, user.Id)
			member := createChannelMember(ss, channel.Id, user.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersChannelMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &member.UserId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			ss.Channel().PermanentDeleteMembersByUser(member.UserId)
		})
	})
}

func TestCheckUsersCommandsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCommandsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			cmd := createCommand(ss, userId, model.NewId())
			result := checkUsersCommandsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &cmd.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Commands WHERE Id=?`, cmd.Id)
		})
	})
}

func TestCheckUsersCompliancesIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCompliancesIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			compliance := createCompliance(ss, userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersCompliancesIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &compliance.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Compliances WHERE Id=?`, compliance.Id)
		})
	})
}

func TestCheckUsersEmojiIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersEmojiIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			emoji := createEmoji(ss, userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersEmojiIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &emoji.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Emoji WHERE Id=?`, emoji.Id)
		})
	})
}

func TestCheckUsersFileInfoIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersFileInfoIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			info := createFileInfo(ss, model.NewId(), userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersFileInfoIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &info.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM FileInfo WHERE Id=?`, info.Id)
		})
	})
}

func TestCheckUsersIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			wh := createIncomingWebhook(ss, userId, model.NewId(), model.NewId())
			result := checkUsersIncomingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM IncomingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckUsersOAuthAccessDataIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAccessDataIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			ad := createOAuthAccessData(ss, userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersOAuthAccessDataIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &ad.Token,
			}, data.Records[0])
			ss.OAuth().RemoveAccessData(ad.Token)
		})
	})
}

func TestCheckUsersOAuthAppsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAppsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			app := createOAuthApp(ss, userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersOAuthAppsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &app.Id,
			}, data.Records[0])
			ss.OAuth().DeleteApp(app.Id)
		})
	})
}

func TestCheckUsersOAuthAuthDataIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAuthDataIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			ad := createOAuthAuthData(ss, userId)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersOAuthAuthDataIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &ad.Code,
			}, data.Records[0])
			ss.OAuth().RemoveAuthData(ad.Code)
		})
	})
}

func TestCheckUsersOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			wh := createOutgoingWebhook(ss, userId, model.NewId(), model.NewId())
			result := checkUsersOutgoingWebhooksIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM OutgoingWebhooks WHERE Id=?`, wh.Id)
		})
	})
}

func TestCheckUsersPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersPostsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithUserId(ss, model.NewId())
			result := checkUsersPostsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &post.UserId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, post.Id)
		})
	})
}

func TestCheckUsersPreferencesIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersPreferencesIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with no records", func(t *testing.T) {
			user := createUser(ss)
			require.NotNil(t, user)
			userId := user.Id
			preferences := createPreferences(ss, userId)
			require.NotNil(t, preferences)
			result := checkUsersPreferencesIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
			dbmap.Exec(`DELETE FROM Preferences`)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			require.NotNil(t, user)
			userId := user.Id
			preferences := createPreferences(ss, userId)
			require.NotNil(t, preferences)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersPreferencesIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Preferences`)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
		})
	})
}

func TestCheckUsersReactionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersReactionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			reaction := createReaction(ss, user.Id, model.NewId())
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersReactionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Reactions WHERE PostId=? AND UserId=? AND EmojiName=?`, reaction.PostId, reaction.UserId, reaction.EmojiName)
		})
	})
}

func TestCheckUsersSessionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersSessionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			session := createSession(ss, userId)
			result := checkUsersSessionsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &session.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Sessions WHERE Id=?`, session.Id)
		})
	})
}

func TestCheckUsersStatusIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersStatusIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			status := createStatus(ss, user.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersStatusIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Status WHERE Id=?`, status.UserId)
		})
	})
}

func TestCheckUsersTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersTeamMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			team := createTeam(ss)
			member := createTeamMember(ss, team.Id, user.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersTeamMembersIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &member.UserId,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
			dbmap.Exec(`DELETE FROM Teams WHERE Id=?`, team.Id)
		})
	})
}

func TestCheckUsersUserAccessTokensIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersUserAccessTokensIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			uat := createUserAccessToken(ss, user.Id)
			dbmap.Exec(`DELETE FROM Users WHERE Id=?`, user.Id)
			result := checkUsersUserAccessTokensIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, model.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &uat.Id,
			}, data.Records[0])
			ss.UserAccessToken().Delete(uat.Id)
		})
	})
}

func TestCheckThreadsTeamsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		store := ss.(*SqlStore)
		dbmap := store.GetMasterX()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkThreadsTeamsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			team := createTeam(ss)
			channel := createChannel(ss, team.Id, model.NewId())
			root := createPost(ss, channel.Id, model.NewId(), "", "")
			post := createPost(ss, channel.Id, model.NewId(), root.Id, root.Id)

			dbmap.Exec(`DELETE FROM Teams WHERE Id=?`, team.Id)
			result := checkThreadsTeamsIntegrity(store)
			require.NoError(t, result.Err)
			data := result.Data.(model.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)

			require.Equal(t, model.OrphanedRecord{
				ParentId: &team.Id,
				ChildId:  &root.Id,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, post.Id)
			dbmap.Exec(`DELETE FROM Posts WHERE Id=?`, root.Id)
			dbmap.Exec(`DELETE FROM Channels WHERE Id=?`, channel.Id)
			dbmap.Exec(`DELETE FROM Threads WHERE PostId=?`, root.Id)
		})
	})
}
