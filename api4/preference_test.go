// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
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

	Client.UpdatePreferences(user1.Id, &preferences1)

	prefs, resp := Client.GetPreferences(user1.Id)
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

	prefs, resp = Client.GetPreferences(th.BasicUser2.Id)
	CheckNoError(t, resp)

	if len(prefs) == 0 {
		t.Fatal("received the wrong number of preferences")
	}

	_, resp = Client.GetPreferences(th.BasicUser.Id)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetPreferences(th.BasicUser2.Id)
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

	Client.UpdatePreferences(user1.Id, &preferences1)

	prefs, resp := Client.GetPreferencesByCategory(user1.Id, category)
	CheckNoError(t, resp)

	if len(prefs) != 2 {
		t.Fatalf("received the wrong number of preferences %v:%v", len(prefs), 2)
	}

	prefs, resp = Client.GetPreferencesByCategory(user1.Id, "junk")
	CheckNotFoundStatus(t, resp)

	th.LoginBasic2()

	prefs, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, category)
	CheckNotFoundStatus(t, resp)

	prefs, resp = Client.GetPreferencesByCategory(user1.Id, category)
	CheckForbiddenStatus(t, resp)

	prefs, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, "junk")
	CheckNotFoundStatus(t, resp)

	if len(prefs) != 0 {
		t.Fatal("received the wrong number of preferences")
	}

	Client.Logout()
	_, resp = Client.GetPreferencesByCategory(th.BasicUser2.Id, category)
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

	Client.UpdatePreferences(user.Id, &preferences)

	pref, resp := Client.GetPreferenceByCategoryAndName(user.Id, model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, name)
	CheckNoError(t, resp)

	if (pref.UserId != preferences[0].UserId) && (pref.Category != preferences[0].Category) && (pref.Name != preferences[0].Name) {
		t.Fatal("preference saved incorrectly")
	}

	preferences[0].Value = model.NewId()
	Client.UpdatePreferences(user.Id, &preferences)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, "junk", preferences[0].Name)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, "junk")
	CheckBadRequestStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(th.BasicUser2.Id, preferences[0].Category, "junk")
	CheckForbiddenStatus(t, resp)

	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, preferences[0].Name)
	CheckNoError(t, resp)

	Client.Logout()
	_, resp = Client.GetPreferenceByCategoryAndName(user.Id, preferences[0].Category, preferences[0].Name)
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

	_, resp := Client.UpdatePreferences(user1.Id, &preferences1)
	CheckNoError(t, resp)

	preferences := model.Preferences{
		{
			UserId:   model.NewId(),
			Category: category,
			Name:     model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(user1.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	preferences = model.Preferences{
		{
			UserId: user1.Id,
			Name:   model.NewId(),
		},
	}

	_, resp = Client.UpdatePreferences(user1.Id, &preferences)
	CheckBadRequestStatus(t, resp)

	_, resp = Client.UpdatePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	Client.Logout()
	_, resp = Client.UpdatePreferences(user1.Id, &preferences1)
	CheckUnauthorizedStatus(t, resp)
}

func TestDeletePreferences(t *testing.T) {
	th := Setup().InitBasic()
	defer TearDown()
	Client := th.Client

	th.LoginBasic()

	prefs, resp := Client.GetPreferences(th.BasicUser.Id)
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

	Client.UpdatePreferences(th.BasicUser.Id, &preferences)

	// delete 10 preferences
	th.LoginBasic2()

	_, resp = Client.DeletePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	th.LoginBasic()

	_, resp = Client.DeletePreferences(th.BasicUser.Id, &preferences)
	CheckNoError(t, resp)

	_, resp = Client.DeletePreferences(th.BasicUser2.Id, &preferences)
	CheckForbiddenStatus(t, resp)

	prefs, resp = Client.GetPreferences(th.BasicUser.Id)
	if len(prefs) != originalCount {
		t.Fatal("should've deleted preferences")
	}

	Client.Logout()
	_, resp = Client.DeletePreferences(th.BasicUser.Id, &preferences)
	CheckUnauthorizedStatus(t, resp)
}
