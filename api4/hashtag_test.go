package api4

import (
	"encoding/json"
	"fmt"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
)

func getResult[T any](t *testing.T, th *TestHelper, method string, uri string) T {
	r, err := http.NewRequest(method, th.Client.APIURL+uri, nil)
	require.NoError(t, err)
	r.Header.Set(model.HeaderAuth, fmt.Sprintf("%s %s", th.Client.AuthType, th.Client.AuthToken))

	resp, err := th.Client.HTTPClient.Do(r)
	require.NoError(t, err)

	var results T

	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		t.Fatal(fmt.Sprintf("Failed to decode json: %s", err.Error()))
	}

	return results
}

func TestSuggestHashTag(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	client := th.Client
	_, _, err := client.Login(th.SystemAdminUser.Email, th.SystemAdminUser.Password)
	require.NoError(t, err)

	postsFromOneUser := map[int64]string{
		1665847085: "We're a #people-team.",
		1665933485: "This post is not included. No hashtags.",
		1666019885: "But his #one will not #have the correct hashtags.",
		1666106285: "#help-wanted\n Hi! We need help on this issue!",
		1666192685: "We will be configuring our new production server #help-wanted!",
		1666279085: "#testing hashtag autocompletion",
		1666365485: "Is #testing really so hard?",
		1666451885: "Hey, #help-wanted with #ux",
		1666538285: "Join us! We're #hiring.",
		1666624685: "#testing #testing #testing",
		1666711085: "Is somebody #hiring?",
		1666797485: "Our company Test is #hiring! Talk to us at #mattercon. #help-wanted",
	}

	for createAt, message := range postsFromOneUser {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   message,
			UserId:    th.BasicUser.Id,
			CreateAt:  createAt,
		}
		_, err := th.App.CreatePostAsUser(th.Context, post, th.Context.Session().Id, false)

		if err != nil {
			t.Fatal(err.Error())
		}
	}

	postsFromServer := []string{
		"We all know that #technology is amazing!",
		"#Mattermost uses latest OCR #technology",
		"Hashtag autocomplete is coming to #Mattermost!",
		"I'm polishing hashtag autocomplete for #Mattermost.",
	}

	for _, postFromServer := range postsFromServer {
		post := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   postFromServer,
		}
		_, _, err := client.CreatePost(post)

		if err != nil {
			t.Fatal(err.Error())
		}
	}

	t.Run("Return most common hashtags", func(t *testing.T) {
		actual := getResult[[]model.HashtagWithMessageCount](t, th, "GET", "/hashtags?sort=messages[desc]")

		expected := []model.HashtagWithMessageCount{
			//TODO: duplicate hashtags in one message should be counted as one message
			{Value: "#help-wanted", Messages: 4},
			{Value: "#hiring", Messages: 3},
			{Value: "#Mattermost", Messages: 3},
			{Value: "#testing", Messages: 3},
			{Value: "#technology", Messages: 2},
			{Value: "#have", Messages: 1},
			{Value: "#mattercon", Messages: 1},
			{Value: "#one", Messages: 1},
			{Value: "#people-team", Messages: 1},
			{Value: "#ux", Messages: 1},
		}

		assert.Equal(t, expected, actual)
	})

	_, err = client.Logout()
	require.NoError(t, err)

	t.Run("Hashtag suggestions are sorted", func(t *testing.T) {
		//TODO: fix on Postgres
		expected := []string{
			"#testing",
			"#mattercon",
			"#help-wanted",
			"#people-team",
			"#technology",
			"#Mattermost",
		}
		_, _, err := client.Login(th.BasicUser.Email, th.BasicUser.Password)
		require.NoError(t, err)
		actual, err := client.GetSuggestedHashtags("te")
		require.NoError(t, err)

		for index, hashtag := range actual {
			assert.Equal(t, expected[index], hashtag.Value)
		}
	})
}
