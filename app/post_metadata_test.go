// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils/testutils"
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

		t.Run("doesn't mutate provided post", func(t *testing.T) {
			assert.NotEqual(t, clientPost, post, "should've returned a new post")

			assert.Equal(t, message, post.Message, "shouldn't have mutated post.Message")
			assert.Equal(t, (*model.PostMetadata)(nil), post.Metadata, "shouldn't have mutated post.Metadata")
		})

		t.Run("populates all fields", func(t *testing.T) {
			assert.Equal(t, message, clientPost.Message, "shouldn't have changed Message")
			assert.NotEqual(t, nil, clientPost.Metadata, "should've populated Metadata")
			assert.Len(t, clientPost.Metadata.Embeds, 0, "should've populated Embeds")
			assert.Len(t, clientPost.Metadata.ReactionCounts, 0, "should've populated ReactionCounts")
			assert.Len(t, clientPost.Metadata.FileInfos, 0, "should've populated FileInfos")
			assert.Len(t, clientPost.Metadata.Emojis, 0, "should've populated Emojis")
			assert.Len(t, clientPost.Metadata.ImageDimensions, 0, "should've populated ImageDimensions")
		})
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
		}, clientPost.Metadata.ReactionCounts, "should've populated ReactionCounts")
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

		assert.Equal(t, []*model.FileInfo{fileInfo}, clientPost.Metadata.FileInfos, "should've populated FileInfos")
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

		t.Run("populates emojis", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.Emoji{}, clientPost.Metadata.Emojis, "should've populated empty Emojis")
		})

		t.Run("populates reaction counts", func(t *testing.T) {
			reactionCounts := clientPost.Metadata.ReactionCounts
			assert.Len(t, reactionCounts, 2, "should've populated ReactionCounts")
			assert.Equal(t, 1, reactionCounts["smile"], "should've included 'smile' in ReactionCounts")
			assert.Equal(t, 2, reactionCounts["angry"], "should've included 'angry' in ReactionCounts")
		})
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

		t.Run("pupulates emojis", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.Emoji{emoji1, emoji2, emoji3}, clientPost.Metadata.Emojis, "should've populated post.Emojis")
		})

		t.Run("populates reaction counts", func(t *testing.T) {
			reactionCounts := clientPost.Metadata.ReactionCounts
			assert.Len(t, reactionCounts, 3, "should've populated ReactionCounts")
			assert.Equal(t, 1, reactionCounts[emoji1.Name], "should've included emoji1 in ReactionCounts")
			assert.Equal(t, 2, reactionCounts[emoji2.Name], "should've included emoji2 in ReactionCounts")
			assert.Equal(t, 1, reactionCounts["angry"], "should've included angry in ReactionCounts")
		})
	})

	t.Run("markdown image dimensions", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "This is ![our logo](https://github.com/hmhealey/test-files/raw/master/logoVertical.png) and ![our icon](https://github.com/hmhealey/test-files/raw/master/icon.png)",
		}, th.BasicChannel, false)
		require.Nil(t, err)

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.ImageDimensions
			assert.Len(t, imageDimensions, 2)
			assert.Equal(t, &model.PostImageDimensions{
				Width:  1068,
				Height: 552,
			}, imageDimensions["https://github.com/hmhealey/test-files/raw/master/logoVertical.png"])
			assert.Equal(t, &model.PostImageDimensions{
				Width:  501,
				Height: 501,
			}, imageDimensions["https://github.com/hmhealey/test-files/raw/master/icon.png"])
		})
	})

	t.Run("proxy linked images", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		testProxyLinkedImage(t, th, false)
	})

	t.Run("proxy opengraph images", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		testProxyOpenGraphImage(t, th, false)
	})

	t.Run("image embed", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message: `This is our logo: https://github.com/hmhealey/test-files/raw/master/logoVertical.png
	And this is our icon: https://github.com/hmhealey/test-files/raw/master/icon.png`,
		}, th.BasicChannel, false)
		require.Nil(t, err)

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		// Reminder that only the first link gets an embed and dimensions

		t.Run("populates embeds", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.PostEmbed{
				{
					Type: model.POST_EMBED_IMAGE,
					URL:  "https://github.com/hmhealey/test-files/raw/master/logoVertical.png",
				},
			}, clientPost.Metadata.Embeds)
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.ImageDimensions
			assert.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImageDimensions{
				Width:  1068,
				Height: 552,
			}, imageDimensions["https://github.com/hmhealey/test-files/raw/master/logoVertical.png"])
		})
	})

	t.Run("opengraph embed", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   `This is our web page: https://github.com/hmhealey/test-files`,
		}, th.BasicChannel, false)
		require.Nil(t, err)

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		t.Run("populates embeds", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.PostEmbed{
				{
					Type: model.POST_EMBED_OPENGRAPH,
					URL:  "https://github.com/hmhealey/test-files",
					Data: &opengraph.OpenGraph{
						Description: "Contribute to hmhealey/test-files development by creating an account on GitHub.",
						SiteName:    "GitHub",
						Title:       "hmhealey/test-files",
						Type:        "object",
						URL:         "https://github.com/hmhealey/test-files",
						Images: []*opengraph.Image{
							{
								URL: "https://avatars1.githubusercontent.com/u/3277310?s=400&v=4",
							},
						},
					},
				},
			}, clientPost.Metadata.Embeds)
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.ImageDimensions
			assert.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImageDimensions{
				Width:  420,
				Height: 420,
			}, imageDimensions["https://avatars1.githubusercontent.com/u/3277310?s=400&v=4"])
		})
	})

	t.Run("message attachment embed", func(t *testing.T) {
		th := setup()
		defer th.TearDown()

		post, err := th.App.CreatePost(&model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Props: map[string]interface{}{
				"attachments": []interface{}{
					map[string]interface{}{
						"text": "![icon](https://github.com/hmhealey/test-files/raw/master/icon.png)",
					},
				},
			},
		}, th.BasicChannel, false)
		require.Nil(t, err)

		clientPost, err := th.App.PreparePostForClient(post)
		require.Nil(t, err)

		t.Run("populates embeds", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.PostEmbed{
				{
					Type: model.POST_EMBED_MESSAGE_ATTACHMENT,
				},
			}, clientPost.Metadata.Embeds)
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.ImageDimensions
			assert.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImageDimensions{
				Width:  501,
				Height: 501,
			}, imageDimensions["https://github.com/hmhealey/test-files/raw/master/icon.png"])
		})
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
		th := setup()
		defer th.TearDown()

		testProxyOpenGraphImage(t, th, true)
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
	if err != nil && err.Id != "app.post.metadata.link.app_error" {
		t.Fatal(err)
	}

	if shouldProxy {
		assert.Equal(t, post.Message, fmt.Sprintf(postTemplate, imageURL), "should not have mutated original post")
		assert.Equal(t, clientPost.Message, fmt.Sprintf(postTemplate, proxiedImageURL), "should've replaced linked image URLs")
	} else {
		assert.Equal(t, clientPost.Message, fmt.Sprintf(postTemplate, imageURL), "shouldn't have replaced linked image URLs")
	}
}

func testProxyOpenGraphImage(t *testing.T, th *TestHelper, shouldProxy bool) {
	post, err := th.App.CreatePost(&model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   `This is our web page: https://github.com/hmhealey/test-files`,
	}, th.BasicChannel, false)
	require.Nil(t, err)

	clientPost, err := th.App.PreparePostForClient(post)
	require.Nil(t, err)

	image := &opengraph.Image{}
	if shouldProxy {
		image.SecureURL = "https://127.0.0.1/b2ef6ef4890a0107aa80ba33b3011fd51f668303/68747470733a2f2f61766174617273312e67697468756275736572636f6e74656e742e636f6d2f752f333237373331303f733d34303026763d34"
	} else {
		image.URL = "https://avatars1.githubusercontent.com/u/3277310?s=400&v=4"
	}

	assert.ElementsMatch(t, []*model.PostEmbed{
		{
			Type: model.POST_EMBED_OPENGRAPH,
			URL:  "https://github.com/hmhealey/test-files",
			Data: &opengraph.OpenGraph{
				Description: "Contribute to hmhealey/test-files development by creating an account on GitHub.",
				SiteName:    "GitHub",
				Title:       "hmhealey/test-files",
				Type:        "object",
				URL:         "https://github.com/hmhealey/test-files",
				Images:      []*opengraph.Image{image},
			},
		},
	}, clientPost.Metadata.Embeds)
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

func TestGetFirstLinkAndImages(t *testing.T) {
	for name, testCase := range map[string]struct {
		Input             string
		ExpectedFirstLink string
		ExpectedImages    []string
	}{
		"no links or images": {
			Input:             "this is a string",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"http link": {
			Input:             "this is a http://example.com",
			ExpectedFirstLink: "http://example.com",
			ExpectedImages:    []string{},
		},
		"www link": {
			Input:             "this is a www.example.com",
			ExpectedFirstLink: "http://www.example.com",
			ExpectedImages:    []string{},
		},
		"image": {
			Input:             "this is a ![our logo](http://example.com/logo)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example.com/logo"},
		},
		"multiple images": {
			Input:             "this is a ![our logo](http://example.com/logo) and ![their logo](http://example.com/logo2) and ![my logo](http://example.com/logo3)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example.com/logo", "http://example.com/logo2", "http://example.com/logo3"},
		},
		"multiple images with duplicate": {
			Input:             "this is a ![our logo](http://example.com/logo) and ![their logo](http://example.com/logo2) and ![my logo which is their logo](http://example.com/logo2)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example.com/logo", "http://example.com/logo2"},
		},
		"reference image": {
			Input: `this is a ![our logo][logo]

[logo]: http://example.com/logo`,
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example.com/logo"},
		},
		"image and link": {
			Input:             "this is a https://example.com and ![our logo](https://example.com/logo)",
			ExpectedFirstLink: "https://example.com",
			ExpectedImages:    []string{"https://example.com/logo"},
		},
		"markdown links (not returned)": {
			Input: `this is a [our page](http://example.com) and [another page][]

[another page]: http://www.exaple.com/another_page`,
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
	} {
		t.Run(name, func(t *testing.T) {
			firstLink, images := getFirstLinkAndImages(testCase.Input)

			assert.Equal(t, firstLink, testCase.ExpectedFirstLink)
			assert.Equal(t, images, testCase.ExpectedImages)
		})
	}
}

func TestGetImagesInPostAttachments(t *testing.T) {
	// TODO
}

func TestParseLinkMetadata(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	imageURL := "http://example.com/test.png"
	file, err := testutils.ReadTestFile("test.png")
	require.Nil(t, err)

	ogURL := "https://example.com/hello"
	html := `
		<html>
			<head>
				<meta property="og:title" content="Hello, World!">
				<meta property="og:type" content="object">
				<meta property="og:url" content="` + ogURL + `">
			</head>
		</html>`

	makeImageReader := func() io.Reader {
		return bytes.NewReader(file)
	}

	makeOpenGraphReader := func() io.Reader {
		return strings.NewReader(html)
	}

	t.Run("image", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(imageURL, makeImageReader(), "image/png")
		assert.Nil(t, err)

		assert.Nil(t, og)
		assert.Equal(t, &model.PostImageDimensions{
			Width:  408,
			Height: 336,
		}, dimensions)
	})

	t.Run("malformed image", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(imageURL, makeOpenGraphReader(), "image/png")
		assert.NotNil(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})

	t.Run("opengraph", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(ogURL, makeOpenGraphReader(), "text/html; charset=utf-8")
		assert.Nil(t, err)

		assert.NotNil(t, og)
		assert.Equal(t, og.Title, "Hello, World!")
		assert.Equal(t, og.Type, "object")
		assert.Equal(t, og.URL, ogURL)
		assert.Nil(t, dimensions)
	})

	t.Run("malformed opengraph", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(ogURL, makeImageReader(), "text/html; charset=utf-8")
		assert.Nil(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})

	t.Run("neither", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata("http://example.com/test.wad", strings.NewReader("garbage"), "application/x-doom")
		assert.Nil(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})
}

func TestParseImageDimensions(t *testing.T) {
	for name, testCase := range map[string]struct {
		FileName       string
		ExpectedWidth  int
		ExpectedHeight int
		ExpectError    bool
	}{
		"png": {
			FileName:       "test.png",
			ExpectedWidth:  408,
			ExpectedHeight: 336,
		},
		"animated gif": {
			FileName:       "testgif.gif",
			ExpectedWidth:  118,
			ExpectedHeight: 118,
		},
		"not an image": {
			FileName:    "README.md",
			ExpectError: true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			file, err := testutils.ReadTestFile(testCase.FileName)
			require.Nil(t, err)

			dimensions, err := parseImageDimensions(bytes.NewReader(file))
			if testCase.ExpectError {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)

				require.NotNil(t, dimensions)
				require.Equal(t, testCase.ExpectedWidth, dimensions.Width)
				require.Equal(t, testCase.ExpectedHeight, dimensions.Height)
			}
		})
	}
}
