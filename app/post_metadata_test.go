// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPreparePostForClient(t *testing.T) {
	setup := func() *TestHelper {
		th := Setup().InitBasic()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ImageProxyType = ""
			*cfg.ServiceSettings.ImageProxyURL = ""
			*cfg.ServiceSettings.ImageProxyOptions = ""
		})

		return th
	}

	t.Run("no metadata needed", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post := th.CreatePost(th.BasicChannel)
		message := post.Message

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.NotEqual(t, clientPost, post, "should've returned a new post")
		assert.Equal(t, message, post.Message, "shouldn't have mutated post.Message")
		assert.NotEqual(t, nil, post.ReactionCounts, "shouldn't have mutated post.ReactionCounts")
		assert.NotEqual(t, nil, post.FileInfos, "shouldn't have mutated post.FileInfos")
		assert.NotEqual(t, nil, post.Emojis, "shouldn't have mutated post.Emojis")
		assert.NotEqual(t, nil, post.ImageDimensions, "shouldn't have mutated post.ImageDimensions")
		assert.NotEqual(t, nil, post.OpenGraphData, "shouldn't have mutated post.OpenGraphData")

		assert.Equal(t, clientPost.Message, post.Message, "shouldn't have changed Message")
		assert.Len(t, post.ReactionCounts, 0, "should've populated ReactionCounts")
		assert.Len(t, post.FileInfos, 0, "should've populated FileInfos")
		assert.Len(t, post.Emojis, 0, "should've populated Emojis")
		assert.Len(t, post.ImageDimensions, 0, "should've populated ImageDimensions")
		assert.Len(t, post.OpenGraphData, 0, "should've populated OpenGraphData")
	})

	t.Run("metadata already set", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post, err := th.App.PreparePostForClient(th.CreatePost(th.BasicChannel))
		require.Nil(t, err)

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.False(t, clientPost == post, "should've returned a new post")
		assert.Equal(t, clientPost, post, "shouldn't have changed any metadata")
	})

	t.Run("reaction counts", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post := th.CreatePost(th.BasicChannel)
		th.AddReactionToPost(post, th.BasicUser, "smile")

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.Equal(t, model.ReactionCounts{
			"smile": 1,
		}, clientPost.ReactionCounts, "should've populated post.ReactionCounts")
	})

	t.Run("file infos", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		fileInfo, err := th.App.DoUploadFile(time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "test.txt", []byte("test"))
		require.Nil(t, err)

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			FileIds:   []string{fileInfo.Id},
		}, th.BasicChannel, false)
		require.Nil(t, err)

		fileInfo.PostId = post.Id

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.Equal(t, []*model.FileInfo{fileInfo}, clientPost.FileInfos, "should've populated post.FileInfos")
	})

	t.Run("emojis without custom emojis enabled", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomEmoji = false
		})

		emoji := th.CreateEmoji()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   ":" + emoji.Name + ": :taco:",
		}, th.BasicChannel, false)
		require.Nil(t, err)

		th.AddReactionToPost(post, th.BasicUser, "smile")
		th.AddReactionToPost(post, th.BasicUser, "angry")
		th.AddReactionToPost(post, th.BasicUser2, "angry")

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.Len(t, clientPost.ReactionCounts, 2, "should've populated post.ReactionCounts")
		assert.Equal(t, 1, clientPost.ReactionCounts["smile"], "should've populated post.ReactionCounts for smile")
		assert.Equal(t, 2, clientPost.ReactionCounts["angry"], "should've populated post.ReactionCounts for angry")
		assert.ElementsMatch(t, []*model.Emoji{}, clientPost.Emojis, "should've populated empty post.Emojis")
	})

	t.Run("emojis with custom emojis enabled", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomEmoji = true
		})

		emoji1 := th.CreateEmoji()
		emoji2 := th.CreateEmoji()
		emoji3 := th.CreateEmoji()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   ":" + emoji3.Name + ": :taco:",
		}, th.BasicChannel, false)
		require.Nil(t, err)

		th.AddReactionToPost(post, th.BasicUser, emoji1.Name)
		th.AddReactionToPost(post, th.BasicUser, emoji2.Name)
		th.AddReactionToPost(post, th.BasicUser2, emoji2.Name)
		th.AddReactionToPost(post, th.BasicUser2, "angry")

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		assert.Len(t, clientPost.ReactionCounts, 3, "should've populated post.ReactionCounts")
		assert.Equal(t, 1, clientPost.ReactionCounts[emoji1.Name], "should've populated post.ReactionCounts for emoji1")
		assert.Equal(t, 2, clientPost.ReactionCounts[emoji2.Name], "should've populated post.ReactionCounts for emoji2")
		assert.Equal(t, 1, clientPost.ReactionCounts["angry"], "should've populated post.ReactionCounts for angry")
		assert.ElementsMatch(t, []*model.Emoji{emoji1, emoji2, emoji3}, clientPost.Emojis, "should've populated post.Emojis")
	})

	t.Run("linked image dimensions", func(t *testing.T) {
		// TODO
	})

	t.Run("proxy linked images", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		testProxyLinkedImage(t, th, false)
	})

	t.Run("opengraph", func(t *testing.T) {
		// TODO
	})

	t.Run("opengraph image dimensions", func(t *testing.T) {
		// TODO
	})

	t.Run("proxy opengraph images", func(t *testing.T) {
		// TODO
	})
}

func TestPreparePostForClientWithImageProxy(t *testing.T) {
	setup := func() *TestHelper {
		th := Setup().InitBasic()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
			*cfg.ServiceSettings.ImageProxyType = "atmos/camo"
			*cfg.ServiceSettings.ImageProxyURL = "https://127.0.0.1"
			*cfg.ServiceSettings.ImageProxyOptions = "foo"
		})

		return th
	}

	t.Run("proxy linked images", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		testProxyLinkedImage(t, th, true)
	})

	t.Run("proxy opengraph images", func(t *testing.T) {
		// TODO
	})
}

func testProxyLinkedImage(t *testing.T, th *TestHelper, shouldProxy bool) {
	postTemplate := "![foo](%v)"
	imageURL := "http://mydomain.com/myimage"
	proxiedImageURL := "https://127.0.0.1/f8dace906d23689e8d5b12c3cefbedbf7b9b72f5/687474703a2f2f6d79646f6d61696e2e636f6d2f6d79696d616765"

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   fmt.Sprintf(postTemplate, imageURL),
	}

	var err *model.AppError
	post, err = th.App.CreatePost(post, th.BasicChannel, false)
	require.Nil(t, err)

	clientPost, err := th.App.PreparePostForClient(post)
	require.Nil(t, err)

	if shouldProxy {
		assert.Equal(t, post.Message, fmt.Sprintf(postTemplate, imageURL), "should not have mutated original post")
		assert.Equal(t, clientPost.Message, fmt.Sprintf(postTemplate, proxiedImageURL), "should've replaced linked image URLs")
	} else {
		assert.Equal(t, clientPost.Message, fmt.Sprintf(postTemplate, imageURL), "shouldn't have replaced linked image URLs")
	}
}

func TestGetCustomEmojisForPost_Message(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	emoji1 := th.CreateEmoji()
	emoji2 := th.CreateEmoji()
	emoji3 := th.CreateEmoji()

	testCases := []struct {
		Description      string
		Input            string
		Expected         []*model.Emoji
		SkipExpectations bool
	}{
		{
			Description:      "no emojis",
			Input:            "this is a string",
			Expected:         []*model.Emoji{},
			SkipExpectations: true,
		},
		{
			Description: "one emoji",
			Input:       "this is an :" + emoji1.Name + ": string",
			Expected: []*model.Emoji{
				emoji1,
			},
		},
		{
			Description: "two emojis",
			Input:       "this is a :" + emoji3.Name + ": :" + emoji2.Name + ": string",
			Expected: []*model.Emoji{
				emoji3,
				emoji2,
			},
		},
		{
			Description: "punctuation around emojis",
			Input:       ":" + emoji3.Name + ":/:" + emoji1.Name + ": (:" + emoji2.Name + ":)",
			Expected: []*model.Emoji{
				emoji3,
				emoji1,
				emoji2,
			},
		},
		{
			Description: "adjacent emojis",
			Input:       ":" + emoji3.Name + "::" + emoji1.Name + ":",
			Expected: []*model.Emoji{
				emoji3,
				emoji1,
			},
		},
		{
			Description: "duplicate emojis",
			Input:       "" + emoji1.Name + ": :" + emoji1.Name + ": :" + emoji1.Name + ": :" + emoji2.Name + ": :" + emoji2.Name + ": :" + emoji1.Name + ":",
			Expected: []*model.Emoji{
				emoji1,
				emoji2,
			},
		},
		{
			Description: "fake emojis",
			Input:       "these don't exist :tomato: :potato: :rotato:",
			Expected:    []*model.Emoji{},
		},
		{
			Description: "fake and real emojis",
			Input:       ":tomato::" + emoji1.Name + ": :potato: :" + emoji2.Name + ":",
			Expected: []*model.Emoji{
				emoji1,
				emoji2,
			},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			emojis, err := th.App.getCustomEmojisForPost(testCase.Input, nil)
			assert.Nil(t, err, "failed to get emojis in message")
			assert.ElementsMatch(t, emojis, testCase.Expected, "received incorrect emojis")
		})
	}
}

func TestGetCustomEmojisForPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	emoji1 := th.CreateEmoji()
	emoji2 := th.CreateEmoji()

	reactions := []*model.Reaction{
		{
			UserId:    th.BasicUser.Id,
			EmojiName: emoji1.Name,
		},
	}

	emojis, err := th.App.getCustomEmojisForPost(":"+emoji2.Name+":", reactions)
	assert.Nil(t, err, "failed to get emojis for post")
	assert.ElementsMatch(t, emojis, []*model.Emoji{emoji1, emoji2}, "received incorrect emojis")
}
