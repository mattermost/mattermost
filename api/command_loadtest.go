// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

var usage = `Mattermost load testing commands to help configure the system

	COMMANDS:

	Setup - Creates a testing environment in current team.
		/loadtest setup [teams] [fuzz] <Num Channels> <Num Users> <NumPosts>

		Example:
		/loadtest setup teams fuzz 10 20 50

	Users - Add a specified number of random users with fuzz text to current team.
		/loadtest users [fuzz] <Min Users> <Max Users>
		
		Example:
			/loadtest users fuzz 5 10

	Channels - Add a specified number of random channels with fuzz text to current team.
		/loadtest channels [fuzz] <Min Channels> <Max Channels>
		
		Example:
			/loadtest channels fuzz 5 10

	Posts - Add some random posts with fuzz text to current channel.
		/loadtest posts [fuzz] <Min Posts> <Max Posts> <Max Images>
		
		Example:
			/loadtest posts fuzz 5 10 3

	Url - Add a post containing the text from a given url to current channel.
		/loadtest url
		
		Example:
			/loadtest http://www.example.com/sample_file.md


`

type LoadTestProvider struct {
}

func init() {
	if !utils.Cfg.ServiceSettings.EnableTesting {
		RegisterCommandProvider(&LoadTestProvider{})
	}
}

func (me *LoadTestProvider) GetCommand() *model.Command {
	return &model.Command{
		Trigger:          "loadtest",
		AutoComplete:     false,
		AutoCompleteDesc: "Debug Load Testing",
		AutoCompleteHint: "help",
		DisplayName:      "loadtest",
	}
}

func (me *LoadTestProvider) DoCommand(c *Context, channelId string, message string) *model.CommandResponse {

	// This command is only available when EnableTesting is true
	// if !utils.Cfg.ServiceSettings.EnableTesting {
	// 	return &model.CommandResponse{}
	// }

	if strings.HasPrefix(message, "setup") {
		return me.SetupCommand(c, channelId, message)
	}

	if strings.HasPrefix(message, "users") {
		return me.UsersCommand(c, channelId, message)
	}

	if strings.HasPrefix(message, "channels") {
		return me.ChannelsCommand(c, channelId, message)
	}

	if strings.HasPrefix(message, "posts") {
		return me.PostsCommand(c, channelId, message)
	}

	if strings.HasPrefix(message, "url") {
		return me.UrlCommand(c, channelId, message)
	}

	return me.HelpCommand(c, channelId, message)
}

func (me *LoadTestProvider) HelpCommand(c *Context, channelId string, message string) *model.CommandResponse {
	return &model.CommandResponse{Text: usage, ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) SetupCommand(c *Context, channelId string, message string) *model.CommandResponse {
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
	client := model.NewClient(c.GetSiteURL())

	if doTeams {
		if err := CreateBasicUser(client); err != nil {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
		client.LoginByEmail(BTEST_TEAM_NAME, BTEST_USER_EMAIL, BTEST_USER_PASSWORD)
		environment, err := CreateTestEnvironmentWithTeams(
			client,
			utils.Range{numTeams, numTeams},
			utils.Range{numChannels, numChannels},
			utils.Range{numUsers, numUsers},
			utils.Range{numPosts, numPosts},
			doFuzz)
		if err != true {
			return &model.CommandResponse{Text: "Failed to create testing environment", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		} else {
			l4g.Info("Testing environment created")
			for i := 0; i < len(environment.Teams); i++ {
				l4g.Info("Team Created: " + environment.Teams[i].Name)
				l4g.Info("\t User to login: " + environment.Environments[i].Users[0].Email + ", " + USER_PASSWORD)
			}
		}
	} else {
		client.MockSession(c.Session.Token)
		CreateTestEnvironmentInTeam(
			client,
			c.Session.TeamId,
			utils.Range{numChannels, numChannels},
			utils.Range{numUsers, numUsers},
			utils.Range{numPosts, numPosts},
			doFuzz)
	}

	return &model.CommandResponse{Text: "Creating enviroment...", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) UsersCommand(c *Context, channelId string, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "users"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	usersr, err := parseRange(cmd, "")
	if err == false {
		usersr = utils.Range{2, 5}
	}

	client := model.NewClient(c.GetSiteURL())
	userCreator := NewAutoUserCreator(client, c.Session.TeamId)
	userCreator.Fuzzy = doFuzz
	userCreator.CreateTestUsers(usersr)

	return &model.CommandResponse{Text: "Adding users...", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) ChannelsCommand(c *Context, channelId string, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "channels"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	channelsr, err := parseRange(cmd, "")
	if err == false {
		channelsr = utils.Range{2, 5}
	}
	client := model.NewClient(c.GetSiteURL())
	client.MockSession(c.Session.Token)
	channelCreator := NewAutoChannelCreator(client, c.Session.TeamId)
	channelCreator.Fuzzy = doFuzz
	channelCreator.CreateTestChannels(channelsr)

	return &model.CommandResponse{Text: "Adding channels...", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) PostsCommand(c *Context, channelId string, message string) *model.CommandResponse {
	cmd := strings.TrimSpace(strings.TrimPrefix(message, "posts"))

	doFuzz := false
	if strings.Index(cmd, "fuzz") == 0 {
		doFuzz = true
		cmd = strings.TrimSpace(strings.TrimPrefix(cmd, "fuzz"))
	}

	postsr, err := parseRange(cmd, "")
	if err == false {
		postsr = utils.Range{20, 30}
	}

	tokens := strings.Fields(cmd)
	rimages := utils.Range{0, 0}
	if len(tokens) >= 3 {
		if numImages, err := strconv.Atoi(tokens[2]); err == nil {
			rimages = utils.Range{numImages, numImages}
		}
	}

	var usernames []string
	if result := <-Srv.Store.User().GetProfiles(c.Session.TeamId); result.Err == nil {
		profileUsers := result.Data.(map[string]*model.User)
		usernames = make([]string, len(profileUsers))
		i := 0
		for _, userprof := range profileUsers {
			usernames[i] = userprof.Username
			i++
		}
	}

	client := model.NewClient(c.GetSiteURL())
	client.MockSession(c.Session.Token)
	testPoster := NewAutoPostCreator(client, channelId)
	testPoster.Fuzzy = doFuzz
	testPoster.Users = usernames

	numImages := utils.RandIntFromRange(rimages)
	numPosts := utils.RandIntFromRange(postsr)
	for i := 0; i < numPosts; i++ {
		testPoster.HasImage = (i < numImages)
		testPoster.CreateRandomPost()
	}

	return &model.CommandResponse{Text: "Adding posts...", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
}

func (me *LoadTestProvider) UrlCommand(c *Context, channelId string, message string) *model.CommandResponse {
	url := strings.TrimSpace(strings.TrimPrefix(message, "url"))
	if len(url) == 0 {
		return &model.CommandResponse{Text: "Command must contain a url", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
	}

	// provide a shortcut to easily access tests stored in doc/developer/tests
	if !strings.HasPrefix(url, "http") {
		url = "https://raw.githubusercontent.com/mattermost/platform/master/doc/developer/tests/" + url

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
		post.ChannelId = channelId

		if _, err := CreatePost(c, post, false); err != nil {
			return &model.CommandResponse{Text: "Unable to create post", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
		}
	}

	return &model.CommandResponse{Text: "Loading url...", ResponseType: model.COMMAND_RESPONSE_TYPE_EPHEMERAL}
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
			return utils.Range{0, 0}, false
		}
	case len(tokens) >= 2:
		begin, err1 = strconv.Atoi(tokens[0])
		end, err2 = strconv.Atoi(tokens[1])
		if err1 != nil || err2 != nil {
			return utils.Range{0, 0}, false
		}
	default:
		return utils.Range{0, 0}, false
	}
	return utils.Range{begin, end}, true
}

func contains(items []string, token string) bool {
	for _, elem := range items {
		if elem == token {
			return true
		}
	}
	return false
}
