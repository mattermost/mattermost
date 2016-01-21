// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type commandHandler func(c *Context, command *model.Command) bool

var (
	cmds = map[string]string{
		"logoutCommand":   "/logout",
		"joinCommand":     "/join",
		"loadTestCommand": "/loadtest",
		"echoCommand":     "/echo",
		"shrugCommand":    "/shrug",
		"meCommand":       "/me",
	}
	commands = []commandHandler{
		logoutCommand,
		joinCommand,
		loadTestCommand,
		echoCommand,
		shrugCommand,
		meCommand,
	}
	commandNotImplementedErr = model.NewLocAppError("checkCommand", "api.command.no_implemented.app_error", nil, "")
)
var echoSem chan bool

func InitCommand(r *mux.Router) {
	l4g.Debug(utils.T("api.command.init.debug"))
	r.Handle("/command", ApiUserRequired(command)).Methods("POST")
}

func command(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)

	command := &model.Command{
		Command:     strings.TrimSpace(props["command"]),
		ChannelId:   strings.TrimSpace(props["channelId"]),
		Suggest:     props["suggest"] == "true",
		Suggestions: make([]*model.SuggestCommand, 0, 128),
	}

	checkCommand(c, command)
	if c.Err != nil {
		if c.Err != commandNotImplementedErr {
			return
		} else {
			c.Err = nil
			command.Response = model.RESP_NOT_IMPLEMENTED
			w.Write([]byte(command.ToJson()))
			return
		}
	} else {
		w.Write([]byte(command.ToJson()))
	}
}

func checkCommand(c *Context, command *model.Command) bool {

	if len(command.Command) == 0 || strings.Index(command.Command, "/") != 0 {
		c.Err = model.NewLocAppError("checkCommand", "api.command.check_command.start.app_error", nil, "")
		return false
	}

	if len(command.ChannelId) > 0 {
		cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, command.ChannelId, c.Session.UserId)

		if !c.HasPermissionsToChannel(cchan, "checkCommand") {
			return true
		}
	}

	if !command.Suggest {
		implemented := false
		for _, cmd := range cmds {
			bounds := len(cmd)
			if len(command.Command) < bounds {
				continue
			}
			if command.Command[:bounds] == cmd {
				implemented = true
			}
		}
		if !implemented {
			c.Err = commandNotImplementedErr
			return false
		}
	}

	for _, v := range commands {

		if v(c, command) || c.Err != nil {
			return true
		}
	}

	return false
}

func logoutCommand(c *Context, command *model.Command) bool {

	cmd := cmds["logoutCommand"]

	if strings.Index(command.Command, cmd) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.logout_command.description")})

		if !command.Suggest {
			command.GotoLocation = "/logout"
			command.Response = model.RESP_EXECUTED
			return true
		}

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.logout_command.description")})
	}

	return false
}

func echoCommand(c *Context, command *model.Command) bool {
	cmd := cmds["echoCommand"]
	maxThreads := 100

	if !command.Suggest && strings.Index(command.Command, cmd) == 0 {
		parameters := strings.SplitN(command.Command, " ", 2)
		if len(parameters) != 2 || len(parameters[1]) == 0 {
			return false
		}
		message := strings.Trim(parameters[1], " ")
		delay := 0
		if endMsg := strings.LastIndex(message, "\""); string(message[0]) == "\"" && endMsg > 1 {
			if checkDelay, err := strconv.Atoi(strings.Trim(message[endMsg:], " \"")); err == nil {
				delay = checkDelay
			}
			message = message[1:endMsg]
		} else if strings.Index(message, " ") > -1 {
			delayIdx := strings.LastIndex(message, " ")
			delayStr := strings.Trim(message[delayIdx:], " ")

			if checkDelay, err := strconv.Atoi(delayStr); err == nil {
				delay = checkDelay
				message = message[:delayIdx]
			}
		}

		if delay > 10000 {
			c.Err = model.NewLocAppError("echoCommand", "api.command.echo_command.under.app_error", nil, "")
			return false
		}

		if echoSem == nil {
			// We want one additional thread allowed so we never reach channel lockup
			echoSem = make(chan bool, maxThreads+1)
		}

		if len(echoSem) >= maxThreads {
			c.Err = model.NewLocAppError("echoCommand", "api.command.echo_command.high_volume.app_error", nil, "")
			return false
		}

		echoSem <- true
		go func() {
			defer func() { <-echoSem }()
			post := &model.Post{}
			post.ChannelId = command.ChannelId
			post.Message = message

			time.Sleep(time.Duration(delay) * time.Second)

			if _, err := CreatePost(c, post, true); err != nil {
				l4g.Error(utils.T("api.command.echo_command.create.error"), err)
			}
		}()

		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.echo_command.description")})
	}

	return false
}

func meCommand(c *Context, command *model.Command) bool {
	cmd := cmds["meCommand"]

	if !command.Suggest && strings.Index(command.Command, cmd) == 0 {
		message := ""

		parameters := strings.SplitN(command.Command, " ", 2)
		if len(parameters) > 1 {
			message += "*" + parameters[1] + "*"
		}

		post := &model.Post{}
		post.Message = message
		post.ChannelId = command.ChannelId
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error(utils.T("api.command.me_command.create.error"), err)
			return false
		}
		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.me_command.description")})
	}

	return false
}

func shrugCommand(c *Context, command *model.Command) bool {
	cmd := cmds["shrugCommand"]

	if !command.Suggest && strings.Index(command.Command, cmd) == 0 {
		message := `¯\\\_(ツ)_/¯`

		parameters := strings.SplitN(command.Command, " ", 2)
		if len(parameters) > 1 {
			message += " " + parameters[1]
		}

		post := &model.Post{}
		post.Message = message
		post.ChannelId = command.ChannelId
		if _, err := CreatePost(c, post, false); err != nil {
			l4g.Error(utils.T("api.command.shrug_command.create.error"), err)
			return false
		}
		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.shrug_command.description")})
	}

	return false
}

func joinCommand(c *Context, command *model.Command) bool {

	// looks for "/join channel-name"
	cmd := cmds["joinCommand"]

	if strings.Index(command.Command, cmd) == 0 {

		parts := strings.Split(command.Command, " ")

		startsWith := ""

		if len(parts) == 2 {
			startsWith = parts[1]
		}

		if result := <-Srv.Store.Channel().GetMoreChannels(c.Session.TeamId, c.Session.UserId); result.Err != nil {
			c.Err = result.Err
			return false
		} else {
			channels := result.Data.(*model.ChannelList)

			for _, v := range channels.Channels {

				if v.Name == startsWith && !command.Suggest {

					if v.Type == model.CHANNEL_DIRECT {
						return false
					}

					JoinChannel(c, v.Id, "")

					if c.Err != nil {
						return false
					}

					command.GotoLocation = c.GetTeamURL() + "/channels/" + v.Name
					command.Response = model.RESP_EXECUTED
					return true
				}

				if len(startsWith) == 0 || strings.Index(v.Name, startsWith) == 0 {
					command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd + " " + v.Name, Description: c.T("api.commmand.join_command.description")})
				}
			}
		}
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.commmand.join_command.description")})
	}

	return false
}

func loadTestCommand(c *Context, command *model.Command) bool {
	cmd := cmds["loadTestCommand"]

	// This command is only available when EnableTesting is true
	if !utils.Cfg.ServiceSettings.EnableTesting {
		return false
	}

	if strings.Index(command.Command, cmd) == 0 {
		if loadTestSetupCommand(c, command) {
			return true
		}
		if loadTestUsersCommand(c, command) {
			return true
		}
		if loadTestChannelsCommand(c, command) {
			return true
		}
		if loadTestPostsCommand(c, command) {
			return true
		}
		if loadTestUrlCommand(c, command) {
			return true
		}
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.load_test_command.description")})
	}

	return false
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

func loadTestSetupCommand(c *Context, command *model.Command) bool {
	cmd := cmds["loadTestCommand"] + " setup"

	if strings.Index(command.Command, cmd) == 0 && !command.Suggest {
		tokens := strings.Fields(strings.TrimPrefix(command.Command, cmd))
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
				l4g.Error(utils.T("api.command.load_test_setup_command.create.error"))
				return true
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
				l4g.Error(utils.T("api.command.load_test_setup_command.create.error"))
				return true
			} else {
				l4g.Info("Testing environment created")
				for i := 0; i < len(environment.Teams); i++ {
					l4g.Info(utils.T("api.command.load_test_setup_command.created.info"), environment.Teams[i].Name)
					l4g.Info(utils.T("api.command.load_test_setup_command.login.info"), environment.Environments[i].Users[0].Email, USER_PASSWORD)
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
		return true
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{
			Suggestion:  cmd,
			Description: c.T("api.command.load_test_setup_command.description")})
	}

	return false
}

func loadTestUsersCommand(c *Context, command *model.Command) bool {
	cmd1 := cmds["loadTestCommand"] + " users"
	cmd2 := cmds["loadTestCommand"] + " users fuzz"

	if strings.Index(command.Command, cmd1) == 0 && !command.Suggest {
		cmd := cmd1
		doFuzz := false
		if strings.Index(command.Command, cmd2) == 0 {
			doFuzz = true
			cmd = cmd2
		}
		usersr, err := parseRange(command.Command, cmd)
		if err == false {
			usersr = utils.Range{10, 15}
		}
		client := model.NewClient(c.GetSiteURL())
		userCreator := NewAutoUserCreator(client, c.Session.TeamId)
		userCreator.Fuzzy = doFuzz
		userCreator.CreateTestUsers(usersr)
		return true
	} else if strings.Index(cmd1, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: c.T("api.command.load_test_users_command.users.description")})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_users_command.fuzz.description")})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_users_command.fuzz.description")})
	}

	return false
}

func loadTestChannelsCommand(c *Context, command *model.Command) bool {
	cmd1 := cmds["loadTestCommand"] + " channels"
	cmd2 := cmds["loadTestCommand"] + " channels fuzz"

	if strings.Index(command.Command, cmd1) == 0 && !command.Suggest {
		cmd := cmd1
		doFuzz := false
		if strings.Index(command.Command, cmd2) == 0 {
			doFuzz = true
			cmd = cmd2
		}
		channelsr, err := parseRange(command.Command, cmd)
		if err == false {
			channelsr = utils.Range{20, 30}
		}
		client := model.NewClient(c.GetSiteURL())
		client.MockSession(c.Session.Token)
		channelCreator := NewAutoChannelCreator(client, c.Session.TeamId)
		channelCreator.Fuzzy = doFuzz
		channelCreator.CreateTestChannels(channelsr)
		return true
	} else if strings.Index(cmd1, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: c.T("api.command.load_test_channels_command.channel.description")})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_channels_command.fuzz.description")})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_channels_command.fuzz.description")})
	}

	return false
}

func loadTestPostsCommand(c *Context, command *model.Command) bool {
	cmd1 := cmds["loadTestCommand"] + " posts"
	cmd2 := cmds["loadTestCommand"] + " posts fuzz"

	if strings.Index(command.Command, cmd1) == 0 && !command.Suggest {
		cmd := cmd1
		doFuzz := false
		if strings.Index(command.Command, cmd2) == 0 {
			cmd = cmd2
			doFuzz = true
		}

		postsr, err := parseRange(command.Command, cmd)
		if err == false {
			postsr = utils.Range{20, 30}
		}

		tokens := strings.Fields(strings.TrimPrefix(command.Command, cmd))
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
		testPoster := NewAutoPostCreator(client, command.ChannelId)
		testPoster.Fuzzy = doFuzz
		testPoster.Users = usernames

		numImages := utils.RandIntFromRange(rimages)
		numPosts := utils.RandIntFromRange(postsr)
		for i := 0; i < numPosts; i++ {
			testPoster.HasImage = (i < numImages)
			testPoster.CreateRandomPost()
		}
		return true
	} else if strings.Index(cmd1, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: c.T("api.command.load_test_posts_command.posts.description")})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_posts_command.fuzz.description")})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: c.T("api.command.load_test_posts_command.fuzz.description")})
	}

	return false
}

func loadTestUrlCommand(c *Context, command *model.Command) bool {
	cmd := cmds["loadTestCommand"] + " url"

	if strings.Index(command.Command, cmd) == 0 && !command.Suggest {
		url := ""

		parameters := strings.SplitN(command.Command, " ", 3)
		if len(parameters) != 3 {
			c.Err = model.NewLocAppError("loadTestUrlCommand", "api.command.load_test_url_command.url.app_error", nil, "")
			return true
		} else {
			url = parameters[2]
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
			c.Err = model.NewLocAppError("loadTestUrlCommand", "api.command.load_test_url_command.file.app_error", nil, err.Error())
			return false
		} else if r.StatusCode > 400 {
			c.Err = model.NewLocAppError("loadTestUrlCommand", "api.command.load_test_url_command.file.app_error", nil, r.Status)
			return false
		} else {
			contents = r.Body
		}

		bytes := make([]byte, 4000)

		// break contents into 4000 byte posts
		for {
			length, err := contents.Read(bytes)
			if err != nil && err != io.EOF {
				c.Err = model.NewLocAppError("loadTestUrlCommand", "api.command.load_test_url_command.reading.app_error", nil, err.Error())
				return false
			}

			if length == 0 {
				break
			}

			post := &model.Post{}
			post.Message = string(bytes[:length])
			post.ChannelId = command.ChannelId

			if _, err := CreatePost(c, post, false); err != nil {
				l4g.Error(utils.T("api.command.load_test_url_command.create.error"), err)
				return false
			}
		}

		command.Response = model.RESP_EXECUTED

		return true
	} else if strings.Index(cmd, command.Command) == 0 && strings.Index(command.Command, "/loadtest posts") != 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: c.T("api.command.load_test_url_command.description")})
	}

	return false
}
