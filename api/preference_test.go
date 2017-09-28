// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetAllPreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user1 := th.BasicUser

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

	Client.Must(Client.SetPreferences(&preferences1))

	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 4 {
		t.Fatal("received the wrong number of preferences")
	}

	th.LoginBasic2()

	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) == 0 {
		t.Fatal("received the wrong number of preferences")
	}
}

func TestSetPreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user1 := th.BasicUser

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

	th.LoginBasic2()

	if _, err := Client.SetPreferences(&preferences); err == nil {
		t.Fatal("shouldn't have been able to update another user's preferences")
	}
}

func TestGetPreferenceCategory(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user1 := th.BasicUser

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

	Client.Must(Client.SetPreferences(&preferences1))

	if result, err := Client.GetPreferenceCategory(category); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 2 {
		t.Fatal("received the wrong number of preferences")
	} else if !((data[0] == preferences1[0] && data[1] == preferences1[1]) || (data[0] == preferences1[1] && data[1] == preferences1[0])) {
		t.Fatal("received incorrect preferences")
	}

	th.LoginBasic2()

	if result, err := Client.GetPreferenceCategory(category); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != 0 {
		t.Fatal("received the wrong number of preferences")
	}
}

func TestGetPreference(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user := th.BasicUser

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

func TestDeletePreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient
	user1 := th.BasicUser

	var originalCount int
	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else {
		originalCount = len(result.Data.(model.Preferences))
	}

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

	// delete 10 preferences
	th.LoginBasic2()

	if _, err := Client.DeletePreferences(&preferences); err == nil {
		t.Fatal("shouldn't have been able to delete another user's preferences")
	}

	th.LoginBasic()
	if _, err := Client.DeletePreferences(&preferences); err != nil {
		t.Fatal(err)
	}

	if result, err := Client.GetAllPreferences(); err != nil {
		t.Fatal(err)
	} else if data := result.Data.(model.Preferences); len(data) != originalCount {
		t.Fatal("should've deleted preferences")
	}
}
