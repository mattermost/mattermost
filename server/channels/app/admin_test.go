// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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
		_, err := w.Write(validJSON)
		require.NoError(t, err)
	}))
	defer ts.Close()

	t.Run("get latest mm version happy path", func(t *testing.T) {
		_, err := th.App.GetLatestVersion(th.Context, ts.URL)
		require.Nil(t, err)
	})

	t.Run("get latest mm version from cache", func(t *testing.T) {
		err := th.App.clearLatestVersionCache()
		require.NoError(t, err)
		originalResult, appErr := th.App.GetLatestVersion(th.Context, ts.URL)
		require.Nil(t, appErr)

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
			_, err := w.Write(updatedJSON)
			require.NoError(t, err)
		}))
		defer ts.Close()

		cachedResult, appErr := th.App.GetLatestVersion(th.Context, updatedServer.URL)
		require.Nil(t, appErr)

		require.Equal(t, originalResult.TagName, cachedResult.TagName, "did not get cached result")
	})

	t.Run("get latest mm version error from external", func(t *testing.T) {
		err := th.App.clearLatestVersionCache()
		require.NoError(t, err)

		errorServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, err := w.Write([]byte(`
				{
					"message": "internal server error"
				}
			`))
			require.NoError(t, err)
		}))
		defer ts.Close()

		_, appErr := th.App.GetLatestVersion(th.Context, errorServer.URL)
		require.NotNil(t, appErr)
	})
}
