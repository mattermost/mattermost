// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slashcommands

import (
	"encoding/json"
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
)

var usage = `Mattermost testing commands to help configure the system

	COMMANDS:

	Setup - Creates a testing environment in current team.
		/test setup [teams] [fuzz] <Num Channels> <Num Users> <NumPosts>

		Example:
			/test setup teams fuzz 10 20 50

	Users - Add a specified number of random users with fuzz text to current team, at the specified time.
		/test users [fuzz] [range=min[,max]] [time=user_join_timestamp]

		Default: range=2,5 time=

		Examples:
			/test users fuzz range=3,8 time=1565076128000
			/test users range=1

	Channels - Add a specified number of random channels with fuzz text to current team, at the specified time.
		/test channels [fuzz] [range=min[,max]] [time=channel_create_timestamp]

		Default: range=2,5 time=

		Examples:
			/test channels fuzz range=5,10 time=1565076128000
			/test channels range=1

	DMs - Add a specified number of random DM messages between the current user and a specified user, at the specified time. If a timestamp is provided, posts are created one millisecond apart. Note: You may need to clear your browser cache in order to see these posts in the UI.
		/test dms u=@username [range=min[,max]] [time=dm_create_timestamp]

		Default: range=2,5 time=

		Examples:
			/test dms u=@user range=5,10 time=1565076128000
			/test dms u=@user range=2

	ThreadedPost - Create a threaded post with a specified number of replies at the specified time. If a timestamp is provided, posts are created one millisecond apart. Note: You may need to clear your browser cache in order to see these posts in the UI.
        /test threaded_post [range=min[,max]] [time=post_timestamp]

		Default: range=1000 time=

		Examples:
			/test threaded_post
			/test threaded_post range=100,200 time=1565076128000

	Posts - Add some random posts with fuzz text to current channel, at the specified time. If a timestamp is provided, posts are created one millisecond apart. Note: You may need to clear your browser cache in order to see these posts in the UI.
		/test posts [fuzz] [range=min[,max]] [images=max_images] [time=post_timestamp]

		Default: range=2,5 images=0 time=

		Example:
			/test posts fuzz range=5,10 images=3

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

		Example:
			/test json http://www.example.com/sample_body.json

`

const (
	CmdTest = "test"
)

var (
	userRE    = regexp.MustCompile(`u=@?([^\s]+)`)
	passwdRE  = regexp.MustCompile(`p=([^\s]+)`)
	teamRE    = regexp.MustCompile(`t=([^\s]+)`)
	channelRE = regexp.MustCompile(`c=~([^\s]+)`)
	messageRE = regexp.MustCompile(`"(.*)"`)
	fuzzRE    = regexp.MustCompile(`fuzz`)
	rangeRE   = regexp.MustCompile(`range=([^\s]+)`)
	timeRE    = regexp.MustCompile(`time=([^\s]+)`)
	imagesRE  = regexp.MustCompile(`images=([^\s]+)`)
)

type LoadTestProvider struct {
}

func init() {
	app.RegisterCommandProvider(&LoadTestProvider{})
}

func (*LoadTestProvider) GetTrigger() string {
	return CmdTest
}

func (*LoadTestProvider) GetCommand(a *app.App, T i18n.TranslateFunc) *model.Command {
	if !*a.Config().ServiceSettings.EnableTesting {
		return nil
	}
	return &model.Command{
		Trigger:          CmdTest,
		AutoComplete:     false,
		AutoCompleteDesc: "Debug Load Testing",
		AutoCompleteHint: "help",
		DisplayName:      "test",
	}
}

func (lt *LoadTestProvider) DoCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) *model.CommandResponse {
	commandResponse, err := lt.doCommand(a, c, args, message)
	if err != nil {
		c.Logger().Error("failed command /"+CmdTest, mlog.Err(err))
	}

	return commandResponse
}

func (lt *LoadTestProvider) doCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	//This command is only available when EnableTesting is true
	if !*a.Config().ServiceSettings.EnableTesting {
		return &model.CommandResponse{}, nil
	}

	if strings.HasPrefix(message, "setup") {
		return lt.SetupCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "users") {
		return lt.UsersCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "activate_user") {
		return lt.ActivateUserCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "deactivate_user") {
		return lt.DeActivateUserCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "channels") {
		return lt.ChannelsCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "dms") {
		return lt.DMsCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "posts") {
		return lt.PostsCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "post") {
		return lt.PostCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "threaded_post") {
		return lt.ThreadedPostCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "url") {
		return lt.URLCommand(a, c, args, message)
	}

	if strings.HasPrefix(message, "json") {
		return lt.JsonCommand(a, c, args, message)
	}

	return lt.HelpCommand(args, message), nil
}

func (*LoadTestProvider) HelpCommand(args *model.CommandArgs, message string) *model.CommandResponse {
	return &model.CommandResponse{Text: usage, ResponseType: model.CommandResponseTypeEphemeral}
}

func (*LoadTestProvider) SetupCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
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
		if err := CreateBasicUser(a, client); err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.CommandResponseTypeEphemeral}, err
		}
		_, _, err := client.Login(BTestUserEmail, BTestUserPassword)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.CommandResponseTypeEphemeral}, err
		}
		environment, err := CreateTestEnvironmentWithTeams(
			a,
			c,
			client,
			utils.Range{Begin: numTeams, End: numTeams},
			utils.Range{Begin: numChannels, End: numChannels},
			utils.Range{Begin: numUsers, End: numUsers},
			utils.Range{Begin: numPosts, End: numPosts},
			doFuzz)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.CommandResponseTypeEphemeral}, err
		}

		c.Logger().Info("Testing environment created")
		for i := 0; i < len(environment.Teams); i++ {
			c.Logger().Info("Team Created: " + environment.Teams[i].Name)
			c.Logger().Info("\t User to login: " + environment.Environments[i].Users[0].Email + ", " + UserPassword)
		}
	} else {
		team, err := a.Srv().Store().Team().Get(args.TeamId)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.CommandResponseTypeEphemeral}, err
		}

		CreateTestEnvironmentInTeam(
			a,
			c,
			client,
			team,
			utils.Range{Begin: numChannels, End: numChannels},
			utils.Range{Begin: numUsers, End: numUsers},
			utils.Range{Begin: numPosts, End: numPosts},
			doFuzz)
	}

	return &model.CommandResponse{Text: "Created environment", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) ActivateUserCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	user_id := strings.TrimSpace(strings.TrimPrefix(message, "activate_user"))
	if err := a.UpdateUserActive(c, user_id, true); err != nil {
		return &model.CommandResponse{Text: "Failed to activate user", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	return &model.CommandResponse{Text: "Activated user", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) DeActivateUserCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	user_id := strings.TrimSpace(strings.TrimPrefix(message, "deactivate_user"))
	if err := a.UpdateUserActive(c, user_id, false); err != nil {
		return &model.CommandResponse{Text: "Failed to deactivate user", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	return &model.CommandResponse{Text: "DeActivated user", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) UsersCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "users"))

	doFuzz := false
	if fuzzRE.MatchString(cmd) {
		doFuzz = true
	}

	var err error
	rng := utils.Range{Begin: 2, End: 5}
	rangeParam := getMatch(rangeRE, cmd)
	if rangeParam != "" {
		rng, err = parseRange(rangeParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add users: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	team, err := a.Srv().Store().Team().Get(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to add users", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	time := int64(0)
	timeParam := getMatch(timeRE, cmd)
	if timeParam != "" {
		time, err = strconv.ParseInt(timeParam, 10, 64)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add users: Invalid time parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid time parameter")
		}
	}

	client := model.NewAPIv4Client(args.SiteURL)
	userCreator := NewAutoUserCreator(a, client, team)
	userCreator.Fuzzy = doFuzz
	userCreator.JoinTime = time
	if _, err := userCreator.CreateTestUsers(c, rng); err != nil {
		return &model.CommandResponse{Text: "Failed to add users: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	return &model.CommandResponse{Text: "Added users", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) ChannelsCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "channels"))

	doFuzz := false
	if fuzzRE.MatchString(cmd) {
		doFuzz = true
	}

	var err error
	rng := utils.Range{Begin: 2, End: 5}
	rangeParam := getMatch(rangeRE, cmd)
	if rangeParam != "" {
		rng, err = parseRange(rangeParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add channels: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	team, err := a.Srv().Store().Team().Get(args.TeamId)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to add channels", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	time := int64(0)
	timeParam := getMatch(timeRE, cmd)
	if timeParam != "" {
		time, err = strconv.ParseInt(timeParam, 10, 64)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add channels: Invalid time parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid time parameter")
		}
	}

	channelCreator := NewAutoChannelCreator(a, team, args.UserId)
	channelCreator.Fuzzy = doFuzz
	channelCreator.CreateTime = time
	if _, err := channelCreator.CreateTestChannels(c, rng); err != nil {
		return &model.CommandResponse{Text: "Failed to create test channels: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	return &model.CommandResponse{Text: "Added channels", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) DMsCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "dms"))

	var err error

	username := getMatch(userRE, message)
	user, appErr := a.GetUserByUsername(username)
	if appErr != nil {
		return &model.CommandResponse{Text: "Failed to add DMS: Invalid username", ResponseType: model.CommandResponseTypeEphemeral}, appErr
	}

	rng := utils.Range{Begin: 2, End: 5}
	rangeParam := getMatch(rangeRE, cmd)
	if rangeParam != "" {
		rng, err = parseRange(rangeParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add DMs: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	time := int64(0)
	timeParam := getMatch(timeRE, cmd)
	if timeParam != "" {
		time, err = strconv.ParseInt(timeParam, 10, 64)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add DMs: Invalid time parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid time parameter")
		}
	}

	channel, err := a.GetOrCreateDirectChannel(c, args.UserId, user.Id)

	postCreator := NewAutoPostCreator(a, channel.Id, args.UserId)
	postCreator.CreateTime = time
	postCreator.UsersToPostFrom = []string{user.Id}
	numPosts := utils.RandIntFromRange(rng)
	for i := 0; i < numPosts; i++ {
		if _, err := postCreator.CreateRandomPost(c); err != nil {
			return &model.CommandResponse{Text: "Failed to create test DMs: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}
	}

	return &model.CommandResponse{Text: "Added DMs", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) ThreadedPostCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "threaded_post"))

	var err error
	rng := utils.Range{Begin: 1000, End: 1000}
	rangeParam := getMatch(rangeRE, cmd)
	if rangeParam != "" {
		rng, err = parseRange(rangeParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create post: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	time := int64(0)
	timeParam := getMatch(timeRE, cmd)
	if timeParam != "" {
		time, err = strconv.ParseInt(timeParam, 10, 64)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to create post: Invalid time parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid time parameter")
		}
	}

	var usernames []string
	options := &model.UserGetOptions{InTeamId: args.TeamId, Page: 0, PerPage: 1000}
	if profileUsers, err := a.Srv().Store().User().GetProfiles(options); err == nil {
		usernames = make([]string, len(profileUsers))
		i := 0
		for _, userprof := range profileUsers {
			usernames[i] = userprof.Username
			i++
		}
	}

	testPoster := NewAutoPostCreator(a, args.ChannelId, args.UserId)
	testPoster.Fuzzy = true
	testPoster.Users = usernames
	testPoster.CreateTime = time
	rpost, err2 := testPoster.CreateRandomPost(c)
	if err2 != nil {
		return &model.CommandResponse{Text: "Failed to create a post", ResponseType: model.CommandResponseTypeEphemeral}, err2
	}
	numPosts := utils.RandIntFromRange(rng)
	for i := 0; i < numPosts; i++ {
		testPoster.CreateRandomPostNested(c, rpost.Id)
	}

	return &model.CommandResponse{Text: "Added threaded post", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) PostsCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "posts"))

	doFuzz := false
	if fuzzRE.MatchString(cmd) {
		doFuzz = true
	}

	var err error
	rng := utils.Range{Begin: 2, End: 5}
	rangeParam := getMatch(rangeRE, cmd)
	if rangeParam != "" {
		rng, err = parseRange(rangeParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add posts: " + err.Error(), ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	maxImages := 0
	imagesParam := getMatch(imagesRE, cmd)
	if imagesParam != "" {
		maxImages, err = strconv.Atoi(imagesParam)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add posts: Invalid images parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid images parameter")
		}
	}

	time := int64(0)
	timeParam := getMatch(timeRE, cmd)
	if timeParam != "" {
		time, err = strconv.ParseInt(timeParam, 10, 64)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add posts: Invalid time parameter", ResponseType: model.CommandResponseTypeEphemeral}, errors.New("Invalid time parameter")
		}
	}

	var usernames []string
	options := &model.UserGetOptions{InTeamId: args.TeamId, Page: 0, PerPage: 1000}
	if profileUsers, err := a.Srv().Store().User().GetProfiles(options); err == nil {
		usernames = make([]string, len(profileUsers))
		i := 0
		for _, userprof := range profileUsers {
			usernames[i] = userprof.Username
			i++
		}
	}

	testPoster := NewAutoPostCreator(a, args.ChannelId, args.UserId)
	testPoster.Fuzzy = doFuzz
	testPoster.Users = usernames
	testPoster.CreateTime = time

	numImages := utils.RandIntFromRange(utils.Range{Begin: 0, End: maxImages})
	numPosts := utils.RandIntFromRange(rng)
	for i := 0; i < numPosts; i++ {
		testPoster.HasImage = (i < numImages)
		_, err := testPoster.CreateRandomPost(c)
		if err != nil {
			return &model.CommandResponse{Text: "Failed to add posts", ResponseType: model.CommandResponseTypeEphemeral}, err
		}

	}

	return &model.CommandResponse{Text: "Added posts", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func getMatch(re *regexp.Regexp, text string) string {
	if match := re.FindStringSubmatch(text); match != nil {
		return match[1]
	}

	return ""
}

func (*LoadTestProvider) PostCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	textMessage := getMatch(messageRE, message)
	if textMessage == "" {
		return &model.CommandResponse{Text: "No message to post", ResponseType: model.CommandResponseTypeEphemeral}, nil
	}

	teamName := getMatch(teamRE, message)
	team, err := a.GetTeamByName(teamName)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a team", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	channelName := getMatch(channelRE, message)
	channel, err := a.GetChannelByName(c, channelName, team.Id, true)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a channel", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	passwd := getMatch(passwdRE, message)
	username := getMatch(userRE, message)
	user, err := a.GetUserByUsername(username)
	if err != nil {
		return &model.CommandResponse{Text: "Failed to get a user", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	client := model.NewAPIv4Client(args.SiteURL)
	_, _, nErr := client.LoginById(user.Id, passwd)
	if nErr != nil {
		return &model.CommandResponse{Text: "Failed to login a user", ResponseType: model.CommandResponseTypeEphemeral}, nErr
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   textMessage,
	}
	_, _, nErr = client.CreatePost(post)
	if nErr != nil {
		return &model.CommandResponse{Text: "Failed to create a post", ResponseType: model.CommandResponseTypeEphemeral}, nErr
	}

	return &model.CommandResponse{Text: "Added a post to " + channel.DisplayName, ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) URLCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	url := strings.TrimSpace(strings.TrimPrefix(message, "url"))
	if url == "" {
		return &model.CommandResponse{Text: "Command must contain a url", ResponseType: model.CommandResponseTypeEphemeral}, nil
	}

	// provide a shortcut to easily access tests stored in doc/developer/tests
	if !strings.HasPrefix(url, "http") {
		url = "https://raw.githubusercontent.com/mattermost/mattermost-server/master/tests/" + url

		if path.Ext(url) == "" {
			url += ".md"
		}
	}

	r, err := http.Get(url)
	if err != nil {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.CommandResponseTypeEphemeral}, err
	}
	defer func() {
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
	}()

	if r.StatusCode > 400 {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.CommandResponseTypeEphemeral}, errors.Errorf("unexpected status code %d", r.StatusCode)
	}

	bytes := make([]byte, 4000)

	// break contents into 4000 byte posts
	for {
		length, err := r.Body.Read(bytes)
		if err != nil && err != io.EOF {
			return &model.CommandResponse{Text: "Encountered error reading file", ResponseType: model.CommandResponseTypeEphemeral}, err
		}

		if length == 0 {
			break
		}

		post := &model.Post{}
		post.Message = string(bytes[:length])
		post.ChannelId = args.ChannelId
		post.UserId = args.UserId

		if _, err := a.CreatePostMissingChannel(c, post, false); err != nil {
			return &model.CommandResponse{Text: "Unable to create post", ResponseType: model.CommandResponseTypeEphemeral}, err
		}
	}

	return &model.CommandResponse{Text: "Loaded data", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func (*LoadTestProvider) JsonCommand(a *app.App, c request.CTX, args *model.CommandArgs, message string) (*model.CommandResponse, error) {
	url := strings.TrimSpace(strings.TrimPrefix(message, "json"))
	if url == "" {
		return &model.CommandResponse{Text: "Command must contain a url", ResponseType: model.CommandResponseTypeEphemeral}, nil
	}

	// provide a shortcut to easily access tests stored in doc/developer/tests
	if !strings.HasPrefix(url, "http") {
		url = "https://raw.githubusercontent.com/mattermost/mattermost-server/master/tests/" + url

		if path.Ext(url) == "" {
			url += ".json"
		}
	}

	r, err := http.Get(url)
	if err != nil {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	if r.StatusCode > 400 {
		return &model.CommandResponse{Text: "Unable to get file", ResponseType: model.CommandResponseTypeEphemeral}, errors.Errorf("unexpected status code %d", r.StatusCode)
	}
	defer func() {
		io.Copy(io.Discard, r.Body)
		r.Body.Close()
	}()

	var post model.Post
	if jsonErr := json.NewDecoder(r.Body).Decode(&post); jsonErr != nil {
		return &model.CommandResponse{Text: "Unable to decode post", ResponseType: model.CommandResponseTypeEphemeral}, errors.Wrapf(jsonErr, "could not decode post from json")
	}
	post.ChannelId = args.ChannelId
	post.UserId = args.UserId
	if post.Message == "" {
		post.Message = message
	}

	if _, err := a.CreatePostMissingChannel(c, &post, false); err != nil {
		return &model.CommandResponse{Text: "Unable to create post", ResponseType: model.CommandResponseTypeEphemeral}, err
	}

	return &model.CommandResponse{Text: "Loaded data", ResponseType: model.CommandResponseTypeEphemeral}, nil
}

func parseRange(rng string) (utils.Range, error) {
	tokens := strings.Split(rng, ",")
	var begin int
	var end int
	var err1 error
	var err2 error
	switch {
	case len(tokens) == 1:
		begin, err1 = strconv.Atoi(tokens[0])
		if err1 != nil {
			return utils.Range{Begin: 0, End: 0}, errors.New("Invalid range parameter")
		}
		end = begin
	case len(tokens) == 2:
		begin, err1 = strconv.Atoi(tokens[0])
		end, err2 = strconv.Atoi(tokens[1])
		if err1 != nil || err2 != nil {
			return utils.Range{Begin: 0, End: 0}, errors.New("Invalid range parameter")
		}
	default:
		return utils.Range{Begin: 0, End: 0}, errors.New("Invalid range parameter")
	}
	return utils.Range{Begin: begin, End: end}, nil
}

func contains(items []string, token string) bool {
	for _, elem := range items {
		if elem == token {
			return true
		}
	}
	return false
}
