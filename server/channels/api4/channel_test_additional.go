// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestCreateChannelErrorPaths tests various error conditions in createChannel
func TestCreateChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create channel with invalid name", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "invalid name with spaces",
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create channel with empty display name", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "",
			Name:        "testchannel",
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create channel with empty name", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "",
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create channel with invalid type", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "testchannel",
			Type:        "invalid",
			TeamId:      th.BasicTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create channel without team id", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "testchannel",
			Type:        model.ChannelTypeOpen,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create channel in team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "testchannel",
			Type:        model.ChannelTypeOpen,
			TeamId:      otherTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("create DM channel should use createDirectChannel endpoint", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "DM Channel",
			Name:        "dmchannel",
			Type:        model.ChannelTypeDirect,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create GM channel should use createGroupChannel endpoint", func(t *testing.T) {
		channel := &model.Channel{
			DisplayName: "GM Channel",
			Name:        "gmchannel",
			Type:        model.ChannelTypeGroup,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		channel := &model.Channel{
			DisplayName: "Test Channel",
			Name:        "testchannel",
			Type:        model.ChannelTypeOpen,
			TeamId:      th.BasicTeam.Id,
		}
		_, resp, err := th.Client.CreateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateChannelErrorPaths tests error conditions in updateChannel
func TestUpdateChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("update channel with invalid name", func(t *testing.T) {
		channel := th.BasicChannel.DeepCopy()
		channel.Name = "invalid name"
		_, resp, err := th.Client.UpdateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update channel without permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		privateChannel.DisplayName = "Updated Name"
		_, resp, err := th.Client.UpdateChannel(context.Background(), privateChannel)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("update with invalid channel id", func(t *testing.T) {
		channel := th.BasicChannel.DeepCopy()
		channel.Id = "invalid"
		_, resp, err := th.Client.UpdateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("update non-existent channel", func(t *testing.T) {
		channel := th.BasicChannel.DeepCopy()
		channel.Id = model.NewId()
		_, resp, err := th.SystemAdminClient.UpdateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("update DM channel not allowed", func(t *testing.T) {
		dmChannel, _, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.NoError(t, err)
		
		dmChannel.DisplayName = "New Name"
		_, resp, err := th.Client.UpdateChannel(context.Background(), dmChannel)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		channel := th.BasicChannel.DeepCopy()
		channel.DisplayName = "New Name"
		_, resp, err := th.Client.UpdateChannel(context.Background(), channel)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestPatchChannelErrorPaths tests error conditions in patchChannel
func TestPatchChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("patch with invalid name", func(t *testing.T) {
		patch := &model.ChannelPatch{
			Name: model.NewPointer("invalid name"),
		}
		_, resp, err := th.Client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch channel without permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		patch := &model.ChannelPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.Client.PatchChannel(context.Background(), privateChannel.Id, patch)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("patch with invalid channel id", func(t *testing.T) {
		patch := &model.ChannelPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.Client.PatchChannel(context.Background(), "invalid", patch)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("patch non-existent channel", func(t *testing.T) {
		patch := &model.ChannelPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.SystemAdminClient.PatchChannel(context.Background(), model.NewId(), patch)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		patch := &model.ChannelPatch{
			DisplayName: model.NewPointer("New Name"),
		}
		_, resp, err := th.Client.PatchChannel(context.Background(), th.BasicChannel.Id, patch)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestDeleteChannelErrorPaths tests error conditions in deleteChannel
func TestDeleteChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("delete channel without permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		resp, err := th.Client.DeleteChannel(context.Background(), privateChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("delete with invalid channel id", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeleteChannel(context.Background(), "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("delete non-existent channel", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DeleteChannel(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		channel := th.CreateChannel(t, th.BasicTeam)
		resp, err := th.Client.DeleteChannel(context.Background(), channel.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelErrorPaths tests error handling in getChannel
func TestGetChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannel(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetChannel(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get channel without membership", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetChannel(context.Background(), privateChannel.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannel(context.Background(), th.BasicChannel.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelByNameErrorPaths tests error handling in getChannelByName
func TestGetChannelByNameErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty channel name", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByName(context.Background(), "", th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("non-existent channel name", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByName(context.Background(), "nonexistentchannel", th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByName(context.Background(), th.BasicChannel.Name, "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get channel from team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypeOpen, otherTeam.Id)
		
		_, resp, err := th.Client.GetChannelByName(context.Background(), otherChannel.Name, otherTeam.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelByName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelByNameForTeamNameErrorPaths tests error handling in getChannelByNameForTeamName
func TestGetChannelByNameForTeamNameErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty channel name", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByNameForTeamName(context.Background(), "", th.BasicTeam.Name, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("empty team name", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, "", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("non-existent team name", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, "nonexistentteam", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("get channel from team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreateChannelWithClient(t, th.SystemAdminClient, model.ChannelTypeOpen, otherTeam.Id)
		
		_, resp, err := th.Client.GetChannelByNameForTeamName(context.Background(), otherChannel.Name, otherTeam.Name, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelByNameForTeamName(context.Background(), th.BasicChannel.Name, th.BasicTeam.Name, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelMembersErrorPaths tests error handling in getChannelMembers
func TestGetChannelMembersErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelMembers(context.Background(), "invalid", 0, 10, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get members from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetChannelMembers(context.Background(), privateChannel.Id, 0, 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelMembers(context.Background(), model.NewId(), 0, 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelMembers(context.Background(), th.BasicChannel.Id, 0, 10, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelMembersByIdsErrorPaths tests error handling in getChannelMembersByIds
func TestGetChannelMembersByIdsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("empty user ids", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelMembersByIds(context.Background(), "invalid", []string{th.BasicUser.Id})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id in list", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{"invalid"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get members from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetChannelMembersByIds(context.Background(), privateChannel.Id, []string{th.SystemAdminUser.Id})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelMembersByIds(context.Background(), th.BasicChannel.Id, []string{th.BasicUser.Id})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelStatsErrorPaths tests error handling in getChannelStats
func TestGetChannelStatsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelStats(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get stats from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetChannelStats(context.Background(), privateChannel.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelStats(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelStats(context.Background(), th.BasicChannel.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestCreateDirectChannelErrorPaths tests error conditions in createDirectChannel
func TestCreateDirectChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create DM with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create DM with non-existent user", func(t *testing.T) {
		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("create DM with same user (self)", func(t *testing.T) {
		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestCreateGroupChannelErrorPaths tests error conditions in createGroupChannel
func TestCreateGroupChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	user3 := th.CreateUser(t)

	t.Run("create GM with less than 3 users", func(t *testing.T) {
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create GM with invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, "invalid"})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("create GM with non-existent user", func(t *testing.T) {
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, model.NewId()})
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("create GM with more than max users", func(t *testing.T) {
		// Create a list that exceeds the max GM users limit
		userIds := []string{th.BasicUser.Id}
		for i := 0; i < model.ChannelGroupMaxUsers; i++ {
			user := th.CreateUser(t)
			userIds = append(userIds, user.Id)
		}
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), userIds)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.CreateGroupChannel(context.Background(), []string{th.BasicUser.Id, th.BasicUser2.Id, user3.Id})
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPublicChannelsForTeamErrorPaths tests error handling in getPublicChannelsForTeam
func TestGetPublicChannelsForTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetPublicChannelsForTeam(context.Background(), "invalid", 0, 10, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get channels from team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.GetPublicChannelsForTeam(context.Background(), otherTeam.Id, 0, 10, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPublicChannelsForTeam(context.Background(), th.BasicTeam.Id, 0, 10, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelsForUserErrorPaths tests error handling in getChannelsForUser
func TestGetChannelsForUserErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelsForUserWithLastDeleteAt(context.Background(), "invalid", th.BasicTeam.Id, 0)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelsForUserWithLastDeleteAt(context.Background(), th.BasicUser.Id, "invalid", 0)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get channels for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetChannelsForUserWithLastDeleteAt(context.Background(), otherUser.Id, th.BasicTeam.Id, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelsForUserWithLastDeleteAt(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, 0)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestSearchChannelsForTeamErrorPaths tests error handling in searchChannelsForTeam
func TestSearchChannelsForTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		search := &model.ChannelSearch{
			Term: "test",
		}
		_, resp, err := th.Client.SearchChannels(context.Background(), "invalid", search)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("search in team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		search := &model.ChannelSearch{
			Term: "test",
		}
		_, resp, err := th.Client.SearchChannels(context.Background(), otherTeam.Id, search)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		search := &model.ChannelSearch{
			Term: "test",
		}
		_, resp, err := th.Client.SearchChannels(context.Background(), th.BasicTeam.Id, search)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestAutocompleteChannelsForTeamErrorPaths tests error handling in autocompleteChannelsForTeam
func TestAutocompleteChannelsForTeamErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid team id", func(t *testing.T) {
		_, resp, err := th.Client.AutocompleteChannelsForTeam(context.Background(), "invalid", "test")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("autocomplete in team user is not member of", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		_, resp, err := th.Client.AutocompleteChannelsForTeam(context.Background(), otherTeam.Id, "test")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.AutocompleteChannelsForTeam(context.Background(), th.BasicTeam.Id, "test")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetChannelUnreadErrorPaths tests error handling in getChannelUnread
func TestGetChannelUnreadErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelUnread(context.Background(), "invalid", th.BasicUser.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid user id", func(t *testing.T) {
		_, resp, err := th.Client.GetChannelUnread(context.Background(), th.BasicChannel.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get unread for other user without permission", func(t *testing.T) {
		otherUser := th.CreateUser(t)
		_, resp, err := th.Client.GetChannelUnread(context.Background(), th.BasicChannel.Id, otherUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("get unread from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetChannelUnread(context.Background(), privateChannel.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetChannelUnread(context.Background(), th.BasicChannel.Id, th.BasicUser.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestUpdateChannelPrivacyErrorPaths tests error conditions in updateChannelPrivacy
func TestUpdateChannelPrivacyErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("regular user cannot update channel privacy", func(t *testing.T) {
		_, resp, err := th.Client.UpdateChannelPrivacy(context.Background(), th.BasicChannel.Id, model.ChannelTypePrivate)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid channel id", func(t *testing.T) {
			_, resp, err := client.UpdateChannelPrivacy(context.Background(), "invalid", model.ChannelTypePrivate)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent channel", func(t *testing.T) {
			_, resp, err := client.UpdateChannelPrivacy(context.Background(), model.NewId(), model.ChannelTypePrivate)
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("invalid privacy type", func(t *testing.T) {
			_, resp, err := client.UpdateChannelPrivacy(context.Background(), th.BasicChannel.Id, "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("cannot convert DM channel", func(t *testing.T) {
			dmChannel, _, err := th.Client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
			require.NoError(t, err)
			
			_, resp, err := client.UpdateChannelPrivacy(context.Background(), dmChannel.Id, model.ChannelTypePrivate)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.UpdateChannelPrivacy(context.Background(), th.BasicChannel.Id, model.ChannelTypePrivate)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestRestoreChannelErrorPaths tests error conditions in restoreChannel
func TestRestoreChannelErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("restore channel without permission", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		th.SystemAdminClient.DeleteChannel(context.Background(), channel.Id)
		
		_, resp, err := th.Client.RestoreChannel(context.Background(), channel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	th.TestForSystemAdminAndLocal(t, func(t *testing.T, client *model.Client4) {
		t.Run("invalid channel id", func(t *testing.T) {
			_, resp, err := client.RestoreChannel(context.Background(), "invalid")
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})

		t.Run("non-existent channel", func(t *testing.T) {
			_, resp, err := client.RestoreChannel(context.Background(), model.NewId())
			require.Error(t, err)
			CheckNotFoundStatus(t, resp)
		})

		t.Run("restore active channel returns error", func(t *testing.T) {
			_, resp, err := client.RestoreChannel(context.Background(), th.BasicChannel.Id)
			require.Error(t, err)
			CheckBadRequestStatus(t, resp)
		})
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		channel := th.CreateChannel(t, th.BasicTeam)
		_, resp, err := th.Client.RestoreChannel(context.Background(), channel.Id)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}

// TestGetPinnedPostsErrorPaths tests error handling in getPinnedPosts
func TestGetPinnedPostsErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("invalid channel id", func(t *testing.T) {
		_, resp, err := th.Client.GetPinnedPosts(context.Background(), "invalid", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("get pinned posts from channel user is not member of", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
		th.App.RemoveUserFromChannel(th.Context, th.BasicUser.Id, "", privateChannel)
		
		_, resp, err := th.Client.GetPinnedPosts(context.Background(), privateChannel.Id, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("non-existent channel", func(t *testing.T) {
		_, resp, err := th.Client.GetPinnedPosts(context.Background(), model.NewId(), "")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("unauthorized - not logged in", func(t *testing.T) {
		th.Client.Logout(context.Background())
		_, resp, err := th.Client.GetPinnedPosts(context.Background(), th.BasicChannel.Id, "")
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})
}
