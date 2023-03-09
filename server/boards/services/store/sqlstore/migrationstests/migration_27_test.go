// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package migrationstests

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func Test27MigrateUserPropsToPreferences(t *testing.T) {
	t.Run("should correctly migrate properties on personal server and desktop", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.f.MigrateToStep(26).
			ExecFile("./fixtures/test27MigrateUserPropsToPreferences.sql")

		// first we check that the data was correctly loaded from the
		// fixtures. We could perfectly skip this step, but as the
		// failing data is in a JSON field, I preferred to leave it
		// for clarity
		user := struct {
			ID       string
			Username string
			Props    string
		}{}

		err := th.f.DB().Get(&user, "SELECT id, username, props FROM focalboard_users WHERE id = 'user-id'")
		require.NoError(t, err)
		userProps := map[string]any{}
		require.NoError(t, json.Unmarshal([]byte(user.Props), &userProps))

		require.Equal(t, "johndoe", user.Username)
		require.Contains(t, userProps, "focalboard_welcomePageViewed")
		require.True(t, userProps["focalboard_welcomePageViewed"].(bool))
		require.Contains(t, userProps, "hiddenBoardIDs")
		require.ElementsMatch(t, []string{"board1", "board2"}, userProps["hiddenBoardIDs"])
		require.Contains(t, userProps, "focalboard_tourCategory")
		require.Equal(t, "onboarding", userProps["focalboard_tourCategory"])
		require.Contains(t, userProps, "focalboard_onboardingTourStep")
		require.Equal(t, float64(1), userProps["focalboard_onboardingTourStep"])
		require.Contains(t, userProps, "focalboard_onboardingTourStarted")
		// initially, onboardingTourStarted will be false on the user,
		// but already inserted in the preferences table as true. The
		// migration should not overwrite the already existing value,
		// so after migration #27, this value should be true
		require.False(t, userProps["focalboard_onboardingTourStarted"].(bool))
		require.Contains(t, userProps, "focalboard_version72MessageCanceled")
		require.True(t, userProps["focalboard_version72MessageCanceled"].(bool))
		require.Contains(t, userProps, "focalboard_lastWelcomeVersion")
		require.Equal(t, float64(7), userProps["focalboard_lastWelcomeVersion"])

		// we apply the migration
		th.f.MigrateToStep(27)

		// then we load the preferences on a new struct
		userPreferences := []struct {
			Name  string
			Value string
		}{}

		nErr := th.f.DB().Select(&userPreferences, "SELECT name, value FROM focalboard_preferences WHERE UserId = 'user-id'")
		require.NoError(t, nErr)

		// helper function to quickly get a preference value from the
		// userPreferences slice
		getValue := func(name string) string {
			for _, userPreference := range userPreferences {
				if userPreference.Name == name {
					return userPreference.Value
				}
			}
			require.FailNow(t, "could not found preference", "while searching for name %q", name)
			return "this should never be reached"
		}

		// and we check that the values are correct
		welcomePageViewedValue := getValue("welcomePageViewed")
		// the checks for true or 1 make the test work for all DBs,
		// that were representing the boolean values in the JSON
		// struct in different ways
		require.True(t, welcomePageViewedValue == "true" || welcomePageViewedValue == "1")

		hiddenBoardIDsValue := getValue("hiddenBoardIDs")
		require.Contains(t, hiddenBoardIDsValue, "board1")
		require.Contains(t, hiddenBoardIDsValue, "board2")

		require.Equal(t, "onboarding", getValue("tourCategory"))

		onboardingTourStepValue := getValue("onboardingTourStep")
		require.True(t, onboardingTourStepValue == "true" || onboardingTourStepValue == "1")

		onboardingTourStartedValue := getValue("onboardingTourStarted")
		require.True(t, onboardingTourStartedValue == "true" || onboardingTourStartedValue == "1")

		version72MessageCanceledValue := getValue("version72MessageCanceled")
		require.True(t, version72MessageCanceledValue == "true" || version72MessageCanceledValue == "1")

		require.Equal(t, "7", getValue("lastWelcomeVersion"))
	})
}
