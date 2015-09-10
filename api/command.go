// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type commandHandler func(c *Context, command *model.Command) bool

var commands = []commandHandler{
	logoutCommand,
	joinCommand,
	loadTestCommand,
	echoCommand,
}

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
		Suggestions: make([]*model.SuggestCommand, 0, 128),
	}

	checkCommand(c, command)
	if c.Err != nil {
		return
	} else {
		w.Write([]byte(command.ToJson()))
	}
}

func checkCommand(c *Context, command *model.Command) bool {

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

	for _, v := range commands {

		if v(c, command) || c.Err != nil {
			return true
		}
	}

	return false
}

func logoutCommand(c *Context, command *model.Command) bool {

	cmd := "/logout"

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
	cmd := "/echo"
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

			if _, err := CreatePost(c, post, false); err != nil {
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

func joinCommand(c *Context, command *model.Command) bool {

	// looks for "/join channel-name"
	cmd := "/join"

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

					command.GotoLocation = "/channels/" + v.Name
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
	cmd := "/loadtest"

	// This command is only available when AllowTesting is true
	if !utils.Cfg.ServiceSettings.AllowTesting {
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
	cmd := "/loadtest setup"

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
		client := model.NewClient(c.GetSiteURL(), c.GetSiteURL()+"/api/v1")

		if doTeams {
			if err := CreateBasicUser(client); err != nil {
				l4g.Error("Failed to create testing enviroment")
				return true
			}
			client.LoginByEmail(BTEST_TEAM_NAME, BTEST_USER_EMAIL, BTEST_USER_PASSWORD)
			enviroment, err := CreateTestEnviromentWithTeams(
				client,
				utils.Range{numTeams, numTeams},
				utils.Range{numChannels, numChannels},
				utils.Range{numUsers, numUsers},
				utils.Range{numPosts, numPosts},
				doFuzz)
			if err != true {
				l4g.Error("Failed to create testing enviroment")
				return true
			} else {
				l4g.Info("Testing enviroment created")
				for i := 0; i < len(enviroment.Teams); i++ {
					l4g.Info("Team Created: " + enviroment.Teams[i].Name)
					l4g.Info("\t User to login: " + enviroment.Enviroments[i].Users[0].Email + ", " + USER_PASSWORD)
				}
			}
		} else {
			client.MockSession(c.Session.Id)
			CreateTestEnviromentInTeam(
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
			Description: "Creates a testing enviroment in current team. [teams] [fuzz] <Num Channels> <Num Users> <NumPosts>"})
	}

	return false
}

func loadTestUsersCommand(c *Context, command *model.Command) bool {
	cmd1 := "/loadtest users"
	cmd2 := "/loadtest users fuzz"

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
		client := model.NewClient(c.GetSiteURL(), c.GetSiteURL()+"/api/v1")
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
	cmd1 := "/loadtest channels"
	cmd2 := "/loadtest channels fuzz"

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
		client := model.NewClient(c.GetSiteURL(), c.GetSiteURL()+"/api/v1")
		client.MockSession(c.Session.Id)
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
	cmd1 := "/loadtest posts"
	cmd2 := "/loadtest posts fuzz"

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

		client := model.NewClient(c.GetSiteURL(), c.GetSiteURL()+"/api/v1")
		client.MockSession(c.Session.Id)
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
