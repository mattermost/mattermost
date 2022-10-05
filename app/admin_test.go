// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestGetLatestVersion(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	version := &model.GithubReleaseInfo{
		Id:          57117096,
		TagName:     "v6.3.0",
		Name:        "v6.3.0",
		CreatedAt:   "2022-01-13T14:19:44Z",
		PublishedAt: "2022-01-14T13:45:09Z",
		Body:        "Mattermost Platform Release v6.3.0",
		Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v6.3.0",
	}

	validJSON, jsonErr := json.Marshal(version)
	require.NoError(t, jsonErr)

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(validJSON)
	}))
	defer ts.Close()

	t.Run("get latest mm version happy path", func(t *testing.T) {
		_, err := th.App.GetLatestVersion(ts.URL)
		require.Nil(t, err)
	})

	t.Run("get latest mm version from cache", func(t *testing.T) {
		th.App.ClearLatestVersionCache()
		originalResult, err := th.App.GetLatestVersion(ts.URL)
		require.Nil(t, err)

		// Call same function but mock the GET request to return a different result.
		// We are hoping the function will use the cache instead of making the GET request
		v := &model.GithubReleaseInfo{
			Id:          57117096,
			TagName:     "v6.3.1",
			Name:        "v6.3.1",
			CreatedAt:   "2022-01-13T14:19:44Z",
			PublishedAt: "2022-01-14T13:45:09Z",
			Body:        "Mattermost Platform Release v6.3.0",
			Url:         "https://github.com/mattermost/mattermost-server/releases/tag/v6.3.0",
		}

		updatedJSON, jsonErr := json.Marshal(v)
		require.NoError(t, jsonErr)

		updatedServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Write(updatedJSON)
		}))
		defer updatedServer.Close()

		cachedResult, err := th.App.GetLatestVersion(updatedServer.URL)
		require.Nil(t, err)

		require.Equal(t, originalResult.TagName, cachedResult.TagName, "did not get cached result")
	})

	t.Run("get latest mm version error from external", func(t *testing.T) {
		th.App.ClearLatestVersionCache()
		errorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`
				{
					"message": "internal server error"
				}
			`))
		}))
		defer errorServer.Close()

		_, appErr := th.App.GetLatestVersion(errorServer.URL)
		require.NotNil(t, appErr)
	})
}
