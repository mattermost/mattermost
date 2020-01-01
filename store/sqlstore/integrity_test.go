// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
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
	m.Type = model.CHANNEL_OPEN
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
	m.Type = model.CHANNEL_OPEN
	c, _ := ss.Channel().Save(&m, -1)
	return c
}

func createCommand(ss store.Store, userId, teamId string) *model.Command {
	m := model.Command{}
	m.CreatorId = userId
	m.Method = model.COMMAND_METHOD_POST
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
	m.Status = model.COMPLIANCE_STATUS_FAILED
	m.StartAt = model.GetMillis() - 1
	m.EndAt = model.GetMillis() + 1
	m.Type = model.COMPLIANCE_TYPE_ADHOC
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
	m.ParentId = parentId
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

func createPreferences(ss store.Store, userId string) *model.Preferences {
	preferences := model.Preferences{
		{
			UserId:   userId,
			Name:     model.NewId(),
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Value:    "somevalue",
		},
	}
	ss.Preference().Save(&preferences)
	return &preferences
}

func createReaction(ss store.Store, userId, postId string) *model.Reaction {
	reaction := &model.Reaction{
		UserId:    userId,
		PostId:    postId,
		EmojiName: model.NewId(),
	}
	reaction, _ = ss.Reaction().Save(reaction)
	return reaction
}

func createDefaultRoles(ss store.Store) {
	ss.Role().Save(&model.Role{
		Name:        model.TEAM_ADMIN_ROLE_ID,
		DisplayName: model.TEAM_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_DELETE_OTHERS_POSTS.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TEAM_USER_ROLE_ID,
		DisplayName: model.TEAM_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_VIEW_TEAM.Id,
			model.PERMISSION_ADD_USER_TO_TEAM.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.TEAM_GUEST_ROLE_ID,
		DisplayName: model.TEAM_GUEST_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_VIEW_TEAM.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_ADMIN_ROLE_ID,
		DisplayName: model.CHANNEL_ADMIN_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_MANAGE_PUBLIC_CHANNEL_MEMBERS.Id,
			model.PERMISSION_MANAGE_PRIVATE_CHANNEL_MEMBERS.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_USER_ROLE_ID,
		DisplayName: model.CHANNEL_USER_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_CREATE_POST.Id,
		},
	})

	ss.Role().Save(&model.Role{
		Name:        model.CHANNEL_GUEST_ROLE_ID,
		DisplayName: model.CHANNEL_GUEST_ROLE_ID,
		Permissions: []string{
			model.PERMISSION_READ_CHANNEL.Id,
			model.PERMISSION_CREATE_POST.Id,
		},
	})
}

func createScheme(ss store.Store) *model.Scheme {
	m := model.Scheme{}
	m.DisplayName = model.NewId()
	m.Name = model.NewId()
	m.Description = model.NewId()
	m.Scope = model.SCHEME_SCOPE_CHANNEL
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
	m.Status = model.STATUS_ONLINE
	ss.Status().SaveOrUpdate(&m)
	return &m
}

func createTeam(ss store.Store, userId string) *model.Team {
	m := model.Team{}
	m.DisplayName = "DisplayName"
	m.Type = model.TEAM_OPEN
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
	m.Type = model.TEAM_OPEN
	m.Email = "test@example.com"
	m.Name = "z-z-z" + model.NewId() + "b"
	t, _ := ss.Team().Save(&m)
	return t
}

func createUser(ss store.Store) *model.User {
	m := model.User{}
	m.Username = model.NewId()
	m.Email = "test@example.com"
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
				require.IsType(t, store.IntegrityCheckResult{}, result)
				require.Nil(t, result.Err)
				switch data := result.Data.(type) {
				case store.RelationalIntegrityCheckData:
					require.Empty(t, data.Records)
				}
			}
		})
	})
}

func TestCheckParentChildIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		t.Run("should receive an error", func(t *testing.T) {
			config := relationalCheckConfig{
				parentName:   "NotValid",
				parentIdAttr: "NotValid",
				childName:    "NotValid",
				childIdAttr:  "NotValid",
			}
			result := checkParentChildIntegrity(supplier, config)
			require.NotNil(t, result.Err)
			require.Empty(t, result.Data)
		})
	})
}

func TestCheckChannelsCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channelId := model.NewId()
			cwh := createCommandWebhook(ss, model.NewId(), model.NewId(), channelId)
			result := checkChannelsCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Delete(cwh)
		})
	})
}

func TestCheckChannelsChannelMemberHistoryIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsChannelMemberHistoryIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			user := createUser(ss)
			cmh := createChannelMemberHistory(ss, channel.Id, user.Id)
			dbmap.Delete(channel)
			result := checkChannelsChannelMemberHistoryIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &cmh.ChannelId,
			}, data.Records[0])
			dbmap.Delete(user)
			dbmap.Exec(`DELETE FROM ChannelMemberHistory`)
		})
	})
}

func TestCheckChannelsChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsChannelMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			member := createChannelMemberWithChannelId(ss, channel.Id)
			dbmap.Delete(channel)
			result := checkChannelsChannelMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &member.ChannelId,
			}, data.Records[0])
			ss.Channel().PermanentDeleteMembersByChannel(member.ChannelId)
		})
	})
}

func TestCheckChannelsIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channelId := model.NewId()
			wh := createIncomingWebhook(ss, model.NewId(), channelId, model.NewId())
			result := checkChannelsIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckChannelsOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannel(ss, model.NewId(), model.NewId())
			channelId := channel.Id
			wh := createOutgoingWebhook(ss, model.NewId(), channelId, model.NewId())
			dbmap.Delete(channel)
			result := checkChannelsOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &channelId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckChannelsPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkChannelsPostsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithChannelId(ss, model.NewId())
			result := checkChannelsPostsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &post.ChannelId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Delete(post)
		})
	})
}

func TestCheckCommandsCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkCommandsCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			commandId := model.NewId()
			cwh := createCommandWebhook(ss, commandId, model.NewId(), model.NewId())
			result := checkCommandsCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &commandId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Delete(cwh)
		})
	})
}

func TestCheckPostsFileInfoIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsFileInfoIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			postId := model.NewId()
			info := createFileInfo(ss, postId, model.NewId())
			result := checkPostsFileInfoIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &postId,
				ChildId:  &info.Id,
			}, data.Records[0])
			dbmap.Delete(info)
		})
	})
}

func TestCheckPostsPostsParentIdIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsPostsParentIdIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with no records", func(t *testing.T) {
			root := createPost(ss, model.NewId(), model.NewId(), "", "")
			parent := createPost(ss, model.NewId(), model.NewId(), root.Id, root.Id)
			post := createPost(ss, model.NewId(), model.NewId(), root.Id, parent.Id)
			result := checkPostsPostsParentIdIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
			dbmap.Delete(parent)
			dbmap.Delete(root)
			dbmap.Delete(post)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			root := createPost(ss, model.NewId(), model.NewId(), "", "")
			parent := createPost(ss, model.NewId(), model.NewId(), root.Id, root.Id)
			parentId := parent.Id
			post := createPost(ss, model.NewId(), model.NewId(), root.Id, parent.Id)
			dbmap.Delete(parent)
			result := checkPostsPostsParentIdIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &parentId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Delete(root)
			dbmap.Delete(post)
		})
	})
}

func TestCheckPostsPostsRootIdIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsPostsRootIdIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			root := createPost(ss, model.NewId(), model.NewId(), "", "")
			rootId := root.Id
			post := createPost(ss, model.NewId(), model.NewId(), root.Id, root.Id)
			dbmap.Delete(root)
			result := checkPostsPostsRootIdIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &rootId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Delete(post)
		})
	})
}

func TestCheckPostsReactionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkPostsReactionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			postId := model.NewId()
			reaction := createReaction(ss, model.NewId(), postId)
			result := checkPostsReactionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &postId,
			}, data.Records[0])
			dbmap.Delete(reaction)
		})
	})
}

func TestCheckSchemesChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSchemesChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			createDefaultRoles(ss)
			scheme := createScheme(ss)
			schemeId := scheme.Id
			channel := createChannelWithSchemeId(ss, &schemeId)
			dbmap.Delete(scheme)
			result := checkSchemesChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &schemeId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Delete(channel)
		})
	})
}

func TestCheckSchemesTeamsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSchemesTeamsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			createDefaultRoles(ss)
			scheme := createScheme(ss)
			schemeId := scheme.Id
			team := createTeamWithSchemeId(ss, &schemeId)
			dbmap.Delete(scheme)
			result := checkSchemesTeamsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &schemeId,
				ChildId:  &team.Id,
			}, data.Records[0])
			dbmap.Delete(team)
		})
	})
}

func TestCheckSessionsAuditsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkSessionsAuditsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			session := createSession(ss, model.NewId())
			sessionId := session.Id
			audit := createAudit(ss, userId, sessionId)
			dbmap.Delete(session)
			result := checkSessionsAuditsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &sessionId,
				ChildId:  &audit.Id,
			}, data.Records[0])
			ss.Audit().PermanentDeleteByUser(userId)
		})
	})
}

func TestCheckTeamsChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithTeamId(ss, model.NewId())
			result := checkTeamsChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &channel.TeamId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Delete(channel)
		})
	})
}

func TestCheckTeamsCommandsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsCommandsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			cmd := createCommand(ss, model.NewId(), teamId)
			result := checkTeamsCommandsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &cmd.Id,
			}, data.Records[0])
			dbmap.Delete(cmd)
		})
	})
}

func TestCheckTeamsIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			wh := createIncomingWebhook(ss, model.NewId(), model.NewId(), teamId)
			result := checkTeamsIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckTeamsOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			teamId := model.NewId()
			wh := createOutgoingWebhook(ss, model.NewId(), model.NewId(), teamId)
			result := checkTeamsOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &teamId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckTeamsTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkTeamsTeamMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			team := createTeam(ss, model.NewId())
			member := createTeamMember(ss, team.Id, model.NewId())
			dbmap.Delete(team)
			result := checkTeamsTeamMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &team.Id,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
		})
	})
}

func TestCheckUsersAuditsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersAuditsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			audit := createAudit(ss, userId, model.NewId())
			dbmap.Delete(user)
			result := checkUsersAuditsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &audit.Id,
			}, data.Records[0])
			ss.Audit().PermanentDeleteByUser(userId)
		})
	})
}

func TestCheckUsersCommandWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			cwh := createCommandWebhook(ss, model.NewId(), userId, model.NewId())
			result := checkUsersCommandWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &cwh.Id,
			}, data.Records[0])
			dbmap.Delete(cwh)
		})
	})
}

func TestCheckUsersChannelsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			channel := createChannelWithCreatorId(ss, model.NewId())
			result := checkUsersChannelsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &channel.CreatorId,
				ChildId:  &channel.Id,
			}, data.Records[0])
			dbmap.Delete(channel)
		})
	})
}

func TestCheckUsersChannelMemberHistoryIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelMemberHistoryIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			channel := createChannel(ss, model.NewId(), model.NewId())
			cmh := createChannelMemberHistory(ss, channel.Id, user.Id)
			dbmap.Delete(user)
			result := checkUsersChannelMemberHistoryIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &cmh.UserId,
			}, data.Records[0])
			dbmap.Delete(channel)
			dbmap.Exec(`DELETE FROM ChannelMemberHistory`)
		})
	})
}

func TestCheckUsersChannelMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersChannelMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			channel := createChannelWithCreatorId(ss, user.Id)
			member := createChannelMember(ss, channel.Id, user.Id)
			dbmap.Delete(user)
			result := checkUsersChannelMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &member.UserId,
			}, data.Records[0])
			dbmap.Delete(channel)
			ss.Channel().PermanentDeleteMembersByUser(member.UserId)
		})
	})
}

func TestCheckUsersCommandsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCommandsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			cmd := createCommand(ss, userId, model.NewId())
			result := checkUsersCommandsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &cmd.Id,
			}, data.Records[0])
			dbmap.Delete(cmd)
		})
	})
}

func TestCheckUsersCompliancesIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersCompliancesIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			compliance := createCompliance(ss, userId)
			dbmap.Delete(user)
			result := checkUsersCompliancesIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &compliance.Id,
			}, data.Records[0])
			dbmap.Delete(compliance)
		})
	})
}

func TestCheckUsersEmojiIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersEmojiIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			emoji := createEmoji(ss, userId)
			dbmap.Delete(user)
			result := checkUsersEmojiIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &emoji.Id,
			}, data.Records[0])
			dbmap.Delete(emoji)
		})
	})
}

func TestCheckUsersFileInfoIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersFileInfoIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			info := createFileInfo(ss, model.NewId(), userId)
			dbmap.Delete(user)
			result := checkUsersFileInfoIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &info.Id,
			}, data.Records[0])
			dbmap.Delete(info)
		})
	})
}

func TestCheckUsersIncomingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			wh := createIncomingWebhook(ss, userId, model.NewId(), model.NewId())
			result := checkUsersIncomingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckUsersOAuthAccessDataIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAccessDataIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			ad := createOAuthAccessData(ss, userId)
			dbmap.Delete(user)
			result := checkUsersOAuthAccessDataIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &ad.Token,
			}, data.Records[0])
			ss.OAuth().RemoveAccessData(ad.Token)
		})
	})
}

func TestCheckUsersOAuthAppsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAppsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			app := createOAuthApp(ss, userId)
			dbmap.Delete(user)
			result := checkUsersOAuthAppsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &app.Id,
			}, data.Records[0])
			ss.OAuth().DeleteApp(app.Id)
		})
	})
}

func TestCheckUsersOAuthAuthDataIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOAuthAuthDataIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			ad := createOAuthAuthData(ss, userId)
			dbmap.Delete(user)
			result := checkUsersOAuthAuthDataIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &ad.Code,
			}, data.Records[0])
			ss.OAuth().RemoveAuthData(ad.Code)
		})
	})
}

func TestCheckUsersOutgoingWebhooksIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			wh := createOutgoingWebhook(ss, userId, model.NewId(), model.NewId())
			result := checkUsersOutgoingWebhooksIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &wh.Id,
			}, data.Records[0])
			dbmap.Delete(wh)
		})
	})
}

func TestCheckUsersPostsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersPostsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			post := createPostWithUserId(ss, model.NewId())
			result := checkUsersPostsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &post.UserId,
				ChildId:  &post.Id,
			}, data.Records[0])
			dbmap.Delete(post)
		})
	})
}

func TestCheckUsersPreferencesIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersPreferencesIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with no records", func(t *testing.T) {
			user := createUser(ss)
			require.NotNil(t, user)
			userId := user.Id
			preferences := createPreferences(ss, userId)
			require.NotNil(t, preferences)
			result := checkUsersPreferencesIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
			dbmap.Exec(`DELETE FROM Preferences`)
			dbmap.Delete(user)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			require.NotNil(t, user)
			userId := user.Id
			preferences := createPreferences(ss, userId)
			require.NotNil(t, preferences)
			dbmap.Delete(user)
			result := checkUsersPreferencesIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Exec(`DELETE FROM Preferences`)
			dbmap.Delete(user)
		})
	})
}

func TestCheckUsersReactionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersReactionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			reaction := createReaction(ss, user.Id, model.NewId())
			dbmap.Delete(user)
			result := checkUsersReactionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Delete(reaction)
		})
	})
}

func TestCheckUsersSessionsIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersSessionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			userId := model.NewId()
			session := createSession(ss, userId)
			result := checkUsersSessionsIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &session.Id,
			}, data.Records[0])
			dbmap.Delete(session)
		})
	})
}

func TestCheckUsersStatusIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersStatusIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			status := createStatus(ss, user.Id)
			dbmap.Delete(user)
			result := checkUsersStatusIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
			}, data.Records[0])
			dbmap.Delete(status)
		})
	})
}

func TestCheckUsersTeamMembersIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersTeamMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			team := createTeam(ss, user.Id)
			member := createTeamMember(ss, team.Id, user.Id)
			dbmap.Delete(user)
			result := checkUsersTeamMembersIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &member.UserId,
			}, data.Records[0])
			ss.Team().RemoveAllMembersByTeam(member.TeamId)
			dbmap.Delete(team)
		})
	})
}

func TestCheckUsersUserAccessTokensIntegrity(t *testing.T) {
	StoreTest(t, func(t *testing.T, ss store.Store) {
		supplier := ss.(*SqlSupplier)
		dbmap := supplier.GetMaster()

		t.Run("should generate a report with no records", func(t *testing.T) {
			result := checkUsersUserAccessTokensIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Empty(t, data.Records)
		})

		t.Run("should generate a report with one record", func(t *testing.T) {
			user := createUser(ss)
			userId := user.Id
			uat := createUserAccessToken(ss, user.Id)
			dbmap.Delete(user)
			result := checkUsersUserAccessTokensIntegrity(supplier)
			require.Nil(t, result.Err)
			data := result.Data.(store.RelationalIntegrityCheckData)
			require.Len(t, data.Records, 1)
			require.Equal(t, store.OrphanedRecord{
				ParentId: &userId,
				ChildId:  &uat.Id,
			}, data.Records[0])
			ss.UserAccessToken().Delete(uat.Id)
		})
	})
}
