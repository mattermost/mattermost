// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

var usage = `Mattermost testing commands to help configure the system

	COMMANDS:

	Setup - Creates a testing environment in current team.
		/test setup [teams] [fuzz] <Num Channels> <Num Users> <NumPosts>

		Example:
		/test setup teams fuzz 10 20 50

	Users - Add a specified number of random users with fuzz text to current team.
		/test users [fuzz] <Min Users> <Max Users>

		Example:
			/test users fuzz 5 10

	Channels - Add a specified number of random channels with fuzz text to current team.
		/test channels [fuzz] <Min Channels> <Max Channels>

		Example:
			/test channels fuzz 5 10

	ThreadedPost - create a large threaded post
        /test threaded_post

	Posts - Add some random posts with fuzz text to current channel.
		/test posts [fuzz] <Min Posts> <Max Posts> <Max Images>

		Example:
			/test posts fuzz 5 10 3

	Post - Add post to a channel as another user.
		/test post u=@username p=passwd c=~channelname t=teamname "message"

		Example:
			/test post u=@user-1 p=user-1 c=~town-square t=ad-1 "message"

	Url - Add a post containing the text from a given url to current channel.
		/test url

		Example:
			/test http://www.example.com/sample_file.md

	Json - Add a post using the JSON file as payload to the current channel.
	        /test json url

		Example
		/test json http://www.example.com/sample_body.json

`

const (
	CMD_TEST = "test"
)

var (
	userRE    = regexp.MustCompile(`u=@([^\s]+)`)
	passwdRE  = regexp.MustCompile(`p=([^\s]+)`)
	teamRE    = regexp.MustCompile(`t=([^\s]+)`)
	channelRE = regexp.MustCompile(`c=~([^\s]+)`)
	messageRE = regexp.MustCompile(`"(.*)"`)
)

type LoadTestProvider struct {
}

func init() {
	RegisterCommandProvider(&LoadTestProvider{})
}

func (me *LoadTestProvider) GetTrigger() string {
	return CMD_TEST
}

func (me *LoadTestProvider) GetCommand(a *App, T goi18n.TranslateFunc) *model.Command {
	if !*a.Config().ServiceSettings.EnableTesting {
		return nil
	}
	return &model.Command{
		Trigger:          CMD_TEST,
		AutoComplete:     false,
		AutoCompleteDesc: "Debug Load Testing",
		AutoCompleteHint: "help",
		DisplayName:      "test",
	}
}

func (me *LoadTestProvider) DoCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	//This command is only available when EnableTesting is true
	if !*a.Config().ServiceSettings.EnableTesting {
		return &model.CommandResponse{}
	}

	if strings.HasPrefix(message, "setup") {
		return me.SetupCommand(a, args, message)
	}

	if strings.HasPrefix(message, "users") {
		return me.UsersCommand(a, args, message)
	}

	if strings.HasPrefix(message, "activate_user") {
		return me.ActivateUserCommand(a, args, message)
	}

	if strings.HasPrefix(message, "deactivate_user") {
		return me.DeActivateUserCommand(a, args, message)
	}

	if strings.HasPrefix(message, "channels") {
		return me.ChannelsCommand(a, args, message)
	}

	if strings.HasPrefix(message, "posts") {
		return me.PostsCommand(a, args, message)
	}

	if strings.HasPrefix(message, "post") {
		return me.PostCommand(a, args, message)
	}

	if strings.HasPrefix(message, "threaded_post") {
		return me.ThreadedPostCommand(a, args, message)
	}

	if strings.HasPrefix(message, "url") {
		return me.UrlCommand(a, args, message)
	}
	if strings.HasPrefix(message, "json") {
		return me.JsonCommand(a, args, message)
	}
	return me.HelpCommand(args, message)
}

func (me *LoadTestProvider) HelpCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	return &model.CommandResponse{Text: usage, ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) SetupCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	tokens := strings.Fields(strings.TrimPrefix(message, "setup"))
	doTeams := contains(tokens, "teams")
	doFuzz := contains(tokens, "fuzz")

	numArgs := 0
	if doTeams {
		numArgs++
	}
	if doFuzz {
		numArgs++
	}

	var numTeams int
	var numChannels int
	var numUsers int
	var numPosts int

	// Defaults
	numTeams = 10
	numChannels = 10
	numUsers = 10
	numPosts = 10

	if doTeams {
		if (len(tokens) - numArgs) >= 4 {
			numTeams, _ = strconv.Atoi(tokens[numArgs+0])
			numChannels, _ = strconv.Atoi(tokens[numArgs+1])
			numUsers, _ = strconv.Atoi(tokens[numArgs+2])
			numPosts, _ = strconv.Atoi(tokens[numArgs+3])
		}
	} else {
		if (len(tokens) - numArgs) >= 3 {
			numChannels, _ = strconv.Atoi(tokens[numArgs+0])
			numUsers, _ = strconv.Atoi(tokens[numArgs+1])
			numPosts, _ = strconv.Atoi(tokens[numArgs+2])
		}
	}
	client := model.NewAPIv4Client(args.SiteURL)

	if doTeams {
		if err := a.CreateBasicUser(client); err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
		client.Login(BTEST_USER_EMAIL, BTEST_USER_PASSWORD)
		environment, err := CreateTestEnvironmentWithTeams(
			a,
			client,
			utils.Range{Begin: numTeams, End: numTeams},
			utils.Range{Begin: numChannels, End: numChannels},
			utils.Range{Begin: numUsers, End: numUsers},
			utils.Range{Begin: numPosts, End: numPosts},
			doFuzz)
		if !err {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		} else {
			mlog.Info("Testing environment created")
			for i := 0; i < len(environment.Teams); i++ {
				mlog.Info("Team Created: " + environment.Teams[i].Name)
				mlog.Info("\t User to login: " + environment.Environments[i].Users[0].Email + ", " + USER_PASSWORD)
			}
		}
	} else {
		team, err := a.Srv.Store.Team().Get(args.TeamId)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}

		client.SetToken(args.Session.Token)
		CreateTestEnvironmentInTeam(
			a,
			client,
			team,
			utils.Range{Begin: numChannels, End: numChannels},
			utils.Range{Begin: numUsers, End: numUsers},
			utils.Range{Begin: numPosts, End: numPosts},
			doFuzz)
	}

	return &model.CommandResponse{Text: "Created environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) ActivateUserCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	user_id := strings.TrimSpace(strings.TrimPrefix(message, "activate_user"))
	if err := a.UpdateUserActive(user_id, true); err != nil {
		return &model.CommandResponse{Text: "Failed to activate user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	return &model.CommandResponse{Text: "Activated user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) DeActivateUserCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	user_id := strings.TrimSpace(strings.TrimPrefix(message, "deactivate_user"))
	if err := a.UpdateUserActive(user_id, false); err != nil {
		return &model.CommandResponse{Text: "Failed to deactivate user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	return &model.CommandResponse{Text: "DeActivated user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) UsersCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "users"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	usersr, ok := parseRange(cmd, "")
	if !ok {
		usersr = utils.Range{Begin: 2, End: 5}
	}

	team, err := a.Srv.Store.Team().Get(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	userCreator := NewAutoUserCreator(a, client, team)
	userCreator.Fuzzy = doFuzz
	userCreator.CreateTestUsers(usersr)

	return &model.CommandResponse{Text: "Added users", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) ChannelsCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "channels"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	channelsr, ok := parseRange(cmd, "")
	if !ok {
		channelsr = utils.Range{Begin: 2, End: 5}
	}

	team, err := a.Srv.Store.Team().Get(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	client.SetToken(args.Session.Token)
	channelCreator := NewAutoChannelCreator(client, team)
	channelCreator.Fuzzy = doFuzz
	channelCreator.CreateTestChannels(channelsr)

	return &model.CommandResponse{Text: "Added channels", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) ThreadedPostCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	var usernames []string
	options := &model.UserGetOptions{InTeamId: args.TeamId, Page: 0, PerPage: 1000}
	if profileUsers, err := a.Srv.Store.User().GetProfiles(options); err == nil {
		usernames = make([]string, len(profileUsers))
		i := 0
		for _, userprof := range profileUsers {
			usernames[i] = userprof.Username
			i++
		}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	client.MockSession(args.Session.Token)
	testPoster := NewAutoPostCreator(client, args.ChannelId)
	testPoster.Fuzzy = true
	testPoster.Users = usernames
	rpost, ok := testPoster.CreateRandomPost()
	if !ok {
		return &model.CommandResponse{Text: "Cannot create a post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	for i := 0; i < 1000; i++ {
		testPoster.CreateRandomPostNested(rpost.Id, rpost.Id)
	}

	return &model.CommandResponse{Text: "Added threaded post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) PostsCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "posts"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	postsr, ok := parseRange(cmd, "")
	if !ok {
		postsr = utils.Range{Begin: 20, End: 30}
	}

	tokens := strings.Fields(cmd)
	rimages := utils.Range{Begin: 0, End: 0}
	if len(tokens) >= 3 {
		if numImages, err := strconv.Atoi(tokens[2]); err == nil {
			rimages = utils.Range{Begin: numImages, End: numImages}
		}
	}

	var usernames []string
	options := &model.UserGetOptions{InTeamId: args.TeamId, Page: 0, PerPage: 1000}
	if profileUsers, err := a.Srv.Store.User().GetProfiles(options); err == nil {
		usernames = make([]string, len(profileUsers))
		i := 0
		for _, userprof := range profileUsers {
			usernames[i] = userprof.Username
			i++
		}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	client.SetToken(args.Session.Token)
	testPoster := NewAutoPostCreator(client, args.ChannelId)
	testPoster.Fuzzy = doFuzz
	testPoster.Users = usernames

	numImages := utils.RandIntFromRange(rimages)
	numPosts := utils.RandIntFromRange(postsr)
	for i := 0; i < numPosts; i++ {
		testPoster.HasImage = (i < numImages)
		testPoster.CreateRandomPost()
	}

	return &model.CommandResponse{Text: "Added posts", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func getMatch(re *regexp.Regexp, text string) string {
	if match := re.FindStringSubmatch(text); match != nil {
		return match[1]
	}

	return ""
}

func (me *LoadTestProvider) PostCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	textMessage := getMatch(messageRE, message)
	if textMessage == "" {
		return &model.CommandResponse{Text: "No message to post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	teamName := getMatch(teamRE, message)
	team, err := a.GetTeamByName(teamName)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a team", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	channelName := getMatch(channelRE, message)
	channel, err := a.GetChannelByName(channelName, team.Id, true)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a channel", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	passwd := getMatch(passwdRE, message)
	username := getMatch(userRE, message)
	user, err := a.GetUserByUsername(username)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	_, resp := client.LoginById(user.Id, passwd)
	if resp != nil && resp.Error != nil {
		return &model.CommandResponse{Text: "Failed to login a user", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   textMessage,
	}
	_, resp = client.CreatePost(post)
	if resp != nil && resp.Error != nil {
		return &model.CommandResponse{Text: "Failed to create a post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	return &model.CommandResponse{Text: "Added a post to " + channel.DisplayName, ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) UrlCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	url := strings.TrimSpace(strings.TrimPrefix(message, "url"))
	if len(url) == 0 {
		return &model.CommandResponse{Text: "Command must contain a url", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// provide a shortcut to easily access tests stored in doc/developer/tests
	if !strings.HasPrefix(url, "http") {
		url = "https://raw.githubusercontent.com/mattermost/mattermost-server/master/tests/" + url

		if path.Ext(url) == "" {
			url += ".md"
		}
	}

	var contents io.ReadCloser
	if r, err := http.Get(url); err != nil {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else if r.StatusCode > 400 {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		contents = r.Body
	}

	bytes := make([]byte, 4000)

	// break contents into 4000 byte posts
	for {
		length, err := contents.Read(bytes)
		if err != nil && err != io.EOF {
			return &model.CommandResponse{Text: "Encountered error reading file", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}

		if length == 0 {
			break
		}

		post := &model.Post{}
		post.Message = string(bytes[:length])
		post.ChannelId = args.ChannelId
		post.UserId = args.UserId

		if _, err := a.CreatePostMissingChannel(post, false); err != nil {
			return &model.CommandResponse{Text: "Unable to create post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	return &model.CommandResponse{Text: "Loaded data", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) JsonCommand(a *App, args *model.CommandArgs, message string) *model.CommandResponse {
	url := strings.TrimSpace(strings.TrimPrefix(message, "json"))
	if len(url) == 0 {
		return &model.CommandResponse{Text: "Command must contain a url", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// provide a shortcut to easily access tests stored in doc/developer/tests
	if !strings.HasPrefix(url, "http") {
		url = "https://raw.githubusercontent.com/mattermost/mattermost-server/master/tests/" + url

		if path.Ext(url) == "" {
			url += ".json"
		}
	}

	var contents io.ReadCloser
	if r, err := http.Get(url); err != nil {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else if r.StatusCode > 400 {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	} else {
		contents = r.Body
	}

	post := model.PostFromJson(contents)
	post.ChannelId = args.ChannelId
	post.UserId = args.UserId
	if post.Message == "" {
		post.Message = message
	}

	if _, err := a.CreatePostMissingChannel(post, false); err != nil {
		return &model.CommandResponse{Text: "Unable to create post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}
	return &model.CommandResponse{Text: "Loaded data", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func parseRange(command string, cmd string) (utils.Range, bool) {
	tokens := strings.Fields(strings.TrimPrefix(command, cmd))
	var begin int
	var end int
	var err1 error
	var err2 error
	switch {
	case len(tokens) == 1:
		begin, err1 = strconv.Atoi(tokens[0])
		end = begin
		if err1 != nil {
			return utils.Range{Begin: 0, End: 0}, false
		}
	case len(tokens) >= 2:
		begin, err1 = strconv.Atoi(tokens[0])
		end, err2 = strconv.Atoi(tokens[1])
		if err1 != nil || err2 != nil {
			return utils.Range{Begin: 0, End: 0}, false
		}
	default:
		return utils.Range{Begin: 0, End: 0}, false
	}
	return utils.Range{Begin: begin, End: end}, true
}

func contains(items []string, token string) bool {
	for _, elem := range items {
		if elem == token {
			return true
		}
	}
	return false
}
