// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/stretchr/testify/mock"

	"github.com/dyatlov/go-opengraph/opengraph"
	ogimage "github.com/dyatlov/go-opengraph/opengraph/types/image"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/platform/services/httpservice"
	"github.com/mattermost/mattermost/server/v8/platform/services/imageproxy"
)

func TestPreparePostListForClient(t *testing.T) {
	// Most of this logic is covered by TestPreparePostForClient, so this just tests handling of multiple posts

	th := Setup(t)
	defer th.TearDown()

	postList := model.NewPostList()
	for i := 0; i < 5; i++ {
		postList.AddPost(&model.Post{})
	}

	clientPostList := th.App.PreparePostListForClient(th.Context, postList)

	t.Run("doesn't mutate provided post list", func(t *testing.T) {
		assert.NotEqual(t, clientPostList, postList, "should've returned a new post list")
		assert.NotEqual(t, clientPostList.Posts, postList.Posts, "should've returned a new PostList.Posts")
		assert.Equal(t, clientPostList.Order, postList.Order, "should've returned the existing PostList.Order")

		for id, originalPost := range postList.Posts {
			assert.NotEqual(t, clientPostList.Posts[id], originalPost, "should've returned new post objects")
			assert.Equal(t, clientPostList.Posts[id].Id, originalPost.Id, "should've returned the same posts")
		}
	})

	t.Run("adds metadata to each post", func(t *testing.T) {
		for _, clientPost := range clientPostList.Posts {
			assert.NotNil(t, clientPost.Metadata, "should've populated metadata for each post")
		}
	})
}

func TestPreparePostForClient(t *testing.T) {
	t.Skip("MM-43252")
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`
			<html>
			<head>
			<meta property="og:image" content="` + serverURL + `/test-image3.png" />
			<meta property="og:site_name" content="GitHub" />
			<meta property="og:type" content="object" />
			<meta property="og:title" content="hmhealey/test-files" />
			<meta property="og:url" content="https://github.com/hmhealey/test-files" />
			<meta property="og:description" content="Contribute to hmhealey/test-files development by creating an account on GitHub." />
			</head>
			</html>`))
		case "/test-image1.png":
			file, err := testutils.ReadTestFile("test.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		case "/test-image2.png":
			file, err := testutils.ReadTestFile("test-data-graph.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		case "/test-image3.png":
			file, err := testutils.ReadTestFile("qa-data-graph.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		default:
			require.Fail(t, "Invalid path", r.URL.Path)
		}
	}))
	serverURL = server.URL
	defer server.Close()

	setup := func(t *testing.T) *TestHelper {
		th := Setup(t).InitBasic()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableLinkPreviews = true
			*cfg.ImageProxySettings.Enable = false
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		})

		return th
	}

	t.Run("no metadata needed", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		message := model.NewId()
		post := &model.Post{
			Message: message,
		}

		clientPost := th.App.PreparePostForClient(th.Context, post, false, true, false)

		t.Run("doesn't mutate provided post", func(t *testing.T) {
			assert.NotEqual(t, clientPost, post, "should've returned a new post")

			assert.Equal(t, message, post.Message, "shouldn't have mutated post.Message")
			assert.Equal(t, (*model.PostMetadata)(nil), post.Metadata, "shouldn't have mutated post.Metadata")
		})

		t.Run("populates all fields", func(t *testing.T) {
			assert.Equal(t, message, clientPost.Message, "shouldn't have changed Message")
			assert.NotEqual(t, nil, clientPost.Metadata, "should've populated Metadata")
			assert.Empty(t, clientPost.Metadata.Embeds, "should've populated Embeds")
			assert.Empty(t, clientPost.Metadata.Reactions, "should've populated Reactions")
			assert.Empty(t, clientPost.Metadata.Files, "should've populated Files")
			assert.Empty(t, clientPost.Metadata.Emojis, "should've populated Emojis")
			assert.Empty(t, clientPost.Metadata.Images, "should've populated Images")
		})
	})

	t.Run("metadata already set", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post := th.CreatePost(th.BasicChannel)

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		assert.False(t, clientPost == post, "should've returned a new post")
		assert.Equal(t, clientPost, post, "shouldn't have changed any metadata")
	})

	t.Run("reactions", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post := th.CreatePost(th.BasicChannel)
		reaction1 := th.AddReactionToPost(post, th.BasicUser, "smile")
		reaction2 := th.AddReactionToPost(post, th.BasicUser2, "smile")
		reaction3 := th.AddReactionToPost(post, th.BasicUser2, "ice_cream")
		post.HasReactions = true

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		assert.Len(t, clientPost.Metadata.Reactions, 3, "should've populated Reactions")
		assert.Equal(t, reaction1, clientPost.Metadata.Reactions[0], "first reaction is incorrect")
		assert.Equal(t, reaction2, clientPost.Metadata.Reactions[1], "second reaction is incorrect")
		assert.Equal(t, reaction3, clientPost.Metadata.Reactions[2], "third reaction is incorrect")
	})

	t.Run("files", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		fileInfo, err := th.App.DoUploadFile(th.Context, time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "test.txt", []byte("test"))
		fileInfo.Content = "test"
		require.Nil(t, err)

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			FileIds:   []string{fileInfo.Id},
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		fileInfo.PostId = post.Id

		var clientPost *model.Post
		assert.Eventually(t, func() bool {
			clientPost = th.App.PreparePostForClient(th.Context, post, false, false, false)
			return assert.ObjectsAreEqual([]*model.FileInfo{fileInfo}, clientPost.Metadata.Files)
		}, time.Second, 10*time.Millisecond)

		assert.Equal(t, []*model.FileInfo{fileInfo}, clientPost.Metadata.Files, "should've populated Files")
	})

	t.Run("emojis without custom emojis enabled", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomEmoji = false
		})

		emoji := th.CreateEmoji()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   ":" + emoji.Name + ": :taco:",
			Props: map[string]any{
				"attachments": []*model.SlackAttachment{
					{
						Text: ":" + emoji.Name + ":",
					},
				},
			},
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		th.AddReactionToPost(post, th.BasicUser, "smile")
		th.AddReactionToPost(post, th.BasicUser, "angry")
		th.AddReactionToPost(post, th.BasicUser2, "angry")
		post.HasReactions = true

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		t.Run("populates emojis", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.Emoji{}, clientPost.Metadata.Emojis, "should've populated empty Emojis")
		})

		t.Run("populates reaction counts", func(t *testing.T) {
			reactions := clientPost.Metadata.Reactions
			assert.Len(t, reactions, 3, "should've populated Reactions")
		})
	})

	t.Run("emojis with custom emojis enabled", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableCustomEmoji = true
		})

		emoji1 := th.CreateEmoji()
		emoji2 := th.CreateEmoji()
		emoji3 := th.CreateEmoji()
		emoji4 := th.CreateEmoji()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   ":" + emoji3.Name + ": :taco:",
			Props: map[string]any{
				"attachments": []*model.SlackAttachment{
					{
						Text: ":" + emoji4.Name + ":",
					},
				},
			},
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		th.AddReactionToPost(post, th.BasicUser, emoji1.Name)
		th.AddReactionToPost(post, th.BasicUser, emoji2.Name)
		th.AddReactionToPost(post, th.BasicUser2, emoji2.Name)
		th.AddReactionToPost(post, th.BasicUser2, "angry")
		post.HasReactions = true

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		t.Run("populates emojis", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.Emoji{emoji1, emoji2, emoji3, emoji4}, clientPost.Metadata.Emojis, "should've populated post.Emojis")
		})

		t.Run("populates reaction counts", func(t *testing.T) {
			reactions := clientPost.Metadata.Reactions
			assert.Len(t, reactions, 4, "should've populated Reactions")
		})
	})

	t.Run("emojis overriding profile icon", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		prepare := func(override bool, url, emoji string) *model.Post {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnablePostIconOverride = override
			})

			post, err := th.App.CreatePost(th.Context, &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "Test",
			}, th.BasicChannel, false, true)

			require.Nil(t, err)

			post.AddProp(model.PostPropsOverrideIconURL, url)
			post.AddProp(model.PostPropsOverrideIconEmoji, emoji)

			return th.App.PreparePostForClient(th.Context, post, false, false, false)
		}

		emoji := "basketball"
		url := "http://host.com/image.png"
		overriddenURL := "/static/emoji/1f3c0.png"

		t.Run("does not override icon URL", func(t *testing.T) {
			clientPost := prepare(false, url, emoji)

			s, ok := clientPost.GetProps()[model.PostPropsOverrideIconURL]
			assert.True(t, ok)
			assert.EqualValues(t, url, s)
			s, ok = clientPost.GetProps()[model.PostPropsOverrideIconEmoji]
			assert.True(t, ok)
			assert.EqualValues(t, emoji, s)
		})

		t.Run("overrides icon URL", func(t *testing.T) {
			clientPost := prepare(true, url, emoji)

			s, ok := clientPost.GetProps()[model.PostPropsOverrideIconURL]
			assert.True(t, ok)
			assert.EqualValues(t, overriddenURL, s)
			s, ok = clientPost.GetProps()[model.PostPropsOverrideIconEmoji]
			assert.True(t, ok)
			assert.EqualValues(t, emoji, s)
		})

		t.Run("overrides icon URL with name surrounded by colons", func(t *testing.T) {
			colonEmoji := ":basketball:"
			clientPost := prepare(true, url, colonEmoji)

			s, ok := clientPost.GetProps()[model.PostPropsOverrideIconURL]
			assert.True(t, ok)
			assert.EqualValues(t, overriddenURL, s)
			s, ok = clientPost.GetProps()[model.PostPropsOverrideIconEmoji]
			assert.True(t, ok)
			assert.EqualValues(t, colonEmoji, s)
		})

	})

	t.Run("markdown image dimensions", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   fmt.Sprintf("This is ![our logo](%s/test-image2.png) and ![our icon](%s/test-image1.png)", server.URL, server.URL),
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.Images
			require.Len(t, imageDimensions, 2)
			assert.Equal(t, &model.PostImage{
				Format: "png",
				Width:  1280,
				Height: 1780,
			}, imageDimensions[server.URL+"/test-image2.png"])
			assert.Equal(t, &model.PostImage{
				Format: "png",
				Width:  408,
				Height: 336,
			}, imageDimensions[server.URL+"/test-image1.png"])
		})
	})

	t.Run("post props has invalid fields", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "some post",
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		// this value expected to be a string
		post.AddProp(model.PostPropsOverrideIconEmoji, true)

		require.NotPanics(t, func() {
			_ = th.App.PreparePostForClient(th.Context, post, false, false, false)
		})
	})

	t.Run("proxy linked images", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		testProxyLinkedImage(t, th, false)
	})

	t.Run("proxy opengraph images", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		testProxyOpenGraphImage(t, th, false)
	})

	t.Run("image embed", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message: `This is our logo: ` + server.URL + `/test-image2.png
	And this is our icon: ` + server.URL + `/test-image1.png`,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		post.Metadata.Embeds = nil
		clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, post, false, false, false)

		// Reminder that only the first link gets an embed and dimensions

		t.Run("populates embeds", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.PostEmbed{
				{
					Type: model.PostEmbedImage,
					URL:  server.URL + "/test-image2.png",
				},
			}, clientPost.Metadata.Embeds)
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.Images
			require.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImage{
				Format: "png",
				Width:  1280,
				Height: 1780,
			}, imageDimensions[server.URL+"/test-image2.png"])
		})
	})

	t.Run("opengraph embed", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   `This is our web page: ` + server.URL,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)
		firstEmbed := clientPost.Metadata.Embeds[0]
		ogData := firstEmbed.Data.(*opengraph.OpenGraph)

		t.Run("populates embeds", func(t *testing.T) {
			assert.Equal(t, firstEmbed.Type, model.PostEmbedOpengraph)
			assert.Equal(t, firstEmbed.URL, server.URL)
			assert.Equal(t, ogData.Description, "Contribute to hmhealey/test-files development by creating an account on GitHub.")
			assert.Equal(t, ogData.SiteName, "GitHub")
			assert.Equal(t, ogData.Title, "hmhealey/test-files")
			assert.Equal(t, ogData.Type, "object")
			assert.Equal(t, ogData.URL, server.URL)
			assert.Equal(t, ogData.Images[0].URL, server.URL+"/test-image3.png")
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.Images
			require.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImage{
				Format: "png",
				Width:  1790,
				Height: 1340,
			}, imageDimensions[server.URL+"/test-image3.png"])
		})
	})

	t.Run("message attachment embed", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		post, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Props: map[string]any{
				"attachments": []any{
					map[string]any{
						"text": "![icon](" + server.URL + "/test-image1.png)",
					},
				},
			},
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		post.Metadata.Embeds = nil
		clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, post, false, false, false)

		t.Run("populates embeds", func(t *testing.T) {
			assert.ElementsMatch(t, []*model.PostEmbed{
				{
					Type: model.PostEmbedMessageAttachment,
				},
			}, clientPost.Metadata.Embeds)
		})

		t.Run("populates image dimensions", func(t *testing.T) {
			imageDimensions := clientPost.Metadata.Images
			require.Len(t, imageDimensions, 1)
			assert.Equal(t, &model.PostImage{
				Format: "png",
				Width:  408,
				Height: 336,
			}, imageDimensions[server.URL+"/test-image1.png"])
		})
	})

	t.Run("no metadata for deleted posts", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		fileInfo, err := th.App.DoUploadFile(th.Context, time.Now(), th.BasicTeam.Id, th.BasicChannel.Id, th.BasicUser.Id, "test.txt", []byte("test"))
		require.Nil(t, err)

		post, err := th.App.CreatePost(th.Context, &model.Post{
			Message:   "test",
			FileIds:   []string{fileInfo.Id},
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		post.Metadata.Embeds = nil

		th.AddReactionToPost(post, th.BasicUser, "taco")

		post, err = th.App.DeletePost(th.Context, post.Id, th.BasicUser.Id)
		require.Nil(t, err)

		// DeleteAt isn't set on the post returned by App.DeletePost
		post.DeleteAt = model.GetMillis()

		clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

		assert.NotEqual(t, nil, clientPost.Metadata, "should've populated Metadata“")
		assert.Equal(t, "", clientPost.Message, "should've cleaned post content")
		assert.Nil(t, clientPost.Metadata.Reactions, "should not have populated Reactions")
		assert.Nil(t, clientPost.Metadata.Files, "should not have populated Files")
	})

	t.Run("permalink preview", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		referencedPost.Metadata.Embeds = nil

		link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   link,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		previewPost.Metadata.Embeds = nil
		clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, previewPost, false, false, false)
		firstEmbed := clientPost.Metadata.Embeds[0]
		preview := firstEmbed.Data.(*model.PreviewPost)
		require.Equal(t, referencedPost.Id, preview.PostID)
	})

	t.Run("permalink previews for direct and group messages", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		directChannel, err := th.App.createDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, err)

		groupChannel, err := th.App.createGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, th.CreateUser().Id})
		require.Nil(t, err)

		testCases := []struct {
			Description string
			Channel     *model.Channel
			Expected    model.ChannelType
		}{
			{
				Description: "direct message permalink preview",
				Channel:     directChannel,
				Expected:    model.ChannelType("D"),
			},
			{
				Description: "group message permalink preview",
				Channel:     groupChannel,
				Expected:    model.ChannelType("G"),
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
					UserId:    th.BasicUser.Id,
					ChannelId: testCase.Channel.Id,
					Message:   "hello world",
				}, th.BasicChannel, false, true)
				require.Nil(t, err)
				referencedPost.Metadata.Embeds = nil

				link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

				previewPost, err := th.App.CreatePost(th.Context, &model.Post{
					UserId:    th.BasicUser.Id,
					ChannelId: th.BasicChannel.Id,
					Message:   link,
				}, th.BasicChannel, false, true)
				require.Nil(t, err)
				previewPost.Metadata.Embeds = nil

				clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, previewPost, false, false, false)
				firstEmbed := clientPost.Metadata.Embeds[0]
				preview := firstEmbed.Data.(*model.PreviewPost)

				assert.Empty(t, preview.TeamName)
				assert.Equal(t, testCase.Expected, preview.ChannelType)
			})
		}
	})

	t.Run("permalink with nested preview should have referenced post metadata", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   `This is our logo: ` + server.URL + `/test-image2.png`,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		referencedPost.Metadata.Embeds = nil

		link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   link,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		previewPost.Metadata.Embeds = nil

		clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, previewPost, false, false, false)
		firstEmbed := clientPost.Metadata.Embeds[0]
		preview := firstEmbed.Data.(*model.PreviewPost)
		referencedPostFirstEmbed := preview.Post.Metadata.Embeds[0]

		require.Equal(t, referencedPost.Id, preview.PostID)
		require.Equal(t, referencedPostFirstEmbed.URL, serverURL+`/test-image2.png`)
	})

	t.Run("permalink with nested permalink should not have referenced post metadata", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		nestedPermalinkPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   `This is our logo: ` + server.URL + `/test-image2.png`,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		nestedPermalinkPost.Metadata.Embeds = nil

		nestedLink := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, nestedPermalinkPost.Id)

		referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   nestedLink,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		referencedPost.Metadata.Embeds = nil

		link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   link,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)
		previewPost.Metadata.Embeds = nil

		clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, previewPost, false, false, false)
		firstEmbed := clientPost.Metadata.Embeds[0]
		preview := firstEmbed.Data.(*model.PreviewPost)
		referencedPostMetadata := preview.Post.Metadata

		require.Equal(t, referencedPost.Id, preview.PostID)
		require.Equal(t, referencedPostMetadata, (*model.PostMetadata)(nil))
	})

	t.Run("permalink preview renders after toggling off the feature", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		})

		th.Context.Session().UserId = th.BasicUser.Id

		referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "hello world",
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

		previewPost, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   link,
		}, th.BasicChannel, false, true)
		require.Nil(t, err)

		clientPost := th.App.PreparePostForClient(th.Context, previewPost, false, false, false)
		firstEmbed := clientPost.Metadata.Embeds[0]
		preview := firstEmbed.Data.(*model.PreviewPost)
		require.Equal(t, referencedPost.Id, preview.PostID)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePermalinkPreviews = false
		})

		th.App.PreparePostForClient(th.Context, previewPost, false, false, false)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePermalinkPreviews = true
		})

		clientPost2 := th.App.PreparePostForClient(th.Context, previewPost, false, false, false)
		firstEmbed2 := clientPost2.Metadata.Embeds[0]
		preview2 := firstEmbed2.Data.(*model.PreviewPost)
		require.Equal(t, referencedPost.Id, preview2.PostID)
	})
}

func TestPreparePostForClientWithImageProxy(t *testing.T) {
	setup := func(t *testing.T) *TestHelper {
		th := Setup(t).InitBasic()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableLinkPreviews = true
			*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
			*cfg.ImageProxySettings.Enable = true
			*cfg.ImageProxySettings.ImageProxyType = "atmos/camo"
			*cfg.ImageProxySettings.RemoteImageProxyURL = "https://127.0.0.1"
			*cfg.ImageProxySettings.RemoteImageProxyOptions = "foo"
		})

		th.App.ch.imageProxy = imageproxy.MakeImageProxy(th.Server.platform, th.Server.HTTPService(), th.Server.Log())

		return th
	}

	t.Run("proxy linked images", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		testProxyLinkedImage(t, th, true)
	})

	t.Run("proxy opengraph images", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		testProxyOpenGraphImage(t, th, true)
	})
}

func testProxyLinkedImage(t *testing.T, th *TestHelper, shouldProxy bool) {
	postTemplate := "![foo](%v)"
	imageURL := "http://mydomain.com/myimage"
	proxiedImageURL := "http://mymattermost.com/api/v4/image?url=http%3A%2F%2Fmydomain.com%2Fmyimage"

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   fmt.Sprintf(postTemplate, imageURL),
	}

	clientPost := th.App.PreparePostForClient(th.Context, post, false, false, false)

	if shouldProxy {
		assert.Equal(t, fmt.Sprintf(postTemplate, imageURL), post.Message, "should not have mutated original post")
		assert.Equal(t, fmt.Sprintf(postTemplate, proxiedImageURL), clientPost.Message, "should've replaced linked image URLs")
	} else {
		assert.Equal(t, fmt.Sprintf(postTemplate, imageURL), clientPost.Message, "shouldn't have replaced linked image URLs")
	}
}

func testProxyOpenGraphImage(t *testing.T, th *TestHelper, shouldProxy bool) {
	var serverURL string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`
			<html>
			<head>
			<meta property="og:image" content="` + serverURL + `/test-image3.png" />
			<meta property="og:site_name" content="GitHub" />
			<meta property="og:type" content="object" />
			<meta property="og:title" content="hmhealey/test-files" />
			<meta property="og:url" content="https://github.com/hmhealey/test-files" />
			<meta property="og:description" content="Contribute to hmhealey/test-files development by creating an account on GitHub." />
			</head>
			</html>`))
		case "/test-image3.png":
			file, err := testutils.ReadTestFile("qa-data-graph.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		default:
			require.Fail(t, "Invalid path", r.URL.Path)
		}
	}))
	serverURL = server.URL
	defer server.Close()

	post, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   `This is our web page: ` + server.URL,
	}, th.BasicChannel, false, true)
	require.Nil(t, err)

	post.Metadata.Embeds = nil
	embeds := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, post, false, false, false).Metadata.Embeds
	require.Len(t, embeds, 1, "should have one embed")

	embed := embeds[0]
	assert.Equal(t, model.PostEmbedOpengraph, embed.Type, "embed type should be OpenGraph")
	assert.Equal(t, server.URL, embed.URL, "embed URL should be correct")

	og, ok := embed.Data.(*opengraph.OpenGraph)
	assert.True(t, ok, "data should be non-nil OpenGraph data")
	assert.NotNil(t, og, "data should be non-nil OpenGraph data")
	assert.Equal(t, "GitHub", og.SiteName, "OpenGraph data should be correctly populated")

	require.Len(t, og.Images, 1, "OpenGraph data should have one image")

	image := og.Images[0]
	if shouldProxy {
		assert.Equal(t, "", image.URL, "image URL should not be set with proxy")
		assert.Equal(t, "http://mymattermost.com/api/v4/image?url="+url.QueryEscape(server.URL+"/test-image3.png"), image.SecureURL, "secure image URL should be sent through proxy")
	} else {
		assert.Equal(t, server.URL+"/test-image3.png", image.URL, "image URL should be set")
		assert.Equal(t, "", image.SecureURL, "secure image URL should not be set")
	}
}

func TestGetEmbedForPost(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/index.html" {
			w.Header().Set("Content-Type", "text/html")
			if r.Header.Get("Accept-Language") == "fr" {
				w.Header().Set("Content-Language", "fr")
				w.Write([]byte(`
				<html>
				<head>
				<meta property="og:title" content="Title-FR" />
				<meta property="og:description" content="Bonjour le monde" />
				</head>
				</html>`))
			} else {
				w.Write([]byte(`
				<html>
				<head>
				<meta property="og:title" content="Title" />
				<meta property="og:description" content="Hello world" />
				</head>
				</html>`))
			}
		} else if r.URL.Path == "/image.png" {
			file, err := testutils.ReadTestFile("test.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		} else if r.URL.Path == "/other" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`
			<html>
			<head>
			</head>
			</html>`))
		} else {
			require.Fail(t, "Invalid path", r.URL.Path)
		}
	}))
	defer server.Close()

	ogURL := server.URL + "/index.html"
	imageURL := server.URL + "/image.png"
	otherURL := server.URL + "/other"

	t.Run("with link previews enabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
			*cfg.ServiceSettings.EnableLinkPreviews = true
		})

		t.Run("should return a message attachment when the post has one", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{
				Props: model.StringInterface{
					"attachments": []*model.SlackAttachment{
						{
							Text: "test",
						},
					},
				},
			}, "", false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedMessageAttachment,
			}, embed)
			assert.NoError(t, err)
		})

		t.Run("should return an image embed when the first link is an image", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, imageURL, false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedImage,
				URL:  imageURL,
			}, embed)
			assert.NoError(t, err)
		})

		t.Run("should return an opengraph embed", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, ogURL, false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedOpengraph,
				URL:  ogURL,
				Data: &opengraph.OpenGraph{
					Title:       "Title",
					Description: "Hello world",
				},
			}, embed)
			assert.NoError(t, err)
		})

		t.Run("should return an opengraph embed in different Server Language", func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.LocalizationSettings.DefaultServerLocale = "fr"
			})
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, ogURL, false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedOpengraph,
				URL:  ogURL,
				Data: &opengraph.OpenGraph{
					Title:       "Title-FR",
					Description: "Bonjour le monde",
				},
			}, embed)
			assert.NoError(t, err)
		})

		t.Run("should return a link embed", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, otherURL, false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedLink,
				URL:  otherURL,
			}, embed)
			assert.NoError(t, err)
		})
	})

	t.Run("with link previews disabled", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
			*cfg.ServiceSettings.EnableLinkPreviews = false
		})

		t.Run("should return an embedded message attachment", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{
				Props: model.StringInterface{
					"attachments": []*model.SlackAttachment{
						{
							Text: "test",
						},
					},
				},
			}, "", false)

			assert.Equal(t, &model.PostEmbed{
				Type: model.PostEmbedMessageAttachment,
			}, embed)
			assert.NoError(t, err)
		})

		t.Run("should not return an opengraph embed", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, ogURL, false)

			assert.Nil(t, embed)
			assert.NoError(t, err)
		})

		t.Run("should not return an image embed", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, imageURL, false)

			assert.Nil(t, embed)
			assert.NoError(t, err)
		})

		t.Run("should not return a link embed", func(t *testing.T) {
			embed, err := th.App.getEmbedForPost(th.Context, &model.Post{}, otherURL, false)

			assert.Nil(t, embed)
			assert.NoError(t, err)
		})
	})
}

func TestGetImagesForPost(t *testing.T) {
	t.Run("with an image link", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			file, err := testutils.ReadTestFile("test.png")
			require.NoError(t, err)

			w.Header().Set("Content-Type", "image/png")
			w.Write(file)
		}))

		post := &model.Post{
			Metadata: &model.PostMetadata{},
		}
		imageURL := server.URL + "/image.png"

		images := th.App.getImagesForPost(th.Context, post, []string{imageURL}, false)

		assert.Equal(t, images, map[string]*model.PostImage{
			imageURL: {
				Format: "png",
				Width:  408,
				Height: 336,
			},
		})
	})

	t.Run("with an invalid image link", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))

		post := &model.Post{
			Metadata: &model.PostMetadata{},
		}
		imageURL := server.URL + "/bad_image.png"

		images := th.App.getImagesForPost(th.Context, post, []string{imageURL}, false)

		assert.Equal(t, images, map[string]*model.PostImage{})
	})

	t.Run("for an OpenGraph image", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/image.png" {
				w.Header().Set("Content-Type", "image/png")

				img := image.NewGray(image.Rect(0, 0, 200, 300))

				var encoder png.Encoder
				encoder.Encode(w, img)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer server.Close()

		ogURL := server.URL + "/index.html"
		imageURL := server.URL + "/image.png"

		post := &model.Post{
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedOpengraph,
						URL:  ogURL,
						Data: &opengraph.OpenGraph{
							Images: []*ogimage.Image{
								{
									URL: imageURL,
								},
							},
						},
					},
				},
			},
		}

		images := th.App.getImagesForPost(th.Context, post, []string{}, false)

		assert.Equal(t, images, map[string]*model.PostImage{
			imageURL: {
				Format: "png",
				Width:  200,
				Height: 300,
			},
		})
	})

	t.Run("with an OpenGraph image with a secure_url", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/secure_image.png" {
				w.Header().Set("Content-Type", "image/png")

				img := image.NewGray(image.Rect(0, 0, 300, 400))

				var encoder png.Encoder
				encoder.Encode(w, img)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		defer server.Close()

		ogURL := server.URL + "/index.html"
		imageURL := server.URL + "/secure_image.png"

		post := &model.Post{
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedOpengraph,
						URL:  ogURL,
						Data: &opengraph.OpenGraph{
							Images: []*ogimage.Image{
								{
									SecureURL: imageURL,
								},
							},
						},
					},
				},
			},
		}

		images := th.App.getImagesForPost(th.Context, post, []string{}, false)

		assert.Equal(t, images, map[string]*model.PostImage{
			imageURL: {
				Format: "png",
				Width:  300,
				Height: 400,
			},
		})
	})

	t.Run("with an OpenGraph image with a secure_url and no dimensions", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/secure_image.png" {
				w.Header().Set("Content-Type", "image/png")

				img := image.NewGray(image.Rect(0, 0, 400, 500))

				var encoder png.Encoder
				encoder.Encode(w, img)
			} else {
				w.WriteHeader(http.StatusNotFound)
			}
		}))

		ogURL := server.URL + "/index.html"
		imageURL := server.URL + "/secure_image.png"

		post := &model.Post{
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedOpengraph,
						URL:  ogURL,
						Data: &opengraph.OpenGraph{
							Images: []*ogimage.Image{
								{
									URL:       server.URL + "/image.png",
									SecureURL: imageURL,
								},
							},
						},
					},
				},
			},
		}

		images := th.App.getImagesForPost(th.Context, post, []string{}, false)

		assert.Equal(t, images, map[string]*model.PostImage{
			imageURL: {
				Format: "png",
				Width:  400,
				Height: 500,
			},
		})
	})

	t.Run("with an invalid OpenGraph image data", func(t *testing.T) {
		th := Setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		post := &model.Post{
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedOpengraph,
						Data: map[string]any{},
					},
				},
			},
		}

		images := th.App.getImagesForPost(th.Context, post, []string{}, false)
		assert.Equal(t, images, map[string]*model.PostImage{})
	})

	t.Run("should not process OpenGraph image that's a Mattermost permalink", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()

		ogURL := "https://example.com/index.html"
		imageURL := th.App.GetSiteURL() + "/pl/qwertyuiopasdfghjklzxcvbnm"

		post := &model.Post{
			Id: "qwertyuiopasdfghjklzxcvbnm",
			Metadata: &model.PostMetadata{
				Embeds: []*model.PostEmbed{
					{
						Type: model.PostEmbedOpengraph,
						URL:  ogURL,
						Data: &opengraph.OpenGraph{
							Images: []*ogimage.Image{
								{
									URL: imageURL,
								},
							},
						},
					},
				},
			},
		}

		mockPostStore := mocks.PostStore{}
		mockPostStore.On("GetSingle", "qwertyuiopasdfghjklzxcvbnm", false).RunFn = func(args mock.Arguments) {
			assert.Fail(t, "should not have tried to process Mattermost permalink in OG image URL")
		}

		mockLinkMetadataStore := mocks.LinkMetadataStore{}
		mockLinkMetadataStore.On("Get", mock.Anything, mock.Anything).Return(nil, store.NewErrNotFound("mock resource", "mock ID"))

		mockStore := th.App.Srv().Store().(*mocks.Store)
		mockStore.On("Post").Return(&mockPostStore)
		mockStore.On("LinkMetadata").Return(&mockLinkMetadataStore)

		images := th.App.getImagesForPost(th.Context, post, []string{}, false)
		assert.Equal(t, 0, len(images))
		assert.Equal(t, images, map[string]*model.PostImage{})
	})
}

func TestGetEmojiNamesForString(t *testing.T) {
	testCases := []struct {
		Description string
		Input       string
		Expected    []string
	}{
		{
			Description: "no emojis",
			Input:       "this is a string",
			Expected:    []string{},
		},
		{
			Description: "one emoji",
			Input:       "this is an :emoji1: string",
			Expected:    []string{"emoji1"},
		},
		{
			Description: "two emojis",
			Input:       "this is a :emoji3: :emoji2: string",
			Expected:    []string{"emoji3", "emoji2"},
		},
		{
			Description: "punctuation around emojis",
			Input:       ":emoji3:/:emoji1: (:emoji2:)",
			Expected:    []string{"emoji3", "emoji1", "emoji2"},
		},
		{
			Description: "adjacent emojis",
			Input:       ":emoji3::emoji1:",
			Expected:    []string{"emoji3", "emoji1"},
		},
		{
			Description: "duplicate emojis",
			Input:       ":emoji1: :emoji1: :emoji1::emoji2::emoji2: :emoji1:",
			Expected:    []string{"emoji1", "emoji1", "emoji1", "emoji2", "emoji2", "emoji1"},
		},
		{
			Description: "fake emojis",
			Input:       "these don't exist :tomato: :potato: :rotato:",
			Expected:    []string{"tomato", "potato", "rotato"},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			emojis := getEmojiNamesForString(testCase.Input)
			assert.ElementsMatch(t, emojis, testCase.Expected, "received incorrect emoji names")
		})
	}
}

func TestGetEmojiNamesForPost(t *testing.T) {
	testCases := []struct {
		Description string
		Post        *model.Post
		Reactions   []*model.Reaction
		Expected    []string
	}{
		{
			Description: "no emojis",
			Post: &model.Post{
				Message: "this is a post",
			},
			Expected: []string{},
		},
		{
			Description: "in post message",
			Post: &model.Post{
				Message: "this is :emoji:",
			},
			Expected: []string{"emoji"},
		},
		{
			Description: "in reactions",
			Post:        &model.Post{},
			Reactions: []*model.Reaction{
				{
					EmojiName: "emoji1",
				},
				{
					EmojiName: "emoji2",
				},
			},
			Expected: []string{"emoji1", "emoji2"},
		},
		{
			Description: "in message attachments",
			Post: &model.Post{
				Message: "this is a post",
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text:    ":emoji1:",
							Pretext: ":emoji2:",
						},
						{
							Fields: []*model.SlackAttachmentField{
								{
									Value: ":emoji3:",
								},
								{
									Value: ":emoji4:",
								},
							},
						},
						{
							Title: "This is the title: :emoji5:",
						},
					},
				},
			},
			Expected: []string{"emoji1", "emoji2", "emoji3", "emoji4", "emoji5"},
		},
		{
			Description: "with duplicates",
			Post: &model.Post{
				Message: "this is :emoji1",
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text:    ":emoji2:",
							Pretext: ":emoji2:",
							Fields: []*model.SlackAttachmentField{
								{
									Value: ":emoji3:",
								},
								{
									Value: ":emoji1:",
								},
							},
						},
					},
				},
			},
			Expected: []string{"emoji1", "emoji2", "emoji3"},
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			emojis := getEmojiNamesForPost(testCase.Post, testCase.Reactions)
			assert.ElementsMatch(t, emojis, testCase.Expected, "received incorrect emoji names")
		})
	}
}

func TestGetCustomEmojisForPost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableCustomEmoji = true
	})

	emojis := []*model.Emoji{
		th.CreateEmoji(),
		th.CreateEmoji(),
		th.CreateEmoji(),
		th.CreateEmoji(),
		th.CreateEmoji(),
		th.CreateEmoji(),
	}

	t.Run("from different parts of the post", func(t *testing.T) {
		reactions := []*model.Reaction{
			{
				UserId:    th.BasicUser.Id,
				EmojiName: emojis[0].Name,
			},
		}

		post := &model.Post{
			Message: ":" + emojis[1].Name + ":",
			Props: map[string]any{
				"attachments": []*model.SlackAttachment{
					{
						Pretext: ":" + emojis[2].Name + ":",
						Text:    ":" + emojis[3].Name + ":",
						Fields: []*model.SlackAttachmentField{
							{
								Value: ":" + emojis[4].Name + ":",
							},
							{
								Value: ":" + emojis[5].Name + ":",
							},
						},
					},
				},
			},
		}

		emojisForPost, err := th.App.getCustomEmojisForPost(th.Context, post, reactions)
		assert.Nil(t, err, "failed to get emojis for post")
		assert.ElementsMatch(t, emojisForPost, emojis, "received incorrect emojis")
	})

	t.Run("with emojis that don't exist", func(t *testing.T) {
		post := &model.Post{
			Message: ":secret: :" + emojis[0].Name + ":",
			Props: map[string]any{
				"attachments": []*model.SlackAttachment{
					{
						Text: ":imaginary:",
					},
				},
			},
		}

		emojisForPost, err := th.App.getCustomEmojisForPost(th.Context, post, nil)
		assert.Nil(t, err, "failed to get emojis for post")
		assert.ElementsMatch(t, emojisForPost, []*model.Emoji{emojis[0]}, "received incorrect emojis")
	})

	t.Run("with no emojis", func(t *testing.T) {
		post := &model.Post{
			Message: "this post is boring",
			Props:   map[string]any{},
		}

		emojisForPost, err := th.App.getCustomEmojisForPost(th.Context, post, nil)
		assert.Nil(t, err, "failed to get emojis for post")
		assert.ElementsMatch(t, emojisForPost, []*model.Emoji{}, "should have received no emojis")
	})
}

func TestGetFirstLinkAndImages(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
			ExpectedImages:    []string{"http://example.com/logo", "http://example.com/logo2", "http://example.com/logo2"},
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

[another page]: http://www.example.com/another_page`,
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
	} {
		t.Run(name, func(t *testing.T) {
			firstLink, images := th.App.getFirstLinkAndImages(testCase.Input)

			assert.Equal(t, firstLink, testCase.ExpectedFirstLink)
			assert.Equal(t, images, testCase.ExpectedImages)
		})
	}

	for name, testCase := range map[string]struct {
		Input             string
		ExpectedFirstLink string
		ExpectedImages    []string
	}{
		"http link domain is restricted": {
			Input:             "this is a http://example.com",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"http link domain is not restricted": {
			Input:             "this is a http://example1.com",
			ExpectedFirstLink: "http://example1.com",
			ExpectedImages:    []string{},
		},
		"www link domain is restricted": {
			Input:             "this is a www.example.com",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"image domain is restricted": {
			Input:             "this is a ![our logo](http://example.com/logo)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"image domain is not restricted": {
			Input:             "this is a ![our logo](http://example1.com/logo)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example1.com/logo"},
		},
		"multiple images is domain restricted": {
			Input:             "this is a ![our logo](http://example.com/logo) and ![their logo](http://example.com/logo2) and ![my logo](http://example.com/logo3)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"multiple images domain is not restricted": {
			Input:             "this is a ![our logo](http://example1.com/logo) and ![their logo](http://example1.com/logo2) and ![my logo](http://example1.com/logo3)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{"http://example1.com/logo", "http://example1.com/logo2", "http://example1.com/logo3"},
		},
		"multiple images with duplicate domain is restricted": {
			Input:             "this is a ![our logo](http://example.com/logo) and ![their logo](http://example.com/logo2) and ![my logo which is their logo](http://example.com/logo2)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"reference image domain is restricted": {
			Input: `this is a ![our logo][logo]

[logo]: http://example.com/logo`,
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"image and link domain is restricted": {
			Input:             "this is a https://example.com and ![our logo](https://example.com/logo)",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"test with denied domain as username, password": {
			Input:             "link as http://example.com:example.com@example1.com/link1",
			ExpectedFirstLink: "http://example.com:example.com@example1.com/link1",
			ExpectedImages:    []string{},
		},
		"test with URL encoded": {
			Input:             "link as https://example%E3%80%82com/link1",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
		"test with unicode": {
			Input:             "link as https://example。com/link1",
			ExpectedFirstLink: "",
			ExpectedImages:    []string{},
		},
	} {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.RestrictLinkPreviews = "example.com, test.com"
		})

		t.Run(name, func(t *testing.T) {
			firstLink, images := th.App.getFirstLinkAndImages(testCase.Input)

			assert.Equal(t, firstLink, testCase.ExpectedFirstLink)
			assert.Equal(t, images, testCase.ExpectedImages)
		})
	}
}

func TestGetImagesInMessageAttachments(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	for _, test := range []struct {
		Name     string
		Post     *model.Post
		Expected []string
	}{
		{
			Name:     "no attachments",
			Post:     &model.Post{},
			Expected: []string{},
		},
		{
			Name: "empty attachments",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{},
				},
			},
			Expected: []string{},
		},
		{
			Name: "attachment with no fields that can contain images",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Title: "This is the title",
						},
					},
				},
			},
			Expected: []string{},
		},
		{
			Name: "images in text",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text: "![logo](https://example.com/logo) and ![icon](https://example.com/icon)",
						},
					},
				},
			},
			Expected: []string{"https://example.com/logo", "https://example.com/icon"},
		},
		{
			Name: "images in pretext",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Pretext: "![logo](https://example.com/logo1) and ![icon](https://example.com/icon1)",
						},
					},
				},
			},
			Expected: []string{"https://example.com/logo1", "https://example.com/icon1"},
		},
		{
			Name: "images in fields",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Fields: []*model.SlackAttachmentField{
								{
									Value: "![logo](https://example.com/logo2) and ![icon](https://example.com/icon2)",
								},
							},
						},
					},
				},
			},
			Expected: []string{"https://example.com/logo2", "https://example.com/icon2"},
		},
		{
			Name: "image in author_icon",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							AuthorIcon: "https://example.com/icon2",
						},
					},
				},
			},
			Expected: []string{"https://example.com/icon2"},
		},
		{
			Name: "image in image_url",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							ImageURL: "https://example.com/image",
						},
					},
				},
			},
			Expected: []string{"https://example.com/image"},
		},
		{
			Name: "image in thumb_url",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							ThumbURL: "https://example.com/image",
						},
					},
				},
			},
			Expected: []string{"https://example.com/image"},
		},
		{
			Name: "image in footer_icon",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							FooterIcon: "https://example.com/image",
						},
					},
				},
			},
			Expected: []string{"https://example.com/image"},
		},
		{
			Name: "images in multiple fields",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Fields: []*model.SlackAttachmentField{
								{
									Value: "![logo](https://example.com/logo)",
								},
								{
									Value: "![icon](https://example.com/icon)",
								},
							},
						},
					},
				},
			},
			Expected: []string{"https://example.com/logo", "https://example.com/icon"},
		},
		{
			Name: "non-string field",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Fields: []*model.SlackAttachmentField{
								{
									Value: 77,
								},
							},
						},
					},
				},
			},
			Expected: []string{},
		},
		{
			Name: "images in multiple locations",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text:    "![text](https://example.com/text)",
							Pretext: "![pretext](https://example.com/pretext)",
							Fields: []*model.SlackAttachmentField{
								{
									Value: "![field1](https://example.com/field1)",
								},
								{
									Value: "![field2](https://example.com/field2)",
								},
							},
						},
					},
				},
			},
			Expected: []string{"https://example.com/text", "https://example.com/pretext", "https://example.com/field1", "https://example.com/field2"},
		},
		{
			Name: "multiple attachments",
			Post: &model.Post{
				Props: map[string]any{
					"attachments": []*model.SlackAttachment{
						{
							Text: "![logo](https://example.com/logo)",
						},
						{
							Text: "![icon](https://example.com/icon)",
						},
					},
				},
			},
			Expected: []string{"https://example.com/logo", "https://example.com/icon"},
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			images := th.App.getImagesInMessageAttachments(test.Post)

			assert.ElementsMatch(t, images, test.Expected)
		})
	}
}

func TestGetLinkMetadata(t *testing.T) {
	setup := func(t *testing.T) *TestHelper {
		th := Setup(t)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		})

		platform.PurgeLinkCache()

		return th
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		params := r.URL.Query()

		writeImage := func(height, width int) {

			img := image.NewGray(image.Rect(0, 0, height, width))

			var encoder png.Encoder

			encoder.Encode(w, img)
		}

		writeHTML := func(title string) {
			w.Header().Set("Content-Type", "text/html")

			w.Write([]byte(`
				<html prefix="og:http://ogp.me/ns#">
				<head>
				<meta property="og:title" content="` + title + `" />
				</head>
				<body>
				</body>
				</html>`))
		}

		if strings.HasPrefix(r.URL.Path, "/image") {
			height, _ := strconv.ParseInt(params["height"][0], 10, 0)
			width, _ := strconv.ParseInt(params["width"][0], 10, 0)

			writeImage(int(height), int(width))
		} else if strings.HasPrefix(r.URL.Path, "/opengraph") {
			writeHTML(params["title"][0])
		} else if strings.HasPrefix(r.URL.Path, "/json") {
			w.Header().Set("Content-Type", "application/json")

			w.Write([]byte("true"))
		} else if strings.HasPrefix(r.URL.Path, "/timeout") {
			w.Header().Set("Content-Type", "text/html")

			w.Write([]byte("<html>"))
			select {
			case <-time.After(60 * time.Second):
			case <-r.Context().Done():
			}
			w.Write([]byte("</html>"))
		} else if strings.HasPrefix(r.URL.Path, "/mixed") {
			for _, acceptedType := range r.Header["Accept"] {
				if strings.HasPrefix(acceptedType, "image/*") || strings.HasPrefix(acceptedType, "image/png") {
					writeImage(10, 10)
				} else if strings.HasPrefix(acceptedType, "text/html") {
					writeHTML("mixed")
				}
			}
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer server.Close()

	t.Run("in-memory cache", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/cached"
		timestamp := int64(1547510400000)
		title := "from cache"

		cacheLinkMetadata(requestURL, timestamp, &opengraph.OpenGraph{Title: title}, nil, nil)

		t.Run("should use cache if cached entry exists", func(t *testing.T) {
			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.True(t, ok, "data should already exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

			require.NotNil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
			assert.Equal(t, title, og.Title)
		})

		t.Run("should use cache if cached entry exists near time", func(t *testing.T) {
			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.True(t, ok, "data should already exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp+60*1000, false, "")

			require.NotNil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
			assert.Equal(t, title, og.Title)
		})

		t.Run("should not use cache if URL is different", func(t *testing.T) {
			differentURL := server.URL + "/other"

			_, _, _, ok := getLinkMetadataFromCache(differentURL, timestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(differentURL, timestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, differentURL, timestamp, false, "")

			assert.Nil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
		})

		t.Run("should not use cache if timestamp is different", func(t *testing.T) {
			differentTimestamp := timestamp + 60*60*1000

			_, _, _, ok := getLinkMetadataFromCache(requestURL, differentTimestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, differentTimestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, differentTimestamp, false, "")

			assert.Nil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
		})
	})

	t.Run("database cache", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL
		timestamp := int64(1547510400000)
		title := "from database"

		th.App.saveLinkMetadataToDatabase(requestURL, timestamp, &opengraph.OpenGraph{Title: title}, nil)

		t.Run("should use database if saved entry exists", func(t *testing.T) {
			platform.PurgeLinkCache()

			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
			require.True(t, ok, "data should already exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

			require.NotNil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
			assert.Equal(t, title, og.Title)
		})

		t.Run("should use database if saved entry exists near time", func(t *testing.T) {
			platform.PurgeLinkCache()

			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
			require.True(t, ok, "data should already exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp+60*1000, false, "")

			require.NotNil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
			assert.Equal(t, title, og.Title)
		})

		t.Run("should not use database if URL is different", func(t *testing.T) {
			platform.PurgeLinkCache()

			differentURL := requestURL + "/other"

			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(differentURL, timestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, differentURL, timestamp, false, "")

			assert.Nil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
		})

		t.Run("should not use database if timestamp is different", func(t *testing.T) {
			platform.PurgeLinkCache()

			differentTimestamp := timestamp + 60*60*1000

			_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
			require.False(t, ok, "data should not exist in in-memory cache")

			_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, differentTimestamp)
			require.False(t, ok, "data should not exist in database")

			og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, differentTimestamp, false, "")

			assert.Nil(t, og)
			assert.Nil(t, img)
			assert.NoError(t, err)
		})
	})

	t.Run("should get data from remote source", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/opengraph?title=Remote&name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.NotNil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should cache OpenGraph results", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/opengraph?title=Remote&name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.NotNil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)

		fromCache, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		assert.True(t, ok)
		assert.Exactly(t, og, fromCache)

		fromDatabase, _, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok)
		assert.Exactly(t, og, fromDatabase)
	})

	t.Run("should cache image results", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/image?height=300&width=400&name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.Nil(t, og)
		assert.NotNil(t, img)
		assert.NoError(t, err)

		_, fromCache, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		assert.True(t, ok)
		assert.Exactly(t, img, fromCache)

		_, fromDatabase, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok)
		assert.Exactly(t, img, fromDatabase)
	})

	t.Run("should cache general errors", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/error"
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)

		ogFromCache, imgFromCache, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromCache)
		assert.Nil(t, imgFromCache)

		ogFromDatabase, imageFromDatabase, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromDatabase)
		assert.Nil(t, imageFromDatabase)
	})

	t.Run("should cache invalid URL errors", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := "http://notarealdomainthatactuallyexists.ca/?name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.IsType(t, &url.Error{}, err)

		ogFromCache, imgFromCache, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromCache)
		assert.Nil(t, imgFromCache)

		ogFromDatabase, imageFromDatabase, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromDatabase)
		assert.Nil(t, imageFromDatabase)
	})

	t.Run("should cache timeout errors", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.LinkMetadataTimeoutMilliseconds = 100
		})

		requestURL := server.URL + "/timeout?name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")

		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.Error(t, err)
		assert.True(t, os.IsTimeout(err))

		ogFromCache, imgFromCache, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromCache)
		assert.Nil(t, imgFromCache)

		ogFromDatabase, imageFromDatabase, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok)
		assert.Nil(t, ogFromDatabase)
		assert.Nil(t, imageFromDatabase)
	})

	t.Run("should cache database results in memory", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/image?height=300&width=400&name=" + t.Name()
		timestamp := int64(1547510400000)

		_, _, _, ok := getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should not exist in in-memory cache")

		_, _, ok = th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		require.False(t, ok, "data should not exist in database")

		_, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")
		require.NoError(t, err)

		_, _, _, ok = getLinkMetadataFromCache(requestURL, timestamp)
		require.True(t, ok, "data should now exist in in-memory cache")

		platform.PurgeLinkCache()
		_, _, _, ok = getLinkMetadataFromCache(requestURL, timestamp)
		require.False(t, ok, "data should no longer exist in in-memory cache")

		_, fromDatabase, ok := th.App.getLinkMetadataFromDatabase(requestURL, timestamp)
		assert.True(t, ok, "data should be be in in-memory cache again")
		assert.Exactly(t, img, fromDatabase)
	})

	t.Run("should reject non-html, non-image response", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/json?name=" + t.Name()
		timestamp := int64(1547510400000)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")
		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should check in-memory cache for new post", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/error?name=" + t.Name()
		timestamp := int64(1547510400000)

		cacheLinkMetadata(requestURL, timestamp, &opengraph.OpenGraph{Title: "cached"}, nil, nil)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, true, "")
		assert.NotNil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should skip database cache for new post", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/error?name=" + t.Name()
		timestamp := int64(1547510400000)

		th.App.saveLinkMetadataToDatabase(requestURL, timestamp, &opengraph.OpenGraph{Title: "cached"}, nil)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, true, "")
		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should resolve relative URL", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		// Fake the SiteURL to have the relative URL resolve to the external server
		oldSiteURL := *th.App.Config().ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = oldSiteURL
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.SiteURL = server.URL
		})

		requestURL := "/image?height=200&width=300&name=" + t.Name()
		timestamp := int64(1547510400000)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")
		assert.Nil(t, og)
		assert.NotNil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should error on local addresses other than the image proxy", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		// Disable AllowedUntrustedInternalConnections since it's turned on for the previous tests
		oldAllowUntrusted := *th.App.Config().ServiceSettings.AllowedUntrustedInternalConnections
		oldSiteURL := *th.App.Config().ServiceSettings.SiteURL
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = oldAllowUntrusted
			*cfg.ServiceSettings.SiteURL = oldSiteURL
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
			*cfg.ServiceSettings.SiteURL = "http://mattermost.example.com"
			*cfg.ImageProxySettings.Enable = true
			*cfg.ImageProxySettings.ImageProxyType = "local"
		})

		requestURL := server.URL + "/image?height=200&width=300&name=" + t.Name()
		timestamp := int64(1547510400000)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")
		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.Error(t, err)
		assert.IsType(t, &url.Error{}, err)
		assert.Equal(t, httpservice.AddressForbidden, err.(*url.Error).Err)

		requestURL = th.App.GetSiteURL() + "/api/v4/image?url=" + url.QueryEscape(requestURL)

		// Note that this request still fails while testing because the request made by the image proxy is blocked
		og, img, _, err = th.App.getLinkMetadata(th.Context, requestURL, timestamp, false, "")
		assert.Nil(t, og)
		assert.Nil(t, img)
		assert.Error(t, err)
		assert.IsType(t, imageproxy.Error{}, err)
	})

	t.Run("should prefer images for mixed content", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		requestURL := server.URL + "/mixed?name=" + t.Name()
		timestamp := int64(1547510400000)

		og, img, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, true, "")
		assert.Nil(t, og)
		assert.NotNil(t, img)
		assert.NoError(t, err)
	})

	t.Run("should throw error if post doesn't exist", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnablePermalinkPreviews = true
			*cfg.ServiceSettings.SiteURL = server.URL
			cfg.FeatureFlags.PermalinkPreviews = true
		})

		requestURL := server.URL + "/pl/5rpoy4o3nbgwjm7gs4cm71h6ho"
		timestamp := int64(1547510400000)

		_, _, _, err := th.App.getLinkMetadata(th.Context, requestURL, timestamp, true, "")
		assert.Error(t, err)
	})
}

func TestResolveMetadataURL(t *testing.T) {
	for _, test := range []struct {
		Name       string
		RequestURL string
		SiteURL    string
		Expected   string
	}{
		{
			Name:       "with HTTPS",
			RequestURL: "https://example.com/file?param=1",
			Expected:   "https://example.com/file?param=1",
		},
		{
			Name:       "with HTTP",
			RequestURL: "http://example.com/file?param=1",
			Expected:   "http://example.com/file?param=1",
		},
		{
			Name:       "with FTP",
			RequestURL: "ftp://example.com/file?param=1",
			Expected:   "ftp://example.com/file?param=1",
		},
		{
			Name:       "relative to root",
			RequestURL: "/file?param=1",
			SiteURL:    "https://mattermost.example.com:123",
			Expected:   "https://mattermost.example.com:123/file?param=1",
		},
		{
			Name:       "relative to root with subpath",
			RequestURL: "/file?param=1",
			SiteURL:    "https://mattermost.example.com:123/subpath",
			Expected:   "https://mattermost.example.com:123/file?param=1",
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, resolveMetadataURL(test.RequestURL, test.SiteURL), test.Expected)
		})
	}
}

func TestParseLinkMetadata(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	imageURL := "http://example.com/test.png"
	file, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

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
		assert.NoError(t, err)

		assert.Nil(t, og)
		assert.Equal(t, &model.PostImage{
			Format: "png",
			Width:  408,
			Height: 336,
		}, dimensions)
	})

	t.Run("image with no content-type given", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(imageURL, makeImageReader(), "")
		assert.NoError(t, err)

		assert.Nil(t, og)
		assert.Equal(t, &model.PostImage{
			Format: "png",
			Width:  408,
			Height: 336,
		}, dimensions)
	})

	t.Run("malformed image", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(imageURL, makeOpenGraphReader(), "image/png")
		assert.Error(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})

	t.Run("opengraph", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(ogURL, makeOpenGraphReader(), "text/html; charset=utf-8")
		assert.NoError(t, err)

		assert.NotNil(t, og)
		assert.Equal(t, og.Title, "Hello, World!")
		assert.Equal(t, og.Type, "object")
		assert.Equal(t, og.URL, ogURL)
		assert.Nil(t, dimensions)
	})

	t.Run("malformed opengraph", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata(ogURL, makeImageReader(), "text/html; charset=utf-8")
		assert.NoError(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})

	t.Run("neither", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata("http://example.com/test.wad", strings.NewReader("garbage"), "application/x-doom")
		assert.NoError(t, err)

		assert.Nil(t, og)
		assert.Nil(t, dimensions)
	})

	t.Run("svg", func(t *testing.T) {
		og, dimensions, err := th.App.parseLinkMetadata("http://example.com/image.svg", nil, "image/svg+xml")
		assert.NoError(t, err)

		assert.Nil(t, og)
		assert.Equal(t, &model.PostImage{
			Format: "svg",
		}, dimensions)
	})
}

func TestParseImages(t *testing.T) {
	for name, testCase := range map[string]struct {
		FileName    string
		Expected    *model.PostImage
		ExpectError bool
	}{
		"png": {
			FileName: "test.png",
			Expected: &model.PostImage{
				Width:  408,
				Height: 336,
				Format: "png",
			},
		},
		"animated gif": {
			FileName: "testgif.gif",
			Expected: &model.PostImage{
				Width:      118,
				Height:     118,
				Format:     "gif",
				FrameCount: 4,
			},
		},
		"tiff": {
			FileName: "test.tiff",
			Expected: (*model.PostImage)(nil),
		},
		"not an image": {
			FileName:    "README.md",
			ExpectError: true,
		},
	} {
		t.Run(name, func(t *testing.T) {
			file, err := testutils.ReadTestFile(testCase.FileName)
			require.NoError(t, err)

			result, err := parseImages(bytes.NewReader(file))
			if testCase.ExpectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, testCase.Expected, result)
			}
		})
	}
}

func TestLooksLikeAPermalink(t *testing.T) {
	const siteURLWithSubpath = "http://localhost:8065/foo"
	const siteURLWithTrailingSlash = "http://test.com/"
	const siteURL = "http://test.com"
	tests := map[string]struct {
		input   string
		siteURL string
		expect  bool
	}{
		"happy path":                       {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", siteURLWithSubpath), siteURL: siteURLWithSubpath, expect: true},
		"looks nothing like a permalink":   {input: "foobar", siteURL: siteURLWithSubpath, expect: false},
		"link has no subpath":              {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", "http://localhost:8065"), siteURL: siteURLWithSubpath, expect: false},
		"without port":                     {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", "http://localhost/foo"), siteURL: siteURLWithSubpath, expect: false},
		"wrong port":                       {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", "http://localhost:8066"), siteURL: siteURLWithSubpath, expect: false},
		"invalid post ID length":           {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66", siteURLWithSubpath), siteURL: siteURLWithSubpath, expect: false},
		"invalid post ID character":        {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8$fbhwxf1jpag66r", siteURLWithSubpath), siteURL: siteURLWithSubpath, expect: false},
		"leading whitespace":               {input: fmt.Sprintf(" %s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", siteURLWithSubpath), siteURL: siteURLWithSubpath, expect: true},
		"trailing whitespace":              {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r ", siteURLWithSubpath), siteURL: siteURLWithSubpath, expect: true},
		"siteURL without a subpath":        {input: fmt.Sprintf("%sprivate-core/pl/dppezk51jp8afbhwxf1jpag66r", siteURLWithTrailingSlash), siteURL: siteURLWithTrailingSlash, expect: true},
		"siteURL without a trailing slash": {input: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", siteURL), siteURL: siteURL, expect: true},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			actual := looksLikeAPermalink(tc.input, tc.siteURL)
			assert.Equal(t, tc.expect, actual)
		})
	}
}

func TestContainsPermalink(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	const siteURLWithSubpath = "http://localhost:8065/foo"

	testCases := []struct {
		Description string
		Post        *model.Post
		Expected    bool
	}{
		{
			Description: "contains a permalink",
			Post: &model.Post{
				Message: fmt.Sprintf("%s/private-core/pl/dppezk51jp8afbhwxf1jpag66r", siteURLWithSubpath),
			},
			Expected: true,
		},
		{
			Description: "does not contain a permalink",
			Post: &model.Post{
				Message: "foobar",
			},
			Expected: false,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			actual := th.App.containsPermalink(testCase.Post)
			assert.Equal(t, testCase.Expected, actual)
		})
	}
}

func TestSanitizePostMetadataForUserAndChannel(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableLinkPreviews = true
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
	})

	directChannel, err := th.App.createDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
	assert.Nil(t, err)

	userID := model.NewId()
	post := &model.Post{
		Id: userID,
		Metadata: &model.PostMetadata{
			Embeds: []*model.PostEmbed{
				{
					Type: model.PostEmbedOpengraph,
					URL:  "ogURL",
					Data: &opengraph.OpenGraph{
						Images: []*ogimage.Image{
							{
								URL: "imageURL",
							},
						},
					},
				},
			},
		},
	}

	hasChange := th.App.shouldSanitizePostMetadataForUserAndChannel(th.Context, post, directChannel, th.BasicUser2.Id)
	assert.False(t, hasChange)

	guestID := model.NewId()
	guest := &model.User{
		Email:         "success+" + guestID + "@simulator.amazonses.com",
		Username:      "un_" + guestID,
		Nickname:      "nn_" + guestID,
		Password:      "Password1",
		EmailVerified: true,
	}
	guest, appErr := th.App.CreateGuest(th.Context, guest)
	require.Nil(t, appErr)

	hasChange = th.App.shouldSanitizePostMetadataForUserAndChannel(th.Context, post, directChannel, guest.Id)
	assert.True(t, hasChange)
}

func TestSanitizePostMetaDataForAudit(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
	})

	th.Context.Session().UserId = th.BasicUser.Id

	referencedPost, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "hello world",
	}, th.BasicChannel, false, true)
	require.Nil(t, err)
	referencedPost.Metadata.Embeds = nil

	link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, referencedPost.Id)

	previewPost, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   link,
	}, th.BasicChannel, false, true)
	require.Nil(t, err)
	previewPost.Metadata.Embeds = nil
	clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, previewPost, false, false, false)
	firstEmbed := clientPost.Metadata.Embeds[0]
	preview := firstEmbed.Data.(*model.PreviewPost)
	require.Equal(t, referencedPost.Id, preview.PostID)

	// ensure the permalink metadata is sanitized for audit logging
	m := clientPost.Auditable()
	metaDataI, ok := m["metadata"]
	require.True(t, ok)
	metaData, ok := metaDataI.(map[string]any)
	require.True(t, ok)
	embedsI, ok := metaData["embeds"]
	require.True(t, ok)
	embeds, ok := embedsI.([]map[string]any)
	require.True(t, ok)
	for _, pe := range embeds {
		// ensure all the PostEmbed maps only contain `type` and `url`
		for k := range pe {
			if k != "type" && k != "url" {
				require.Fail(t, "PostEmbed should only contain 'type' and 'url fields'")
			}
		}
	}
}
