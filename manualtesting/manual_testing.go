// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package manualtesting

import (
	"fmt"
	"hash/fnv"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/api4"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/web"
)

type TestEnvironment struct {
	Params        map[string][]string
	Client        *model.Client4
	CreatedTeamId string
	CreatedUserId string
	Context       *web.Context
	Writer        http.ResponseWriter
	Request       *http.Request
}

func Init(api4 *api4.API) {
	api4.BaseRoutes.Root.Handle("/manualtest", api4.ApiHandler(manualTest)).Methods("GET")
}

func manualTest(c *web.Context, w http.ResponseWriter, r *http.Request) {
	// Let the world know
	mlog.Info("Setting up for manual test...")

	// URL Parameters
	params, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		c.Err = model.NewAppError("/manual", "manaultesting.manual_test.parse.app_error", nil, "", http.StatusBadRequest)
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
		mlog.Debug("No uid in URL")
	}

	// Create a client for tests to use
	client := model.NewAPIv4Client("http://localhost" + *c.App.Config().ServiceSettings.ListenAddress)

	// Check for username parameter and create a user if present
	username, ok1 := params["username"]
	teamDisplayName, ok2 := params["teamname"]
	var teamID string
	var userID string
	if ok1 && ok2 {
		mlog.Info("Creating user and team")
		// Create team for testing
		team := &model.Team{
			DisplayName: teamDisplayName[0],
			Name:        utils.RandomName(utils.Range{Begin: 20, End: 20}, utils.LOWERCASE),
			Email:       "success+" + model.NewId() + "simulator.amazonses.com",
			Type:        model.TEAM_OPEN,
		}

		if result := <-c.App.Srv.Store.Team().Save(team); result.Err != nil {
			c.Err = result.Err
			return
		} else {

			createdTeam := result.Data.(*model.Team)

			channel := &model.Channel{DisplayName: "Town Square", Name: "town-square", Type: model.CHANNEL_OPEN, TeamId: createdTeam.Id}
			if _, err := c.App.CreateChannel(channel, false); err != nil {
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

		user, resp := client.CreateUser(user)
		if resp.Error != nil {
			c.Err = resp.Error
			return
		}

		<-c.App.Srv.Store.User().VerifyEmail(user.Id)
		<-c.App.Srv.Store.Team().SaveMember(&model.TeamMember{TeamId: teamID, UserId: user.Id}, *c.App.Config().TeamSettings.MaxUsersPerTeam)

		userID = user.Id

		// Login as user to generate auth token
		_, resp = client.LoginById(user.Id, app.USER_PASSWORD)
		if resp.Error != nil {
			c.Err = resp.Error
			return
		}

		// Respond with an auth token this can be overridden by a specific test as required
		sessionCookie := &http.Cookie{
			Name:     model.SESSION_COOKIE_TOKEN,
			Value:    client.AuthToken,
			Path:     "/",
			MaxAge:   *c.App.Config().ServiceSettings.SessionLengthWebInDays * 60 * 60 * 24,
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
	if !ok {
		c.Err = model.NewAppError("/manual", "manaultesting.manual_test.parse.app_error", nil, "", http.StatusBadRequest)
		return
	}

	switch testname[0] {
	case "autolink":
		c.Err = testAutoLink(env)
		// ADD YOUR NEW TEST HERE!
	case "general":
	}
}

func getChannelID(a *app.App, channelname string, teamid string, userid string) (id string, err bool) {
	// Grab all the channels
	result := <-a.Srv.Store.Channel().GetChannels(teamid, userid, false)
	if result.Err != nil {
		mlog.Debug("Unable to get channels")
		return "", false
	}

	data := result.Data.(model.ChannelList)

	for _, channel := range data {
		if channel.Name == channelname {
			return channel.Id, true
		}
	}
	mlog.Debug(fmt.Sprintf("Could not find channel: %v, %v possibilities searched", channelname, strconv.Itoa(len(data))))
	return "", false
}
