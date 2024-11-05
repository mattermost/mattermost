// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//nolint:gosec
package commands

import (
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"

	"github.com/icrowley/fake"
)

func randomPastTime(seconds int) int64 {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.FixedZone("UTC", 0))
	return (today.Unix() * 1000) - int64(rand.Intn(seconds*1000))
}

func sortedRandomDates(size int) []int64 {
	dates := make([]int64, size)
	for i := 0; i < size; i++ {
		dates[i] = randomPastTime(50000)
	}
	sort.Slice(dates, func(a, b int) bool { return dates[a] < dates[b] })
	return dates
}

func randomEmoji() string {
	emojis := []string{"+1", "-1", "heart", "blush"}
	return emojis[rand.Intn(len(emojis))]
}

func randomReaction(users []string, parentCreateAt int64) app.ReactionImportData {
	user := users[rand.Intn(len(users))]
	emoji := randomEmoji()
	date := parentCreateAt + int64(rand.Intn(100000))
	return app.ReactionImportData{
		User:      &user,
		EmojiName: &emoji,
		CreateAt:  &date,
	}
}

func randomReply(users []string, parentCreateAt int64) imports.ReplyImportData {
	user := users[rand.Intn(len(users))]
	message := randomMessage(users)
	date := parentCreateAt + int64(rand.Intn(100000))
	return imports.ReplyImportData{
		User:     &user,
		Message:  &message,
		CreateAt: &date,
	}
}

func randomMessage(users []string) string {
	var message string
	switch rand.Intn(30) {
	case 0:
		mention := users[rand.Intn(len(users))]
		message = "@" + mention + " " + fake.Sentence()
	case 1:
		switch rand.Intn(2) {
		case 0:
			mattermostVideos := []string{"Q4MgnxbpZas", "BFo7E9-Kc_E", "LsMLR-BHsKg", "MRmGDhlMhNA", "mUOPxT7VgWc"}
			message = "https://www.youtube.com/watch?v=" + mattermostVideos[rand.Intn(len(mattermostVideos))]
		case 1:
			mattermostTweets := []string{"943119062334353408", "949370809528832005", "948539688171819009", "939122439115681792", "938061722027425797"}
			message = "https://twitter.com/mattermosthq/status/" + mattermostTweets[rand.Intn(len(mattermostTweets))]
		}
	case 2:
		message = ""
		if rand.Intn(2) == 0 {
			message += fake.Sentence()
		}
		for i := 0; i < rand.Intn(4)+1; i++ {
			message += "\n  * " + fake.Word()
		}
	default:
		if rand.Intn(2) == 0 {
			message = fake.Sentence()
		} else {
			message = fake.Paragraph()
		}
		if rand.Intn(3) == 0 {
			message += "\n" + fake.Sentence()
		}
		if rand.Intn(3) == 0 {
			message += "\n" + fake.Sentence()
		}
		if rand.Intn(3) == 0 {
			message += "\n" + fake.Sentence()
		}
	}
	return message
}

func createUser(idx int, teamMemberships int, channelMemberships int, teamsAndChannels map[string][]string, profileImages []string, userType string) imports.LineImportData {
	firstName := fake.FirstName()
	lastName := fake.LastName()
	position := fake.JobTitle()

	username := fmt.Sprintf("%s.%s", strings.ToLower(firstName), strings.ToLower(lastName))
	roles := "system_user"

	var password string
	var email string

	switch userType {
	case guestUser:
		password = fmt.Sprintf("SampleGu@st-%d", idx)
		email = fmt.Sprintf("guest-%d@sample.mattermost.com", idx)
		roles = "system_guest"
		if idx == 0 {
			username = "guest"
			password = "SampleGu@st1"
			email = "guest@sample.mattermost.com"
		}
	case deactivatedUser:
		password = fmt.Sprintf("SampleDe@ctivated-%d", idx)
		email = fmt.Sprintf("deactivated-%d@sample.mattermost.com", idx)
	default:
		password = fmt.Sprintf("SampleUs@r-%d", idx)
		email = fmt.Sprintf("user-%d@sample.mattermost.com", idx)
		if idx == 0 {
			username = "sysadmin"
			password = "Sys@dmin-sample1"
			email = "sysadmin@sample.mattermost.com"
		} else if idx == 1 {
			username = "user-1"
		}

		if idx%5 == 0 {
			roles = "system_admin system_user"
		}
	}

	// The 75% of the users have custom profile image
	var profileImage *string
	if rand.Intn(4) != 0 {
		profileImageSelector := rand.Int()
		if len(profileImages) > 0 {
			profileImage = &profileImages[profileImageSelector%len(profileImages)]
		}
	}

	useMilitaryTime := "false"
	if idx != 0 && rand.Intn(2) == 0 {
		useMilitaryTime = "true"
	}

	collapsePreviews := "false"
	if idx != 0 && rand.Intn(2) == 0 {
		collapsePreviews = "true"
	}

	messageDisplay := "clean"
	if idx != 0 && rand.Intn(2) == 0 {
		messageDisplay = "compact"
	}

	channelDisplayMode := "full"
	if idx != 0 && rand.Intn(2) == 0 {
		channelDisplayMode = "centered"
	}

	// Some users has nickname
	nickname := ""
	if rand.Intn(5) == 0 {
		nickname = fake.Company()
	}

	// sysadmin, user-1 and user-2 users skip tutorial steps
	// Other half of users also skip tutorial steps
	tutorialStep := "999"
	if idx > 2 {
		switch rand.Intn(6) {
		case 1:
			tutorialStep = "1"
		case 2:
			tutorialStep = "2"
		case 3:
			tutorialStep = "3"
		}
	}

	teams := []imports.UserTeamImportData{}
	possibleTeams := []string{}
	for teamName := range teamsAndChannels {
		possibleTeams = append(possibleTeams, teamName)
	}
	sort.Strings(possibleTeams)
	for x := 0; x < teamMemberships; x++ {
		if len(possibleTeams) == 0 {
			break
		}
		position := rand.Intn(len(possibleTeams))
		team := possibleTeams[position]
		possibleTeams = append(possibleTeams[:position], possibleTeams[position+1:]...)
		if teamChannels, err := teamsAndChannels[team]; err {
			teams = append(teams, createTeamMembership(channelMemberships, teamChannels, &team, userType == guestUser))
		}
	}

	var deleteAt int64
	if userType == deactivatedUser {
		deleteAt = model.GetMillis()
	}

	user := imports.UserImportData{
		Avatar: imports.Avatar{
			ProfileImage: profileImage,
		},
		Username:           &username,
		Email:              &email,
		Password:           &password,
		Nickname:           &nickname,
		FirstName:          &firstName,
		LastName:           &lastName,
		Position:           &position,
		Roles:              &roles,
		Teams:              &teams,
		UseMilitaryTime:    &useMilitaryTime,
		CollapsePreviews:   &collapsePreviews,
		MessageDisplay:     &messageDisplay,
		ChannelDisplayMode: &channelDisplayMode,
		TutorialStep:       &tutorialStep,
		DeleteAt:           &deleteAt,
	}
	return imports.LineImportData{
		Type: "user",
		User: &user,
	}
}

func createTeamMembership(numOfchannels int, teamChannels []string, teamName *string, guest bool) imports.UserTeamImportData {
	roles := "team_user"
	if guest {
		roles = "team_guest"
	} else if rand.Intn(5) == 0 {
		roles = "team_user team_admin"
	}
	channels := []imports.UserChannelImportData{}
	teamChannelsCopy := append([]string(nil), teamChannels...)
	for x := 0; x < numOfchannels; x++ {
		if len(teamChannelsCopy) == 0 {
			break
		}
		position := rand.Intn(len(teamChannelsCopy))
		channelName := teamChannelsCopy[position]
		teamChannelsCopy = append(teamChannelsCopy[:position], teamChannelsCopy[position+1:]...)
		channels = append(channels, createChannelMembership(channelName, guest))
	}

	return imports.UserTeamImportData{
		Name:     teamName,
		Roles:    &roles,
		Channels: &channels,
	}
}

func createChannelMembership(channelName string, guest bool) imports.UserChannelImportData {
	roles := "channel_user"
	if guest {
		roles = "channel_guest"
	} else if rand.Intn(5) == 0 {
		roles = "channel_user channel_admin"
	}
	favorite := rand.Intn(5) == 0

	return imports.UserChannelImportData{
		Name:     &channelName,
		Roles:    &roles,
		Favorite: &favorite,
	}
}

func getSampleTeamName(idx int) string {
	for {
		name := fmt.Sprintf("%s-%d", fake.Word(), idx)
		if !model.IsReservedTeamName(name) {
			return name
		}
	}
}

func createTeam(idx int) imports.LineImportData {
	displayName := fake.Word()
	name := getSampleTeamName(idx)
	allowOpenInvite := rand.Intn(2) == 0

	description := fake.Paragraph()
	if len(description) > 255 {
		description = description[0:255]
	}

	teamType := "O"
	if rand.Intn(2) == 0 {
		teamType = "I"
	}

	team := imports.TeamImportData{
		DisplayName:     &displayName,
		Name:            &name,
		AllowOpenInvite: &allowOpenInvite,
		Description:     &description,
		Type:            &teamType,
	}
	return imports.LineImportData{
		Type: "team",
		Team: &team,
	}
}

func createChannel(idx int, teamName string) imports.LineImportData {
	displayName := fake.Word()
	name := fmt.Sprintf("%s-%d", fake.Word(), idx)
	header := fake.Paragraph()
	purpose := fake.Paragraph()

	if len(purpose) > 250 {
		purpose = purpose[0:250]
	}

	channelType := model.ChannelTypePrivate
	if rand.Intn(2) == 0 {
		channelType = model.ChannelTypeOpen
	}

	channel := imports.ChannelImportData{
		Team:        &teamName,
		Name:        &name,
		DisplayName: &displayName,
		Type:        &channelType,
		Header:      &header,
		Purpose:     &purpose,
	}
	return imports.LineImportData{
		Type:    "channel",
		Channel: &channel,
	}
}

func createPost(team string, channel string, allUsers []string, createAt int64) imports.LineImportData {
	message := randomMessage(allUsers)
	user := allUsers[rand.Intn(len(allUsers))]

	// Some messages are flagged by a user
	flaggedBy := []string{}
	if rand.Intn(10) == 0 {
		flaggedBy = append(flaggedBy, allUsers[rand.Intn(len(allUsers))])
	}

	reactions := []app.ReactionImportData{}
	if rand.Intn(10) == 0 {
		for {
			reactions = append(reactions, randomReaction(allUsers, createAt))
			if rand.Intn(3) == 0 {
				break
			}
		}
	}

	replies := []imports.ReplyImportData{}
	if rand.Intn(10) == 0 {
		for {
			replies = append(replies, randomReply(allUsers, createAt))
			if rand.Intn(4) == 0 {
				break
			}
		}
	}

	post := imports.PostImportData{
		Team:      &team,
		Channel:   &channel,
		User:      &user,
		Message:   &message,
		CreateAt:  &createAt,
		FlaggedBy: &flaggedBy,
		Reactions: &reactions,
		Replies:   &replies,
	}
	return imports.LineImportData{
		Type: "post",
		Post: &post,
	}
}

func createDirectChannel(members []string) imports.LineImportData {
	header := fake.Sentence()
	var p []*imports.DirectChannelMemberImportData

	for _, m := range members {
		p = append(p, &imports.DirectChannelMemberImportData{
			Username: model.NewPointer(m),
		})
	}

	channel := imports.DirectChannelImportData{
		Participants: p,
		Header:       &header,
	}
	return imports.LineImportData{
		Type:          "direct_channel",
		DirectChannel: &channel,
	}
}

func createDirectPost(members []string, createAt int64) imports.LineImportData {
	message := randomMessage(members)
	user := members[rand.Intn(len(members))]

	// Some messages are flagged by an user
	flaggedBy := []string{}
	if rand.Intn(10) == 0 {
		flaggedBy = append(flaggedBy, members[rand.Intn(len(members))])
	}

	reactions := []app.ReactionImportData{}
	if rand.Intn(10) == 0 {
		for {
			reactions = append(reactions, randomReaction(members, createAt))
			if rand.Intn(3) == 0 {
				break
			}
		}
	}

	replies := []imports.ReplyImportData{}
	if rand.Intn(10) == 0 {
		for {
			replies = append(replies, randomReply(members, createAt))
			if rand.Intn(4) == 0 {
				break
			}
		}
	}

	post := imports.DirectPostImportData{
		ChannelMembers: &members,
		User:           &user,
		Message:        &message,
		CreateAt:       &createAt,
		FlaggedBy:      &flaggedBy,
		Reactions:      &reactions,
		Replies:        &replies,
	}
	return imports.LineImportData{
		Type:       "direct_post",
		DirectPost: &post,
	}
}
