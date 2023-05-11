// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package manualtesting

import (
	"errors"
	"hash/fnv"
	"math/rand"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/channels/api4"
	"github.com/mattermost/mattermost-server/server/v8/channels/app"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/slashcommands"
	"github.com/mattermost/mattermost-server/server/v8/channels/store"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	"github.com/mattermost/mattermost-server/server/v8/channels/web"
)

// TestEnvironment is a helper struct used for tests in manualtesting.
type TestEnvironment struct {
	Params        map[string][]string
	Client        *model.Client4
	CreatedTeamID string
	CreatedUserID string
	Context       *web.Context
	Writer        http.ResponseWriter
	Request       *http.Request
}

// Init adds manualtest endpoint to the API.
func Init(api4 *api4.API) {
	api4.BaseRoutes.Root.Handle("/manualtest", api4.APIHandler(manualTest)).Methods("GET")
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
			Name:        "zz" + utils.RandomName(utils.Range{Begin: 20, End: 20}, utils.LOWERCASE),
			Email:       "success+" + model.NewId() + "simulator.amazonses.com",
			Type:        model.TeamOpen,
		}

		createdTeam, err := c.App.Srv().Store().Team().Save(team)
		if err != nil {
			var invErr *store.ErrInvalidInput
			var appErr *model.AppError
			switch {
			case errors.As(err, &invErr):
				c.Err = model.NewAppError("manualTest", "app.team.save.existing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
			case errors.As(err, &appErr):
				c.Err = appErr
			default:
				c.Err = model.NewAppError("manualTest", "app.team.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return
		}

		channel := &model.Channel{DisplayName: "Town Square", Name: "town-square", Type: model.ChannelTypeOpen, TeamId: createdTeam.Id}
		if _, err := c.App.CreateChannel(c.AppContext, channel, false); err != nil {
			c.Err = err
			return
		}

		teamID = createdTeam.Id

		// Create user for testing
		user := &model.User{
			Email:    "success+" + model.NewId() + "simulator.amazonses.com",
			Nickname: username[0],
			Password: slashcommands.UserPassword}

		user, _, err = client.CreateUser(user)
		if err != nil {
			var appErr *model.AppError
			ok = errors.As(err, &appErr)
			if ok {
				c.Err = appErr
			} else {
				c.Err = model.NewAppError("manualTest", "app.user.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			return
		}

		c.App.Srv().Store().User().VerifyEmail(user.Id, user.Email)
		c.App.Srv().Store().Team().SaveMember(&model.TeamMember{TeamId: teamID, UserId: user.Id}, *c.App.Config().TeamSettings.MaxUsersPerTeam)

		userID = user.Id

		// Login as user to generate auth token
		_, _, err = client.LoginById(user.Id, slashcommands.UserPassword)
		if err != nil {
			var appErr *model.AppError
			ok = errors.As(err, &appErr)
			if ok {
				c.Err = appErr
			} else {
				c.Err = model.NewAppError("manualTest", "api.user.login.bot_login_forbidden.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return
		}

		// Respond with an auth token this can be overridden by a specific test as required
		sessionCookie := &http.Cookie{
			Name:     model.SessionCookieToken,
			Value:    client.AuthToken,
			Path:     "/",
			MaxAge:   *c.App.Config().ServiceSettings.SessionLengthWebInHours * 60 * 60,
			HttpOnly: true,
		}
		http.SetCookie(w, sessionCookie)
		http.Redirect(w, r, "/channels/town-square", http.StatusTemporaryRedirect)
	}

	// Setup test environment
	env := TestEnvironment{
		Params:        params,
		Client:        client,
		CreatedTeamID: teamID,
		CreatedUserID: userID,
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

func getChannelID(a app.AppIface, channelname string, teamid string, userid string) (string, bool) {
	// Grab all the channels
	channels, err := a.Srv().Store().Channel().GetChannels(teamid, userid, &model.ChannelSearchOpts{
		IncludeDeleted: false,
		LastDeleteAt:   0,
	})
	if err != nil {
		mlog.Debug("Unable to get channels")
		return "", false
	}

	for _, channel := range channels {
		if channel.Name == channelname {
			return channel.Id, true
		}
	}
	mlog.Debug("Could not find channel", mlog.String("Channel name", channelname), mlog.Int("Possibilities searched", len(channels)))
	return "", false
}
