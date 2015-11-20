// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	l4g "code.google.com/p/log4go"
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
	commandNotImplementedErr = model.NewAppError("checkCommand", "Command not implemented", "")
)
var echoSem chan bool

func InitCommand(r *mux.Router) {
	l4g.Debug("Initializing command api routes")
	r.Handle("/command", ApiUserRequired(command)).Methods("POST")
}

func command(c *Context, w http.ResponseWriter, r *http.Request) {

	props := model.MapFromJson(r.Body)

	command := &model.Command{
		Command:     strings.TrimSpace(props["command"]),
		ChannelId:   strings.TrimSpace(props["channelId"]),
		Suggest:     props["suggest"] == "true",
		FromWebhook: props["fromWebhook"] == "true",
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

	if command.FromWebhook {
		return suggestFromWebHooks(c, command)
	}

	if len(command.Command) == 0 || strings.Index(command.Command, "/") != 0 {
		c.Err = model.NewAppError("checkCommand", "Command must start with /", "")
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
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Logout"})

		if !command.Suggest {
			command.GotoLocation = "/logout"
			command.Response = model.RESP_EXECUTED
			return true
		}

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Logout"})
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
			c.Err = model.NewAppError("echoCommand", "Delays must be under 10000 seconds", "")
			return false
		}

		if echoSem == nil {
			// We want one additional thread allowed so we never reach channel lockup
			echoSem = make(chan bool, maxThreads+1)
		}

		if len(echoSem) >= maxThreads {
			c.Err = model.NewAppError("echoCommand", "High volume of echo request, cannot process request", "")
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
				l4g.Error("Unable to create /echo post, err=%v", err)
			}
		}()

		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Echo back text from your account, /echo \"message\" [delay in seconds]"})
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
			l4g.Error("Unable to create /me post post, err=%v", err)
			return false
		}
		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Do an action, /me [message]"})
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
			l4g.Error("Unable to create /shrug post post, err=%v", err)
			return false
		}
		command.Response = model.RESP_EXECUTED
		return true

	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Adds ¯\\_(ツ)_/¯ to your message, /shrug [message]"})
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
					command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd + " " + v.Name, Description: "Join the open channel"})
				}
			}
		}
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Join an open channel"})
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
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd, Description: "Debug Load Testing"})
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
				l4g.Error("Failed to create testing environment")
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
				l4g.Error("Failed to create testing environment")
				return true
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
		return true
	} else if strings.Index(cmd, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{
			Suggestion:  cmd,
			Description: "Creates a testing environment in current team. [teams] [fuzz] <Num Channels> <Num Users> <NumPosts>"})
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
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: "Add a specified number of random users to current team <Min Users> <Max Users>"})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add a specified number of random users with fuzz text to current team <Min Users> <Max Users>"})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add a specified number of random users with fuzz text to current team <Min Users> <Max Users>"})
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
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: "Add a specified number of random channels to current team <MinChannels> <MaxChannels>"})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add a specified number of random channels with fuzz text to current team <Min Channels> <Max Channels>"})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add a specified number of random channels with fuzz text to current team <Min Channels> <Max Channels>"})
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
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd1, Description: "Add some random posts to current channel <Min Posts> <Max Posts> <Min Images> <Max Images>"})
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add some random posts with fuzz text to current channel <Min Posts> <Max Posts> <Min Images> <Max Images>"})
	} else if strings.Index(cmd2, command.Command) == 0 {
		command.AddSuggestion(&model.SuggestCommand{Suggestion: cmd2, Description: "Add some random posts with fuzz text to current channel <Min Posts> <Max Posts> <Min Images> <Max Images>"})
	}

	return false
}

func suggestFromWebHooks(c *Context, command *model.Command) bool {
	if result := <-Srv.Store.User().Get(c.Session.UserId); result.Err != nil {
		return false
	} else {
		var user = result.Data.(*model.User)

		hchan := Srv.Store.Webhook().GetOutgoingByTeam(c.Session.TeamId)
		tchan := Srv.Store.Team().Get(c.Session.TeamId)
		cchan := Srv.Store.Channel().Get(command.ChannelId)

		var team *model.Team
		if result := <-tchan; result.Err != nil {
			l4g.Error("Encountered error getting team, team_id=%s, err=%v", c.Session.TeamId, result.Err)
			return false
		} else {
			team = result.Data.(*model.Team)
		}

		var channel *model.Channel
		if result := <-cchan; result.Err != nil {
			l4g.Error("Encountered error getting channel, channel_id=%s, err=%v", command.ChannelId, result.Err)
			return false
		} else {
			channel = result.Data.(*model.Channel)
		}

		hooks := []*model.OutgoingWebhook{}

		if result := <-hchan; result.Err != nil {
			l4g.Error("Encountered error getting webhooks by team, err=%v", result.Err)
			return false
		} else {
			hooks = result.Data.([]*model.OutgoingWebhook)
		}

		if len(hooks) == 0 {
			return false
		}

		var trigger = ""
		relevantHooks := []*model.OutgoingWebhook{}

		for _, hook := range hooks {
			matchingTrigger := hook.FindTrigger(command.Command)
			if hook.ChannelId == command.ChannelId {
				if len(hook.TriggerWords) == 0 || matchingTrigger != "" {
					relevantHooks = append(relevantHooks, hook)
					trigger = matchingTrigger
				}
			} else if len(hook.ChannelId) == 0 && matchingTrigger != "" {
				relevantHooks = append(relevantHooks, hook)
				trigger = matchingTrigger
			}
		}

		if len(relevantHooks) == 0 {
			return false
		}

		done := make(chan bool)
		var hooksCalled uint64 = 0
		var hooksToCall uint64 = uint64(len(relevantHooks))
		for _, hook := range relevantHooks {
			go func(hook *model.OutgoingWebhook) {
				p := url.Values{}
				p.Set("token", hook.Token)

				p.Set("team_id", hook.TeamId)
				p.Set("team_domain", team.Name)

				p.Set("channel_id", command.ChannelId)
				p.Set("channel_name", channel.Name)

				p.Set("user_id", user.Id)
				p.Set("user_name", user.Username)

				p.Set("text", command.Command)
				p.Set("trigger_word", trigger)
				p.Set("suggest", "true")

				client := &http.Client{}

				for _, url := range hook.CallbackURLs {
					go func(url string) {
						req, _ := http.NewRequest("POST", url, strings.NewReader(p.Encode()))
						req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
						req.Header.Set("Accept", "application/json")
						if resp, err := client.Do(req); err != nil {
							atomic.AddUint64(&hooksCalled, 1)
							if hooksCalled == hooksToCall {
								done <- true
							}
							l4g.Error("Event POST failed, err=%s", err.Error())
						} else {
							webhookSuggestions := model.WebhookSuggestionsFromJson(resp.Body)
							if webhookSuggestions != nil {
								for _, suggestion := range webhookSuggestions.Suggestions {
									if suggestion != nil {
										command.AddSuggestion(suggestion)
									}
								}
							} else {
								l4g.Error("Invalid POST response, res=%s", resp.Body)
							}
							atomic.AddUint64(&hooksCalled, 1)
							if hooksCalled == hooksToCall {
								done <- true
							}
						}
					}(url)
				}

			}(hook)
		}
		<-done
		return true
	}
}
