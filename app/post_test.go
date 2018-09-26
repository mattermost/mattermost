// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/storetest"
)

func TestUpdatePostEditAt(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := &model.Post{}
	*post = *th.BasicPost

	post.IsPinned = true
	if saved, err := th.App.UpdatePost(post, true); err != nil {
		t.Fatal(err)
	} else if saved.EditAt != post.EditAt {
		t.Fatal("shouldn't have updated post.EditAt when pinning post")

		*post = *saved
	}

	time.Sleep(time.Millisecond * 100)

	post.Message = model.NewId()
	if saved, err := th.App.UpdatePost(post, true); err != nil {
		t.Fatal(err)
	} else if saved.EditAt == post.EditAt {
		t.Fatal("should have updated post.EditAt when updating post message")
	}

	time.Sleep(time.Millisecond * 200)
}

func TestUpdatePostTimeLimit(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := &model.Post{}
	*post = *th.BasicPost

	th.App.SetLicense(model.NewTestLicense())

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = -1
	})
	if _, err := th.App.UpdatePost(post, true); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1000000000
	})
	post.Message = model.NewId()
	if _, err := th.App.UpdatePost(post, true); err != nil {
		t.Fatal("should allow you to edit the post")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = 1
	})
	post.Message = model.NewId()
	if _, err := th.App.UpdatePost(post, true); err == nil {
		t.Fatal("should fail on update old post")
	}

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.PostEditTimeLimit = -1
	})
}

func TestPostReplyToPostWhereRootPosterLeftChannel(t *testing.T) {
	// This test ensures that when replying to a root post made by a user who has since left the channel, the reply
	// post completes successfully. This is a regression test for PLT-6523.
	th := Setup().InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	userInChannel := th.BasicUser2
	userNotInChannel := th.BasicUser
	rootPost := th.BasicPost

	if _, err := th.App.AddUserToChannel(userInChannel, channel); err != nil {
		t.Fatal(err)
	}

	if err := th.App.RemoveUserFromChannel(userNotInChannel.Id, "", channel); err != nil {
		t.Fatal(err)
	}

	replyPost := model.Post{
		Message:       "asd",
		ChannelId:     channel.Id,
		RootId:        rootPost.Id,
		ParentId:      rootPost.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userInChannel.Id,
		CreateAt:      0,
	}

	if _, err := th.App.CreatePostAsUser(&replyPost, false); err != nil {
		t.Fatal(err)
	}
}

func TestPostAction(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost 127.0.0.1"
	})

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request := model.PostActionIntegrationRequesteFromJson(r.Body)
		assert.NotNil(t, request)

		assert.Equal(t, request.UserId, th.BasicUser.Id)
		assert.Equal(t, request.ChannelId, th.BasicChannel.Id)
		assert.Equal(t, request.TeamId, th.BasicTeam.Id)
		if request.Type == model.POST_ACTION_TYPE_SELECT {
			assert.Equal(t, request.DataSource, "some_source")
			assert.Equal(t, request.Context["selected_option"], "selected")
		} else {
			assert.Equal(t, request.DataSource, "")
		}
		assert.Equal(t, "foo", request.Context["s"])
		assert.EqualValues(t, 3, request.Context["n"])
		fmt.Fprintf(w, `{"post": {"message": "updated"}, "ephemeral_text": "foo"}`)
	}))
	defer ts.Close()

	interactivePost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL,
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	post, err := th.App.CreatePostAsUser(&interactivePost, false)
	require.Nil(t, err)

	attachments, ok := post.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	require.NotEmpty(t, attachments[0].Actions)
	require.NotEmpty(t, attachments[0].Actions[0].Id)

	menuPost := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL,
							},
							Name:       "action",
							Type:       model.POST_ACTION_TYPE_SELECT,
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	post2, err := th.App.CreatePostAsUser(&menuPost, false)
	require.Nil(t, err)

	attachments2, ok := post2.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	require.NotEmpty(t, attachments2[0].Actions)
	require.NotEmpty(t, attachments2[0].Actions[0].Id)

	err = th.App.DoPostAction(post.Id, "notavalidid", th.BasicUser.Id, "")
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)

	err = th.App.DoPostAction(post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	err = th.App.DoPostAction(post2.Id, attachments2[0].Actions[0].Id, th.BasicUser.Id, "selected")
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = ""
	})

	err = th.App.DoPostAction(post.Id, attachments[0].Actions[0].Id, th.BasicUser.Id, "")
	require.NotNil(t, err)
	require.True(t, strings.Contains(err.Error(), "address forbidden"))

	interactivePostPlugin := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL + "/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postplugin, err := th.App.CreatePostAsUser(&interactivePostPlugin, false)
	require.Nil(t, err)

	attachmentsPlugin, ok := postplugin.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	err = th.App.DoPostAction(postplugin.Id, attachmentsPlugin[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://127.1.1.1"
	})

	interactivePostSiteURL := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: "http://127.1.1.1/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postSiteURL, err := th.App.CreatePostAsUser(&interactivePostSiteURL, false)
	require.Nil(t, err)

	attachmentsSiteURL, ok := postSiteURL.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	err = th.App.DoPostAction(postSiteURL.Id, attachmentsSiteURL[0].Actions[0].Id, th.BasicUser.Id, "")
	require.NotNil(t, err)
	require.False(t, strings.Contains(err.Error(), "address forbidden"))

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = ts.URL + "/subpath"
	})

	interactivePostSubpath := model.Post{
		Message:       "Interactive post",
		ChannelId:     th.BasicChannel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        th.BasicUser.Id,
		Props: model.StringInterface{
			"attachments": []*model.SlackAttachment{
				{
					Text: "hello",
					Actions: []*model.PostAction{
						{
							Integration: &model.PostActionIntegration{
								Context: model.StringInterface{
									"s": "foo",
									"n": 3,
								},
								URL: ts.URL + "/subpath/plugins/myplugin/myaction",
							},
							Name:       "action",
							Type:       "some_type",
							DataSource: "some_source",
						},
					},
				},
			},
		},
	}

	postSubpath, err := th.App.CreatePostAsUser(&interactivePostSubpath, false)
	require.Nil(t, err)

	attachmentsSubpath, ok := postSubpath.Props["attachments"].([]*model.SlackAttachment)
	require.True(t, ok)

	err = th.App.DoPostAction(postSubpath.Id, attachmentsSubpath[0].Actions[0].Id, th.BasicUser.Id, "")
	require.Nil(t, err)
}

func TestPostChannelMentions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	channel := th.BasicChannel
	user := th.BasicUser

	channelToMention, err := th.App.CreateChannel(&model.Channel{
		DisplayName: "Mention Test",
		Name:        "mention-test",
		Type:        model.CHANNEL_OPEN,
		TeamId:      th.BasicTeam.Id,
	}, false)
	if err != nil {
		t.Fatal(err.Error())
	}
	defer th.App.PermanentDeleteChannel(channelToMention)

	_, err = th.App.AddUserToChannel(user, channel)
	require.Nil(t, err)

	post := &model.Post{
		Message:       fmt.Sprintf("hello, ~%v!", channelToMention.Name),
		ChannelId:     channel.Id,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        user.Id,
		CreateAt:      0,
	}

	result, err := th.App.CreatePostAsUser(post, false)
	require.Nil(t, err)
	assert.Equal(t, map[string]interface{}{
		"mention-test": map[string]interface{}{
			"display_name": "Mention Test",
		},
	}, result.Props["channel_mentions"])

	post.Message = fmt.Sprintf("goodbye, ~%v!", channelToMention.Name)
	result, err = th.App.UpdatePost(post, false)
	require.Nil(t, err)
	assert.Equal(t, map[string]interface{}{
		"mention-test": map[string]interface{}{
			"display_name": "Mention Test",
		},
	}, result.Props["channel_mentions"])
}

func TestImageProxy(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
	})

	for name, tc := range map[string]struct {
		ProxyType       string
		ProxyURL        string
		ProxyOptions    string
		ImageURL        string
		ProxiedImageURL string
	}{
		"atmos/camo": {
			ProxyType:       "atmos/camo",
			ProxyURL:        "https://127.0.0.1",
			ProxyOptions:    "foo",
			ImageURL:        "http://mydomain.com/myimage",
			ProxiedImageURL: "https://127.0.0.1/f8dace906d23689e8d5b12c3cefbedbf7b9b72f5/687474703a2f2f6d79646f6d61696e2e636f6d2f6d79696d616765",
		},
		"atmos/camo_SameSite": {
			ProxyType:       "atmos/camo",
			ProxyURL:        "https://127.0.0.1",
			ProxyOptions:    "foo",
			ImageURL:        "http://mymattermost.com/myimage",
			ProxiedImageURL: "http://mymattermost.com/myimage",
		},
		"atmos/camo_PathOnly": {
			ProxyType:       "atmos/camo",
			ProxyURL:        "https://127.0.0.1",
			ProxyOptions:    "foo",
			ImageURL:        "/myimage",
			ProxiedImageURL: "/myimage",
		},
		"atmos/camo_EmptyImageURL": {
			ProxyType:       "atmos/camo",
			ProxyURL:        "https://127.0.0.1",
			ProxyOptions:    "foo",
			ImageURL:        "",
			ProxiedImageURL: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) {
				cfg.ServiceSettings.ImageProxyType = model.NewString(tc.ProxyType)
				cfg.ServiceSettings.ImageProxyOptions = model.NewString(tc.ProxyOptions)
				cfg.ServiceSettings.ImageProxyURL = model.NewString(tc.ProxyURL)
			})

			post := &model.Post{
				Id:      model.NewId(),
				Message: "![foo](" + tc.ImageURL + ")",
			}

			list := model.NewPostList()
			list.Posts[post.Id] = post

			assert.Equal(t, "![foo]("+tc.ProxiedImageURL+")", th.App.PostListWithProxyAddedToImageURLs(list).Posts[post.Id].Message)
			assert.Equal(t, "![foo]("+tc.ProxiedImageURL+")", th.App.PostWithProxyAddedToImageURLs(post).Message)

			assert.Equal(t, "![foo]("+tc.ImageURL+")", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
			post.Message = "![foo](" + tc.ProxiedImageURL + ")"
			assert.Equal(t, "![foo]("+tc.ImageURL+")", th.App.PostWithProxyRemovedFromImageURLs(post).Message)

			if tc.ImageURL != "" {
				post.Message = "![foo](" + tc.ImageURL + " =500x200)"
				assert.Equal(t, "![foo]("+tc.ProxiedImageURL+" =500x200)", th.App.PostWithProxyAddedToImageURLs(post).Message)
				assert.Equal(t, "![foo]("+tc.ImageURL+" =500x200)", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
				post.Message = "![foo](" + tc.ProxiedImageURL + " =500x200)"
				assert.Equal(t, "![foo]("+tc.ImageURL+" =500x200)", th.App.PostWithProxyRemovedFromImageURLs(post).Message)
			}
		})
	}
}

func BenchmarkForceHTMLEncodingToUTF8(b *testing.B) {
	HTML := `
		<html>
			<head>
				<meta property="og:url" content="https://example.com/apps/mattermost">
				<meta property="og:image" content="https://images.example.com/image.png">
			</head>
		</html>
	`
	ContentType := "text/html; utf-8"

	b.Run("with converting", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			r := forceHTMLEncodingToUTF8(strings.NewReader(HTML), ContentType)

			og := opengraph.NewOpenGraph()
			og.ProcessHTML(r)
		}
	})

	b.Run("without converting", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			og := opengraph.NewOpenGraph()
			og.ProcessHTML(strings.NewReader(HTML))
		}
	})
}

func TestMakeOpenGraphURLsAbsolute(t *testing.T) {
	for name, tc := range map[string]struct {
		HTML       string
		RequestURL string
		URL        string
		ImageURL   string
	}{
		"absolute URLs": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="https://example.com/apps/mattermost">
						<meta property="og:image" content="https://images.example.com/image.png">
					</head>
				</html>`,
			RequestURL: "https://example.com",
			URL:        "https://example.com/apps/mattermost",
			ImageURL:   "https://images.example.com/image.png",
		},
		"URLs starting with /": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
						<meta property="og:image" content="/image.png">
					</head>
				</html>`,
			RequestURL: "http://example.com",
			URL:        "http://example.com/apps/mattermost",
			ImageURL:   "http://example.com/image.png",
		},
		"HTTPS URLs starting with /": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
						<meta property="og:image" content="/image.png">
					</head>
				</html>`,
			RequestURL: "https://example.com",
			URL:        "https://example.com/apps/mattermost",
			ImageURL:   "https://example.com/image.png",
		},
		"missing image URL": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="/apps/mattermost">
					</head>
				</html>`,
			RequestURL: "http://example.com",
			URL:        "http://example.com/apps/mattermost",
			ImageURL:   "",
		},
		"relative URLs": {
			HTML: `
				<html>
					<head>
						<meta property="og:url" content="index.html">
						<meta property="og:image" content="../resources/image.png">
					</head>
				</html>`,
			RequestURL: "http://example.com/content/index.html",
			URL:        "http://example.com/content/index.html",
			ImageURL:   "http://example.com/resources/image.png",
		},
	} {
		t.Run(name, func(t *testing.T) {
			og := opengraph.NewOpenGraph()
			if err := og.ProcessHTML(strings.NewReader(tc.HTML)); err != nil {
				t.Fatal(err)
			}

			makeOpenGraphURLsAbsolute(og, tc.RequestURL)

			if og.URL != tc.URL {
				t.Fatalf("incorrect url, expected %v, got %v", tc.URL, og.URL)
			}

			if len(og.Images) > 0 {
				if og.Images[0].URL != tc.ImageURL {
					t.Fatalf("incorrect image url, expected %v, got %v", tc.ImageURL, og.Images[0].URL)
				}
			} else if tc.ImageURL != "" {
				t.Fatalf("missing image url, expected %v, got nothing", tc.ImageURL)
			}
		})
	}
}

func TestMaxPostSize(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		Description         string
		StoreMaxPostSize    int
		ExpectedMaxPostSize int
		ExpectedError       *model.AppError
	}{
		{
			"error fetching max post size",
			0,
			model.POST_MESSAGE_MAX_RUNES_V1,
			model.NewAppError("TestMaxPostSize", "this is an error", nil, "", http.StatusBadRequest),
		},
		{
			"4000 rune limit",
			4000,
			4000,
			nil,
		},
		{
			"16383 rune limit",
			16383,
			16383,
			nil,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			mockStore := &storetest.Store{}
			defer mockStore.AssertExpectations(t)

			mockStore.PostStore.On("GetMaxPostSize").Return(
				storetest.NewStoreChannel(store.StoreResult{
					Data: testCase.StoreMaxPostSize,
					Err:  testCase.ExpectedError,
				}),
			)

			app := App{
				Srv: &Server{
					Store: mockStore,
				},
				config: atomic.Value{},
			}

			assert.Equal(t, testCase.ExpectedMaxPostSize, app.MaxPostSize())
		})
	}
}
