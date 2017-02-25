// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/platform/model"
	"testing"
)

func TestGetPreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()
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

	Client.UpdatePreferences(&preferences1)

	prefs, resp := Client.GetPreferences()
	CheckNoError(t, resp)
	if len(prefs) != 4 {
		t.Fatal("received the wrong number of preferences")
	}

	for _, preference := range prefs {
		if preference.UserId != th.BasicUser.Id {
			t.Fatal("user id does not match")
		}
	}

	th.LoginBasic2()

	prefs, resp = Client.GetPreferences()
	CheckNoError(t, resp)

	if len(prefs) == 0 {
		t.Fatal("received the wrong number of preferences")
	}

	Client.Logout()
	_, resp = Client.GetPreferences()
	CheckUnauthorizedStatus(t, resp)
}

func TestGetPreferencesByCategory(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()
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

	Client.UpdatePreferences(&preferences1)

	prefs, resp := Client.GetPreferencesByCategory(category)
	CheckNoError(t, resp)

	if len(prefs) != 2 {
		t.Fatalf("received the wrong number of preferences %v:%v", len(prefs), 2)
	}

	prefs, resp = Client.GetPreferencesByCategory("junk")
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2()

	prefs, resp = Client.GetPreferencesByCategory(category)
	CheckNotFoundStatus(t, resp)

	prefs, resp = Client.GetPreferencesByCategory("junk")
	CheckNotFoundStatus(t, resp)

	if len(prefs) != 0 {
		t.Fatal("received the wrong number of preferences")
	}

	Client.Logout()
	_, resp = Client.GetPreferencesByCategory(category)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetPreferenceByCategoryAndName(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()
	user := th.BasicUser
	name := model.NewId()
	value := model.NewId()

	preferences := model.Preferences{
		{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     name,
			Value:    value,
		},
		{
			UserId:   user.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
			Value:    model.NewId(),
		},
	}

	Client.UpdatePreferences(&preferences)

	pref, resp := Client.GetPreferenceByCategoryAndName(model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, name)
	CheckNoError(t, resp)

	if (pref.UserId != preferences[0].UserId) && (pref.Category != preferences[0].Category) && (pref.Name != preferences[0].Name) {
		t.Fatal("preference saved incorrectly")
	}

	preferences[0].Value = model.NewId()
	Client.UpdatePreferences(&preferences)

	_, resp = Client.GetPreferenceByCategoryAndName("junk", preferences[0].Name)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(preferences[0].Category, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(preferences[0].Category, preferences[0].Name)
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.GetPreferenceByCategoryAndName(preferences[0].Category, preferences[0].Name)
	CheckUnauthorizedStatus(t, resp)

}

func TestUpdatePreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()
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

	_, resp := Client.UpdatePreferences(&preferences1)
	CheckNoError(t, resp)

	preferences := model.Preferences{
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(&preferences)
	CheckForbiddenStatus(t, resp)

	preferences = model.Preferences{
		{
			UserId: user1.Id,
			Name:   model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(&preferences)
	CheckBadRequestStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdatePreferences(&preferences1)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeletePreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()

	prefs, resp := Client.GetPreferences()
	originalCount := len(prefs)

	// save 10 preferences
	var preferences model.Preferences
	for i := 0; i < 10; i++ {
		preference := model.Preference{
			UserId:   th.BasicUser.Id,
			Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
			Name:     model.NewId(),
		}
		preferences = append(preferences, preference)
	}

	Client.UpdatePreferences(&preferences)

	// delete 10 preferences
	th.LoginBasic2()

	_, resp = Client.DeletePreferences(&preferences)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	_, resp = Client.DeletePreferences(&preferences)
	CheckNoError(t, resp)

	prefs, resp = Client.GetPreferences()
	if len(prefs) != originalCount {
		t.Fatal("should've deleted preferences")
	}

	Client.Logout()
	_, resp = Client.DeletePreferences(&preferences)
	CheckUnauthorizedStatus(t, resp)
}
