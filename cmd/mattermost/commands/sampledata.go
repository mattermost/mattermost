// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math/rand"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/icrowley/fake"
	"github.com/mattermost/mattermost-server/app"
	"github.com/spf13/cobra"
)

var SampleDataCmd = &cobra.Command{
	Use:   "sampledata",
	Short: "Generate sample data",
	RunE:  sampleDataCmdF,
}

func init() {
	SampleDataCmd.Flags().Int64P("seed", "s", 1, "Seed used for generating the random data (Different seeds generate different data).")
	SampleDataCmd.Flags().IntP("teams", "t", 2, "The number of sample teams.")
	SampleDataCmd.Flags().Int("channels-per-team", 10, "The number of sample channels per team.")
	SampleDataCmd.Flags().IntP("users", "u", 15, "The number of sample users.")
	SampleDataCmd.Flags().Int("team-memberships", 2, "The number of sample team memberships per user.")
	SampleDataCmd.Flags().Int("channel-memberships", 5, "The number of sample channel memberships per user in a team.")
	SampleDataCmd.Flags().Int("posts-per-channel", 100, "The number of sample post per channel.")
	SampleDataCmd.Flags().Int("direct-channels", 30, "The number of sample direct message channels.")
	SampleDataCmd.Flags().Int("posts-per-direct-channel", 15, "The number of sample posts per direct message channel.")
	SampleDataCmd.Flags().Int("group-channels", 15, "The number of sample group message channels.")
	SampleDataCmd.Flags().Int("posts-per-group-channel", 30, "The number of sample posts per group message channel.")
	SampleDataCmd.Flags().IntP("workers", "w", 2, "How many workers to run during the import.")
	SampleDataCmd.Flags().String("profile-images", "", "Optional. Path to folder with images to randomly pick as user profile image.")
	SampleDataCmd.Flags().StringP("bulk", "b", "", "Optional. Path to write a JSONL bulk file instead of loading into the database.")
	RootCmd.AddCommand(SampleDataCmd)
}

func sliceIncludes(vs []string, t string) bool {
	for _, v := range vs {
		if v == t {
			return true
		}
	}
	return false
}

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

func randomReply(users []string, parentCreateAt int64) app.ReplyImportData {
	user := users[rand.Intn(len(users))]
	message := randomMessage(users)
	date := parentCreateAt + int64(rand.Intn(100000))
	return app.ReplyImportData{
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

func sampleDataCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Shutdown()

	seed, err := command.Flags().GetInt64("seed")
	if err != nil {
		return errors.New("Invalid seed parameter")
	}
	bulk, err := command.Flags().GetString("bulk")
	if err != nil {
		return errors.New("Invalid bulk parameter")
	}
	teams, err := command.Flags().GetInt("teams")
	if err != nil || teams < 0 {
		return errors.New("Invalid teams parameter")
	}
	channelsPerTeam, err := command.Flags().GetInt("channels-per-team")
	if err != nil || channelsPerTeam < 0 {
		return errors.New("Invalid channels-per-team parameter")
	}
	users, err := command.Flags().GetInt("users")
	if err != nil || users < 0 {
		return errors.New("Invalid users parameter")
	}
	teamMemberships, err := command.Flags().GetInt("team-memberships")
	if err != nil || teamMemberships < 0 {
		return errors.New("Invalid team-memberships parameter")
	}
	channelMemberships, err := command.Flags().GetInt("channel-memberships")
	if err != nil || channelMemberships < 0 {
		return errors.New("Invalid channel-memberships parameter")
	}
	postsPerChannel, err := command.Flags().GetInt("posts-per-channel")
	if err != nil || postsPerChannel < 0 {
		return errors.New("Invalid posts-per-channel parameter")
	}
	directChannels, err := command.Flags().GetInt("direct-channels")
	if err != nil || directChannels < 0 {
		return errors.New("Invalid direct-channels parameter")
	}
	postsPerDirectChannel, err := command.Flags().GetInt("posts-per-direct-channel")
	if err != nil || postsPerDirectChannel < 0 {
		return errors.New("Invalid posts-per-direct-channel parameter")
	}
	groupChannels, err := command.Flags().GetInt("group-channels")
	if err != nil || groupChannels < 0 {
		return errors.New("Invalid group-channels parameter")
	}
	postsPerGroupChannel, err := command.Flags().GetInt("posts-per-group-channel")
	if err != nil || postsPerGroupChannel < 0 {
		return errors.New("Invalid posts-per-group-channel parameter")
	}
	workers, err := command.Flags().GetInt("workers")
	if err != nil {
		return errors.New("Invalid workers parameter")
	}
	profileImagesPath, err := command.Flags().GetString("profile-images")
	if err != nil {
		return errors.New("Invalid profile-images parameter")
	}
	profileImages := []string{}
	if profileImagesPath != "" {
		profileImagesStat, err := os.Stat(profileImagesPath)
		if os.IsNotExist(err) {
			return errors.New("Profile images folder doesn't exists.")
		}
		if !profileImagesStat.IsDir() {
			return errors.New("profile-images parameters must be a folder path.")
		}
		profileImagesFiles, err := ioutil.ReadDir(profileImagesPath)
		if err != nil {
			return errors.New("Invalid profile-images parameter")
		}
		for _, profileImage := range profileImagesFiles {
			profileImages = append(profileImages, path.Join(profileImagesPath, profileImage.Name()))
		}
		sort.Strings(profileImages)
	}

	if workers < 1 {
		return errors.New("You must have at least one worker.")
	}
	if teamMemberships > teams {
		return errors.New("You can't have more team memberships than teams.")
	}
	if channelMemberships > channelsPerTeam {
		return errors.New("You can't have more channel memberships than channels per team.")
	}

	var bulkFile *os.File
	switch bulk {
	case "":
		bulkFile, err = ioutil.TempFile("", ".mattermost-sample-data-")
		defer os.Remove(bulkFile.Name())
		if err != nil {
			return errors.New("Unable to open temporary file.")
		}
	case "-":
		bulkFile = os.Stdout
	default:
		bulkFile, err = os.OpenFile(bulk, os.O_RDWR|os.O_CREATE, 0755)
		if err != nil {
			return errors.New("Unable to write into the \"" + bulk + "\" file.")
		}
	}

	encoder := json.NewEncoder(bulkFile)
	version := 1
	encoder.Encode(app.LineImportData{Type: "version", Version: &version})

	fake.Seed(seed)
	rand.Seed(seed)

	teamsAndChannels := make(map[string][]string)
	for i := 0; i < teams; i++ {
		teamLine := createTeam(i)
		teamsAndChannels[*teamLine.Team.Name] = []string{}
		encoder.Encode(teamLine)
	}

	teamsList := []string{}
	for teamName := range teamsAndChannels {
		teamsList = append(teamsList, teamName)
	}
	sort.Strings(teamsList)

	for _, teamName := range teamsList {
		for i := 0; i < channelsPerTeam; i++ {
			channelLine := createChannel(i, teamName)
			teamsAndChannels[teamName] = append(teamsAndChannels[teamName], *channelLine.Channel.Name)
			encoder.Encode(channelLine)
		}
	}

	allUsers := []string{}
	for i := 0; i < users; i++ {
		userLine := createUser(i, teamMemberships, channelMemberships, teamsAndChannels, profileImages)
		encoder.Encode(userLine)
		allUsers = append(allUsers, *userLine.User.Username)
	}

	for team, channels := range teamsAndChannels {
		for _, channel := range channels {
			dates := sortedRandomDates(postsPerChannel)

			for i := 0; i < postsPerChannel; i++ {
				postLine := createPost(team, channel, allUsers, dates[i])
				encoder.Encode(postLine)
			}
		}
	}

	for i := 0; i < directChannels; i++ {
		user1 := allUsers[rand.Intn(len(allUsers))]
		user2 := allUsers[rand.Intn(len(allUsers))]
		channelLine := createDirectChannel([]string{user1, user2})
		encoder.Encode(channelLine)

		dates := sortedRandomDates(postsPerDirectChannel)
		for j := 0; j < postsPerDirectChannel; j++ {
			postLine := createDirectPost([]string{user1, user2}, dates[j])
			encoder.Encode(postLine)
		}
	}

	for i := 0; i < groupChannels; i++ {
		users := []string{}
		totalUsers := 3 + rand.Intn(3)
		for len(users) < totalUsers {
			user := allUsers[rand.Intn(len(allUsers))]
			if !sliceIncludes(users, user) {
				users = append(users, user)
			}
		}
		channelLine := createDirectChannel(users)
		encoder.Encode(channelLine)

		dates := sortedRandomDates(postsPerGroupChannel)
		for j := 0; j < postsPerGroupChannel; j++ {
			postLine := createDirectPost(users, dates[j])
			encoder.Encode(postLine)
		}
	}

	if bulk == "" {
		_, err := bulkFile.Seek(0, 0)
		if err != nil {
			return errors.New("Unable to read correctly the temporary file.")
		}
		importErr, lineNumber := a.BulkImport(bulkFile, false, workers)
		if importErr != nil {
			return fmt.Errorf("%s: %s, %s (line: %d)", importErr.Where, importErr.Message, importErr.DetailedError, lineNumber)
		}
	} else if bulk != "-" {
		err := bulkFile.Close()
		if err != nil {
			return errors.New("Unable to close correctly the output file")
		}
	}

	return nil
}

func createUser(idx int, teamMemberships int, channelMemberships int, teamsAndChannels map[string][]string, profileImages []string) app.LineImportData {
	password := fmt.Sprintf("user-%d", idx)
	email := fmt.Sprintf("user-%d@sample.mattermost.com", idx)
	firstName := fake.FirstName()
	lastName := fake.LastName()
	username := fmt.Sprintf("%s.%s", strings.ToLower(firstName), strings.ToLower(lastName))
	if idx == 0 {
		username = "sysadmin"
		password = "sysadmin"
		email = "sysadmin@sample.mattermost.com"
	} else if idx == 1 {
		username = "user-1"
	}
	position := fake.JobTitle()
	roles := "system_user"
	if idx%5 == 0 {
		roles = "system_admin system_user"
	}

	// The 75% of the users have custom profile image
	var profileImage *string = nil
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

	// Half of users skip tutorial
	tutorialStep := "999"
	switch rand.Intn(6) {
	case 1:
		tutorialStep = "1"
	case 2:
		tutorialStep = "2"
	case 3:
		tutorialStep = "3"
	}

	teams := []app.UserTeamImportData{}
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
			teams = append(teams, createTeamMembership(channelMemberships, teamChannels, &team))
		}
	}

	user := app.UserImportData{
		ProfileImage:       profileImage,
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
	}
	return app.LineImportData{
		Type: "user",
		User: &user,
	}
}

func createTeamMembership(numOfchannels int, teamChannels []string, teamName *string) app.UserTeamImportData {
	roles := "team_user"
	if rand.Intn(5) == 0 {
		roles = "team_user team_admin"
	}
	channels := []app.UserChannelImportData{}
	teamChannelsCopy := append([]string(nil), teamChannels...)
	for x := 0; x < numOfchannels; x++ {
		if len(teamChannelsCopy) == 0 {
			break
		}
		position := rand.Intn(len(teamChannelsCopy))
		channelName := teamChannelsCopy[position]
		teamChannelsCopy = append(teamChannelsCopy[:position], teamChannelsCopy[position+1:]...)
		channels = append(channels, createChannelMembership(channelName))
	}

	return app.UserTeamImportData{
		Name:     teamName,
		Roles:    &roles,
		Channels: &channels,
	}
}

func createChannelMembership(channelName string) app.UserChannelImportData {
	roles := "channel_user"
	if rand.Intn(5) == 0 {
		roles = "channel_user channel_admin"
	}
	favorite := rand.Intn(5) == 0

	return app.UserChannelImportData{
		Name:     &channelName,
		Roles:    &roles,
		Favorite: &favorite,
	}
}

func createTeam(idx int) app.LineImportData {
	displayName := fake.Word()
	name := fmt.Sprintf("%s-%d", fake.Word(), idx)
	allowOpenInvite := rand.Intn(2) == 0

	description := fake.Paragraph()
	if len(description) > 255 {
		description = description[0:255]
	}

	teamType := "O"
	if rand.Intn(2) == 0 {
		teamType = "I"
	}

	team := app.TeamImportData{
		DisplayName:     &displayName,
		Name:            &name,
		AllowOpenInvite: &allowOpenInvite,
		Description:     &description,
		Type:            &teamType,
	}
	return app.LineImportData{
		Type: "team",
		Team: &team,
	}
}

func createChannel(idx int, teamName string) app.LineImportData {
	displayName := fake.Word()
	name := fmt.Sprintf("%s-%d", fake.Word(), idx)
	header := fake.Paragraph()
	purpose := fake.Paragraph()

	if len(purpose) > 250 {
		purpose = purpose[0:250]
	}

	channelType := "P"
	if rand.Intn(2) == 0 {
		channelType = "O"
	}

	channel := app.ChannelImportData{
		Team:        &teamName,
		Name:        &name,
		DisplayName: &displayName,
		Type:        &channelType,
		Header:      &header,
		Purpose:     &purpose,
	}
	return app.LineImportData{
		Type:    "channel",
		Channel: &channel,
	}
}

func createPost(team string, channel string, allUsers []string, createAt int64) app.LineImportData {
	message := randomMessage(allUsers)
	create_at := createAt
	user := allUsers[rand.Intn(len(allUsers))]

	// Some messages are flagged by an user
	flagged_by := []string{}
	if rand.Intn(10) == 0 {
		flagged_by = append(flagged_by, allUsers[rand.Intn(len(allUsers))])
	}

	reactions := []app.ReactionImportData{}
	if rand.Intn(10) == 0 {
		for {
			reactions = append(reactions, randomReaction(allUsers, create_at))
			if rand.Intn(3) == 0 {
				break
			}
		}
	}

	replies := []app.ReplyImportData{}
	if rand.Intn(10) == 0 {
		for {
			replies = append(replies, randomReply(allUsers, create_at))
			if rand.Intn(4) == 0 {
				break
			}
		}
	}

	post := app.PostImportData{
		Team:      &team,
		Channel:   &channel,
		User:      &user,
		Message:   &message,
		CreateAt:  &create_at,
		FlaggedBy: &flagged_by,
		Reactions: &reactions,
		Replies:   &replies,
	}
	return app.LineImportData{
		Type: "post",
		Post: &post,
	}
}

func createDirectChannel(members []string) app.LineImportData {
	header := fake.Sentence()

	channel := app.DirectChannelImportData{
		Members: &members,
		Header:  &header,
	}
	return app.LineImportData{
		Type:          "direct_channel",
		DirectChannel: &channel,
	}
}

func createDirectPost(members []string, createAt int64) app.LineImportData {
	message := randomMessage(members)
	create_at := createAt
	user := members[rand.Intn(len(members))]

	// Some messages are flagged by an user
	flagged_by := []string{}
	if rand.Intn(10) == 0 {
		flagged_by = append(flagged_by, members[rand.Intn(len(members))])
	}

	reactions := []app.ReactionImportData{}
	if rand.Intn(10) == 0 {
		for {
			reactions = append(reactions, randomReaction(members, create_at))
			if rand.Intn(3) == 0 {
				break
			}
		}
	}

	replies := []app.ReplyImportData{}
	if rand.Intn(10) == 0 {
		for {
			replies = append(replies, randomReply(members, create_at))
			if rand.Intn(4) == 0 {
				break
			}
		}
	}

	post := app.DirectPostImportData{
		ChannelMembers: &members,
		User:           &user,
		Message:        &message,
		CreateAt:       &create_at,
		FlaggedBy:      &flagged_by,
		Reactions:      &reactions,
		Replies:        &replies,
	}
	return app.LineImportData{
		Type:       "direct_post",
		DirectPost: &post,
	}
}
