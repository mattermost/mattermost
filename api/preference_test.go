// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"testing"
)

func TestGetAllPreferences(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	category := model.NewId()

	preferences1 := model.Preferences{
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	Client.LoginByEmail(team.Name, user1.Email, "pwd")
	Client.Must(Client.SetPreferences(&preferences1))

	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 4 {
		t.Fatal("received the wrong number of preferences")
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	// note that user2 will automatically have a preference set for them to show user1 for direct messages
	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("received the wrong number of preferences")
	}
}

func TestSetPreferences(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	// save 10 preferences
	var preferences model.Preferences
	for i := 0; i < 10; i++ {
		preference := model.Preference{
			UserId:   user1.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
		}
		preferences = append(preferences, preference)
	}

	if _, err := Client.SetPreferences(&preferences); err != nil {
		t.Fatal(err)
	}

	// update 10 preferences
	for _, preference := range preferences {
		preference.Value = "1234garbage"
	}

	if _, err := Client.SetPreferences(&preferences); err != nil {
		t.Fatal(err)
	}

	// not able to update as a different user
	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if _, err := Client.SetPreferences(&preferences); err == nil {
		t.Fatal("shouldn't have been able to update another user's preferences")
	}
}

func TestGetPreferenceCategory(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user1 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user1 = Client.Must(Client.CreateUser(user1, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user1.Id))

	user2 := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user2 = Client.Must(Client.CreateUser(user2, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user2.Id))

	category := model.NewId()

	preferences1 := model.Preferences{
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: category,
			Name:     model.NewId(),
		},
		{
			UserId:   user1.Id,
			Category: model.NewId(),
			Name:     model.NewId(),
		},
	}

	Client.LoginByEmail(team.Name, user1.Email, "pwd")
	Client.Must(Client.SetPreferences(&preferences1))

	Client.LoginByEmail(team.Name, user1.Email, "pwd")

	if result, err := Client.GetPreferenceCategory(category); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("received the wrong number of preferences")
	} else if !((data[0] == preferences1[0] && data[1] == preferences1[1]) || (data[0] == preferences1[1] && data[1] == preferences1[0])) {
		t.Fatal("received incorrect preferences")
	}

	Client.LoginByEmail(team.Name, user2.Email, "pwd")

	if result, err := Client.GetPreferenceCategory(category); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 0 {
		t.Fatal("received the wrong number of preferences")
	}
}

func TestGetPreference(t *testing.T) {
	Setup()

	team := &model.Team{DisplayName: "Name", Name: "z-z-" + model.NewId() + "a", Email: "test@nowhere.com", Type: model.TEAM_OPEN}
	team = Client.Must(Client.CreateTeam(team)).Data.(*model.Team)

	user := &model.User{TeamId: team.Id, Email: model.NewId() + "corey+test@test.com", Nickname: "Corey Hulen", Password: "pwd"}
	user = Client.Must(Client.CreateUser(user, "")).Data.(*model.User)
	store.Must(Srv.Store.User().VerifyEmail(user.Id))

	Client.LoginByEmail(team.Name, user.Email, "pwd")

	preferences := model.Preferences{
		{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
			Value:    model.NewId(),
		},
	}

	Client.Must(Client.SetPreferences(&preferences))

	if result, err := Client.GetPreference(preferences[0].Category, preferences[0].Name); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(*model.Preference); *data != preferences[0] {
		t.Fatal("preference saved incorrectly")
	}

	preferences[0].Value = model.NewId()
	Client.Must(Client.SetPreferences(&preferences))

	if result, err := Client.GetPreference(preferences[0].Category, preferences[0].Name); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(*model.Preference); *data != preferences[0] {
		t.Fatal("preference updated incorrectly")
	}
}
