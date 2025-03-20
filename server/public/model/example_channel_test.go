// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model_test

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
)

func ExampleClient4_CreateChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channel, _, err := client.CreateChannel(context.Background(), &model.Channel{
		Name:        "channel_name",
		DisplayName: "Channel Name",
		Type:        model.ChannelTypeOpen,
		TeamId:      "team_id",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Created channel with id %s\n", channel.Id)
}

func ExampleClient4_CreateDirectChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	userID1 := "user_id_1"
	userID2 := "user_id_2"
	channel, _, err := client.CreateDirectChannel(context.Background(), userID1, userID2)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Created direct message channel with id %s for users %s and %s\n", channel.Id, userID1, userID2)
}

func ExampleClient4_CreateGroupChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	userIDs := []string{"user_id_1", "user_id_2", "user_id_3"}
	channel, _, err := client.CreateGroupChannel(context.Background(), userIDs)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Created group message channel with id %s for users %s, %s and %s\n", channel.Id, userIDs[0], userIDs[1], userIDs[2])
}

func ExampleClient4_SearchGroupChannels() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channels, _, err := client.SearchGroupChannels(context.Background(), &model.ChannelSearch{
		Term: "member username",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Found %d channels\n", len(channels))
}

func ExampleClient4_GetPublicChannelsByIdsForTeam() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	teamId := "team_id"
	channelIds := []string{"channel_id_1", "channel_id_2"}

	channels, _, err := client.GetPublicChannelsByIdsForTeam(context.Background(), teamId, channelIds)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Found %d channels\n", len(channels))
}

func ExampleClient4_GetChannelMembersTimezones() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	memberTimezones, _, err := client.GetChannelMembersTimezones(context.Background(), channelId)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d timezones used by members of the channel %s\n", len(memberTimezones), channelId)
}

func ExampleClient4_GetChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	etag := ""
	channel, _, err := client.GetChannel(context.Background(), channelId, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found channel with name %s\n", channel.Name)
}

func ExampleClient4_UpdateChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channel, _, err := client.UpdateChannel(context.Background(), &model.Channel{
		Id:          "channel_id",
		TeamId:      "team_id",
		Name:        "name",
		DisplayName: "Display Name",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Channel %s updated at %d\n", channel.Id, channel.UpdateAt)
}

func ExampleClient4_DeleteChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	_, err := client.DeleteChannel(context.Background(), channelId)
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_PatchChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	patch := &model.ChannelPatch{
		Name:        model.NewPointer("new_name"),
		DisplayName: model.NewPointer("New Display Name"),
		Header:      model.NewPointer("New header"),
		Purpose:     model.NewPointer("New purpose"),
	}

	_, _, err := client.PatchChannel(context.Background(), channelId, patch)
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_UpdateChannelPrivacy() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"

	_, _, err := client.UpdateChannelPrivacy(context.Background(), channelId, model.ChannelTypeOpen)
	if err != nil {
		log.Fatal(err)
	}

	_, _, err = client.UpdateChannelPrivacy(context.Background(), channelId, model.ChannelTypePrivate)
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_GetChannelStats() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	etag := ""
	excludeFilesCount := true
	stats, _, err := client.GetChannelStats(context.Background(), channelId, etag, excludeFilesCount)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d members and %d guests in channel %s\n", stats.MemberCount, stats.GuestCount, channelId)
}

func ExampleClient4_GetPinnedPosts() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	etag := ""
	posts, _, err := client.GetPinnedPosts(context.Background(), channelId, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d pinned posts for channel %s\n", len(posts.Posts), channelId)
}

func ExampleClient4_GetPublicChannelsForTeam() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	teamId := "team_id"
	page := 0
	perPage := 100
	etag := ""
	channels, _, err := client.GetPublicChannelsForTeam(context.Background(), teamId, page, perPage, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d public channels for team %s\n", len(channels), teamId)
}

func ExampleClient4_GetPrivateChannelsForTeam() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	teamId := "team_id"
	page := 0
	perPage := 100
	etag := ""
	channels, _, err := client.GetPrivateChannelsForTeam(context.Background(), teamId, page, perPage, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d private channels for team %s\n", len(channels), teamId)
}

func ExampleClient4_SearchChannels() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	teamId := "team_id"
	searchTerm := "search"
	channels, _, err := client.SearchChannels(context.Background(), teamId, &model.ChannelSearch{
		Term: searchTerm,
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channels on team %s matching term '%s'\n", len(channels), teamId, searchTerm)
}

func ExampleClient4_SearchArchivedChannels() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	teamId := "team_id"
	searchTerm := "search"
	channels, _, err := client.SearchArchivedChannels(context.Background(), teamId, &model.ChannelSearch{
		Term: searchTerm,
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d archived channels on team %s matching term '%s'\n", len(channels), teamId, searchTerm)
}

func ExampleClient4_GetChannelByName() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelName := "channel_name"
	teamId := "team_id"
	etag := ""
	channel, _, err := client.GetChannelByName(context.Background(), channelName, teamId, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found channel %s with name %s\n", channel.Id, channel.Name)
}

func ExampleClient4_GetChannelByNameForTeamName() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelName := "channel_name"
	teamName := "team_name"
	etag := ""
	channel, _, err := client.GetChannelByNameForTeamName(context.Background(), channelName, teamName, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found channel %s with name %s\n", channel.Id, channel.Name)
}

func ExampleClient4_GetChannelMembers() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	page := 0
	perPage := 60
	etag := ""
	members, _, err := client.GetChannelMembers(context.Background(), channelId, page, perPage, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channel members for channel %s\n", len(members), channelId)
}

func ExampleClient4_AddChannelMember() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	cm, _, err := client.AddChannelMember(context.Background(), channelId, userId)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Added user %s to channel %s with roles %s\n", userId, channelId, cm.Roles)

	postRootId := "post_root_id"
	cm, _, err = client.AddChannelMemberWithRootId(context.Background(), channelId, userId, postRootId)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Added user %s to channel %s with roles %s using post %s\n", userId, channelId, cm.Roles, postRootId)
}

func ExampleClient4_GetChannelMembersByIds() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	usersIds := []string{"user_id_1", "user_id_2"}
	members, _, err := client.GetChannelMembersByIds(context.Background(), channelId, usersIds)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channel members for channel %s\n", len(members), channelId)
}

func ExampleClient4_GetChannelMember() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	etag := ""
	member, _, err := client.GetChannelMember(context.Background(), channelId, userId, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found channel member for user %s in channel %s having roles %s\n", userId, channelId, member.Roles)
}

func ExampleClient4_RemoveUserFromChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	_, err := client.RemoveUserFromChannel(context.Background(), channelId, userId)
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_UpdateChannelRoles() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	roles := []string{"channel_admin", "channel_user"}
	_, err := client.UpdateChannelRoles(context.Background(), channelId, userId, strings.Join(roles, " "))
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_UpdateChannelNotifyProps() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	props := map[string]string{
		model.DesktopNotifyProp:    model.ChannelNotifyMention,
		model.MarkUnreadNotifyProp: model.ChannelMarkUnreadMention,
	}

	_, err := client.UpdateChannelNotifyProps(context.Background(), channelId, userId, props)
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_ViewChannel() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	prevChannelId := "prev_channel_id"
	userId := "user_id"
	_, _, err := client.ViewChannel(context.Background(), userId, &model.ChannelView{
		ChannelId:                 channelId,
		PrevChannelId:             prevChannelId,
		CollapsedThreadsSupported: true,
	})
	if err != nil {
		log.Fatal(err)
	}
}

func ExampleClient4_GetChannelMembersForUser() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	userId := "user_id"
	teamId := "team_id"
	etag := ""
	members, _, err := client.GetChannelMembersForUser(context.Background(), userId, teamId, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channel members for user %s on team %s\n", len(members), userId, teamId)
}

func ExampleClient4_GetChannelsForTeamForUser() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	userId := "user_id"
	teamId := "team_id"
	includeDeleted := false
	etag := ""
	channels, _, err := client.GetChannelsForTeamForUser(context.Background(), teamId, userId, includeDeleted, etag)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channels for user %s on team %s\n", len(channels), userId, teamId)
}

func ExampleClient4_GetChannelsForUserWithLastDeleteAt() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	userId := "user_id"
	lastDeleteAt := 0
	channels, _, err := client.GetChannelsForUserWithLastDeleteAt(context.Background(), userId, lastDeleteAt)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d channels for user %s, with last delete at %d\n", len(channels), userId, lastDeleteAt)
}

func ExampleClient4_GetChannelUnread() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelId := "channel_id"
	userId := "user_id"
	channelUnread, _, err := client.GetChannelUnread(context.Background(), channelId, userId)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d unread messages with %d mentions for user %s in channel %s\n", channelUnread.MentionCount, channelUnread.MentionCount, userId, channelId)
}

func ExampleClient4_UpdateChannelScheme() {
	client := model.NewAPIv4Client(os.Getenv("MM_SERVICESETTINGS_SITEURL"))
	client.SetToken(os.Getenv("MM_AUTHTOKEN"))

	channelID := "channel_id"
	schemeID := "scheme_id"
	_, err := client.UpdateChannelScheme(context.Background(), channelID, schemeID)
	if err != nil {
		log.Fatal(err)
	}
}
