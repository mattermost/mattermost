// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package manualtesting

import (
	"hash/fnv"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/api"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

type TestEnvironment struct {
	Params        map[string][]string
	Client        *model.Client
	CreatedTeamId string
	CreatedUserId string
	Context       *api.Context
	Writer        http.ResponseWriter
	Request       *http.Request
}

func InitManualTesting() {
	app.Srv.Router.Handle("/manualtest", api.AppHandler(manualTest)).Methods("GET")
}

func manualTest(c *api.Context, w http.ResponseWriter, r *http.Request) {
	// Let the world know
	l4g.Info(utils.T("manaultesting.manual_test.setup.info"))

	// URL Parameters
	params, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		c.Err = model.NewLocAppError("/manual", "manaultesting.manual_test.parse.app_error", nil, "")
		return
	}

	// Grab a uuid (if available) to seed the random number generator so we don't get conflicts.
	uid, ok := params["uid"]
	if ok {
		hasher := fnv.New32a()
		hasher.Write([]byte(uid[0] + strconv.Itoa(int(time.Now().UTC().UnixNano()))))
		hash := hasher.Sum32()
		rand.Seed(int64(hash))
	} else {
		l4g.Debug(utils.T("manaultesting.manual_test.uid.debug"))
	}

	// Create a client for tests to use
	client := model.NewClient("http://localhost" + utils.Cfg.ServiceSettings.ListenAddress)

	// Check for username parameter and create a user if present
	username, ok1 := params["username"]
	teamDisplayName, ok2 := params["teamname"]
	var teamID string
	var userID string
	if ok1 && ok2 {
		l4g.Info(utils.T("manaultesting.manual_test.create.info"))
		// Create team for testing
		team := &model.Team{
			DisplayName: teamDisplayName[0],
			Name:        utils.RandomName(utils.Range{Begin: 20, End: 20}, utils.LOWERCASE),
			Email:       "success+" + model.NewId() + "simulator.amazonses.com",
			Type:        model.TEAM_OPEN,
		}

		if result := <-app.Srv.Store.Team().Save(team); result.Err != nil {
			c.Err = result.Err
			return
		} else {

			createdTeam := result.Data.(*model.Team)

			channel := &model.Channel{DisplayName: "Town Square", Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: createdTeam.Id}
			if _, err := app.CreateChannel(channel, false); err != nil {
				c.Err = err
				return
			}

			teamID = createdTeam.Id
		}

		// Create user for testing
		user := &model.User{
			Email:    "success+" + model.NewId() + "simulator.amazonses.com",
			Nickname: username[0],
			Password: app.USER_PASSWORD}

		result, err := client.CreateUser(user, "")
		if err != nil {
			c.Err = err
			return
		}

		<-app.Srv.Store.User().VerifyEmail(result.Data.(*model.User).Id)
		<-app.Srv.Store.Team().SaveMember(&model.TeamMember{TeamId: teamID, UserId: result.Data.(*model.User).Id})

		newuser := result.Data.(*model.User)
		userID = newuser.Id

		// Login as user to generate auth token
		_, err = client.LoginById(newuser.Id, app.USER_PASSWORD)
		if err != nil {
			c.Err = err
			return
		}

		// Respond with an auth token this can be overriden by a specific test as required
		sessionCookie := &http.Cookie{
			Name:     model.SESSION_COOKIE_TOKEN,
			Value:    client.AuthToken,
			Path:     "/",
			MaxAge:   *utils.Cfg.ServiceSettings.SessionLengthWebInDays * 60 * 60 * 24,
			HttpOnly: true,
		}
		http.SetCookie(w, sessionCookie)
		http.Redirect(w, r, "/channels/town-square", http.StatusTemporaryRedirect)
	}

	// Setup test environment
	env := TestEnvironment{
		Params:        params,
		Client:        client,
		CreatedTeamId: teamID,
		CreatedUserId: userID,
		Context:       c,
		Writer:        w,
		Request:       r,
	}

	// Grab the test ID and pick the test
	testname, ok := params["test"]
	var err2 *model.AppError
	switch testname[0] {
	case "autolink":
		err2 = testAutoLink(env)
		// ADD YOUR NEW TEST HERE!
	case "general":
		err2 = nil
	}

	if err != nil {
		c.Err = err2
		return
	}
}

func getChannelID(channelname string, teamid string, userid string) (id string, err bool) {
	// Grab all the channels
	result := <-app.Srv.Store.Channel().GetChannels(teamid, userid)
	if result.Err != nil {
		l4g.Debug(utils.T("manaultesting.get_channel_id.unable.debug"))
		return "", false
	}

	data := result.Data.(model.ChannelList)

	for _, channel := range data {
		if channel.Name == channelname {
			return channel.Id, true
		}
	}
	l4g.Debug(utils.T("manaultesting.get_channel_id.no_found.debug"), channelname, strconv.Itoa(len(data)))
	return "", false
}
