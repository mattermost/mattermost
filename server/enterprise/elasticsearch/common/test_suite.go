// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"encoding/json"
	"time"

	"github.com/elastic/go-elasticsearch/v8/typedapi/types"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchtest"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"

	"github.com/stretchr/testify/suite"
)

type CommonTestSuite struct {
	suite.Suite

	TH             *api4.TestHelper
	ESImpl         searchengine.SearchEngineInterface
	GetDocumentFn  func(index, documentID string) (bool, json.RawMessage, error)
	CreateIndexFn  func(index string) error
	GetIndexFn     func(indexPattern string) ([]string, error)
	RefreshIndexFn func() error
}

func (c *CommonTestSuite) TestSearchStore() {
	searchTestEngine := &searchtest.SearchTestEngine{
		Driver: searchtest.EngineElasticSearch,
	}

	c.Run("TestSearchChannelStore", func() {
		searchtest.TestSearchChannelStore(c.T(), c.TH.App.Srv().Store(), searchTestEngine)
	})

	c.Run("TestSearchUserStore", func() {
		searchtest.TestSearchUserStore(c.T(), c.TH.App.Srv().Store(), searchTestEngine)
	})

	c.Run("TestSearchPostStore", func() {
		searchtest.TestSearchPostStore(c.T(), c.TH.App.Srv().Store(), searchTestEngine)
	})

	c.Run("TestSearchFileInfoStore", func() {
		searchtest.TestSearchFileInfoStore(c.T(), c.TH.App.Srv().Store(), searchTestEngine)
	})
}

func (c *CommonTestSuite) TestIndexPost() {
	testCases := []struct {
		Name                string
		Message             string
		Hashtags            string
		ExpectedAttachments string
		ExpectedHashtags    []string
		ExpectedURLs        []string
	}{
		{
			Name:                "Should be able to index a plain message",
			Message:             "Test message 1 2 3",
			ExpectedAttachments: "",
			ExpectedHashtags:    []string{},
			ExpectedURLs:        []string(nil),
		},
		{
			Name:                "Should be able to index hashtags",
			Message:             "Test message #1234",
			Hashtags:            "#1234",
			ExpectedAttachments: "",
			ExpectedHashtags:    []string{"#1234"},
			ExpectedURLs:        []string(nil),
		},
		// TODO: actually send attachments
		{
			Name:                "Should be able to index attachments",
			Message:             "Test message 1 2 3",
			ExpectedAttachments: "",
			ExpectedHashtags:    []string{},
			ExpectedURLs:        []string(nil),
		},
		{
			Name:                "Should be able to index urls",
			Message:             "Test message www.mattermost.com http://www.mattermost.com [link](http://www.notindexed.com)",
			ExpectedAttachments: "",
			ExpectedHashtags:    []string{},
			ExpectedURLs:        []string{"www.mattermost.com", "http://www.mattermost.com"},
		},
	}

	for _, tc := range testCases {
		c.Run(tc.Name, func() {
			post := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, tc.Message)
			if tc.Hashtags != "" {
				post.Hashtags = tc.Hashtags
			}
			c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))

			c.NoError(c.RefreshIndexFn())
			indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
				IndexBasePosts,
				IndexBasePosts_MONTH,
				time.Now(),
				post.CreateAt,
			)

			found, source, err := c.GetDocumentFn(indexName, post.Id)
			c.NoError(err)
			c.True(found)

			var esPost ESPost
			err = json.Unmarshal(source, &esPost)
			c.NoError(err)
			c.NotNil(post)
			c.Equal(tc.Message, post.Message)
			c.Equal(tc.ExpectedAttachments, esPost.Attachments)
			c.Equal(tc.ExpectedHashtags, esPost.Hashtags)
			c.Equal(tc.ExpectedURLs, esPost.URLs)
		})
	}
}

func (c *CommonTestSuite) TestSearchPosts() {
	// Create and index a post
	post := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, model.NewId())
	c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))

	c.NoError(c.RefreshIndexFn())
	indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays, IndexBasePosts, IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	// Check the post is there.
	found, _, err := c.GetDocumentFn(indexName, post.Id)
	c.NoError(err)
	c.True(found)

	// Do a search for that post.
	channels := model.ChannelList{
		c.TH.BasicChannel,
	}

	searchParams := []*model.SearchParams{
		{
			Terms:     post.Message,
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	// Check the post is found as expected
	ids, matches, err := c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
	c.Nil(err)
	c.Len(ids, 1)
	c.Equal(ids[0], post.Id)
	CheckMatchesEqual(c.T(), map[string][]string{
		post.Id: {post.Message},
	}, matches)

	// Do a search that won't match anything.
	searchParams = []*model.SearchParams{
		{
			Terms:     model.NewId(),
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	ids, matches, err = c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
	c.Nil(err)
	c.Len(ids, 0)
	c.Len(matches, 0)
}

func (c *CommonTestSuite) TestDeletePost() {
	c.Require().NotNil(c.TH)

	post := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, model.NewId())
	indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays, IndexBasePosts, IndexBasePosts_MONTH, time.Now(), post.CreateAt)

	// Index the post.
	c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))
	c.NoError(c.RefreshIndexFn())

	// Check the post is there.
	found, _, err := c.GetDocumentFn(indexName, post.Id)
	c.NoError(err)
	c.True(found)

	// Delete the post.
	c.Nil(c.ESImpl.DeletePost(post))
	c.NoError(c.RefreshIndexFn())

	// Check the post is not there.
	found, _, err = c.GetDocumentFn(indexName, post.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestDeleteChannelPosts() {
	c.Run("Should remove all the channel posts", func() {
		channelPosts := make([]*model.Post, 0)
		post := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, model.NewId())
		channelPosts = append(channelPosts, post)
		post2 := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel.Id, model.NewId())
		post2.CreateAt = 1200000
		channelPosts = append(channelPosts, post2)
		post3 := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel.Id, model.NewId())
		post3.CreateAt = 1300000
		channelPosts = append(channelPosts, post3)
		postReply := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel.Id, model.NewId())
		postReply.RootId = post.Id
		postReply.CreateAt = 1400000
		channelPosts = append(channelPosts, postReply)
		anotherPost := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel2.Id, model.NewId())
		indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			IndexBasePosts, IndexBasePosts_MONTH, time.Now(), post.CreateAt)
		for _, post := range channelPosts {
			c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))
		}
		c.Nil(c.ESImpl.IndexPost(anotherPost, c.TH.BasicTeam.Id))
		c.NoError(c.RefreshIndexFn())
		for _, post := range channelPosts {
			found, _, err := c.GetDocumentFn(indexName, post.Id)
			c.NoError(err)
			c.True(found)
		}
		c.Nil(c.ESImpl.DeleteChannelPosts(c.TH.Context, c.TH.BasicChannel.Id))
		c.NoError(c.RefreshIndexFn())
		for _, post := range channelPosts {
			found, _, err := c.GetDocumentFn(indexName, post.Id)
			// This is a difference in behavior between engines.
			if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
				c.Error(err)
			} else {
				c.NoError(err)
			}
			c.False(found)
		}

		found, _, err := c.GetDocumentFn(indexName, anotherPost.Id)
		c.NoError(err)
		c.True(found)
	})

	c.Run("Should not remove other channels posts even if there was no posts to remove", func() {
		postNotInChannel := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel2.Id, model.NewId())
		indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			IndexBasePosts, IndexBasePosts_MONTH, time.Now(), postNotInChannel.CreateAt)
		c.Nil(c.ESImpl.IndexPost(postNotInChannel, c.TH.BasicTeam.Id))
		c.NoError(c.RefreshIndexFn())
		c.Nil(c.ESImpl.DeleteChannelPosts(c.TH.Context, c.TH.BasicChannel.Id))
		c.NoError(c.RefreshIndexFn())

		found, _, err := c.GetDocumentFn(indexName, postNotInChannel.Id)
		c.NoError(err)
		c.True(found)
	})
}

func (c *CommonTestSuite) TestDeleteUserPosts() {
	c.Run("Should remove all the user posts", func() {
		anotherTeam := c.TH.CreateTeam()
		anotherTeamChannel := createChannel(anotherTeam.Id, "anotherteamchannel", "", model.ChannelTypeOpen)
		userPosts := make([]*model.Post, 0)
		post := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, model.NewId())
		userPosts = append(userPosts, post)
		post2 := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel2.Id, model.NewId())
		post2.CreateAt = 1200000
		userPosts = append(userPosts, post2)
		post3 := createPost(c.TH.BasicUser.Id, c.TH.BasicPrivateChannel.Id, model.NewId())
		post3.CreateAt = 1300000
		userPosts = append(userPosts, post3)
		postReply := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, model.NewId())
		postReply.RootId = post.Id
		postReply.CreateAt = 1400000
		userPosts = append(userPosts, postReply)
		postAnotherTeam := createPost(c.TH.BasicUser.Id, anotherTeamChannel.Id, model.NewId())
		postAnotherTeam.CreateAt = 1400000
		userPosts = append(userPosts, postAnotherTeam)
		anotherPost := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel2.Id, model.NewId())
		indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			IndexBasePosts, IndexBasePosts_MONTH, time.Now(), post.CreateAt)
		for _, post := range userPosts {
			c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))
		}
		c.Nil(c.ESImpl.IndexPost(postAnotherTeam, anotherTeam.Id))
		c.Nil(c.ESImpl.IndexPost(anotherPost, c.TH.BasicTeam.Id))
		c.NoError(c.RefreshIndexFn())
		for _, post := range userPosts {
			found, _, err := c.GetDocumentFn(indexName, post.Id)
			c.NoError(err)
			c.True(found)
		}
		c.Nil(c.ESImpl.DeleteUserPosts(c.TH.Context, c.TH.BasicUser.Id))
		c.NoError(c.RefreshIndexFn())
		for _, post := range userPosts {
			found, _, err := c.GetDocumentFn(indexName, post.Id)
			// This is a difference in behavior between engines.
			if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
				c.Error(err)
			} else {
				c.NoError(err)
			}
			c.False(found)
		}
		found, _, err := c.GetDocumentFn(indexName, anotherPost.Id)
		c.NoError(err)
		c.True(found)
	})

	c.Run("Should not remove other channels posts even if there was no posts to remove", func() {
		postNotInChannel := createPost(c.TH.BasicUser2.Id, c.TH.BasicChannel.Id, model.NewId())
		indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			IndexBasePosts, IndexBasePosts_MONTH, time.Now(), postNotInChannel.CreateAt)
		c.Nil(c.ESImpl.IndexPost(postNotInChannel, c.TH.BasicTeam.Id))
		c.NoError(c.RefreshIndexFn())
		c.Nil(c.ESImpl.DeleteUserPosts(c.TH.Context, c.TH.BasicUser.Id))
		c.NoError(c.RefreshIndexFn())
		found, _, err := c.GetDocumentFn(indexName, postNotInChannel.Id)
		c.NoError(err)
		c.True(found)
	})
}

func (c *CommonTestSuite) TestIndexChannel() {
	// Create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	c.NoError(c.RefreshIndexFn())

	// Check the channel is there.
	found, _, err := c.GetDocumentFn(IndexBaseChannels, channel.Id)
	c.NoError(err)
	c.True(found)
}

func (c *CommonTestSuite) TestDeleteChannel() {
	// Create and index a channel.
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	c.NoError(c.RefreshIndexFn())

	// Check the channel is there.
	found, _, err := c.GetDocumentFn(IndexBaseChannels, channel.Id)
	c.NoError(err)
	c.True(found)

	// Delete the channel.
	c.Nil(c.ESImpl.DeleteChannel(channel))
	c.NoError(c.RefreshIndexFn())

	// Check the channel is not there.
	found, _, err = c.GetDocumentFn(IndexBaseChannels, channel.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestIndexUser() {
	// Create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{}, []string{}))

	c.NoError(c.RefreshIndexFn())

	// Check the user is there.
	found, _, err := c.GetDocumentFn(IndexBaseUsers, user.Id)
	c.NoError(err)
	c.True(found)
}

func (c *CommonTestSuite) TestSearchUsersInChannel() {
	// Create test channels
	channel1 := createChannel(c.TH.BasicTeam.Id, "channel1", "Test Channel 1", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel1, []string{}, []string{}))

	channel2 := createChannel(c.TH.BasicTeam.Id, "channel2", "Test Channel 2", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel2, []string{}, []string{}))

	// Create and index users with different channel memberships
	user1 := createUser("test.user1", "testuser1", "Test", "User1")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user1, []string{c.TH.BasicTeam.Id}, []string{channel1.Id}))

	user2 := createUser("test.user2", "testuser2", "Test", "User2")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user2, []string{c.TH.BasicTeam.Id}, []string{channel1.Id, channel2.Id}))

	user3 := createUser("test.user3", "testuser3", "Another", "User3")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user3, []string{c.TH.BasicTeam.Id}, []string{channel2.Id}))

	// Wait for indexing to complete
	c.NoError(c.RefreshIndexFn())

	// Search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	c.Run("All users in channel1", func() {
		// Test 1: Search for all users in channel1
		inChannel, notInChannel, err := c.ESImpl.SearchUsersInChannel(c.TH.BasicTeam.Id, channel1.Id, nil, "", options)
		c.Nil(err)
		c.Len(inChannel, 2)
		c.Contains(inChannel, user1.Id)
		c.Contains(inChannel, user2.Id)
		c.Len(notInChannel, 1)
		c.Contains(notInChannel, user3.Id)
	})

	c.Run("Search for specific user in channel1", func() {
		// Test 2: Search with term that should match user1 in channel1
		inChannel, notInChannel, err := c.ESImpl.SearchUsersInChannel(c.TH.BasicTeam.Id, channel1.Id, nil, "testuser1", options)
		c.Nil(err)
		c.Len(inChannel, 1)
		c.Contains(inChannel, user1.Id)
		c.Empty(notInChannel)
	})

	c.Run("Search with restricted channels", func() {
		// Test 3: Search with restrictedToChannels, user3 should be in notInChannel
		restrictedToChannels := []string{channel2.Id}
		inChannel, notInChannel, err := c.ESImpl.SearchUsersInChannel(c.TH.BasicTeam.Id, channel1.Id, restrictedToChannels, "", options)
		c.Nil(err)
		c.Len(inChannel, 2)
		c.Contains(inChannel, user1.Id)
		c.Contains(inChannel, user2.Id)
		c.Len(notInChannel, 1)
		c.Contains(notInChannel, user3.Id) // user3 is in channel2 but not channel1
	})

	c.Run("Search with term in restricted channels", func() {
		// Test 4: Search with a term in restrictedToChannels
		restrictedToChannels := []string{channel2.Id}
		inChannel, notInChannel, err := c.ESImpl.SearchUsersInChannel(c.TH.BasicTeam.Id, channel1.Id, restrictedToChannels, "another", options)
		c.Nil(err)
		c.Empty(inChannel) // No users in channel1 match "another"
		c.Len(notInChannel, 1)
		c.Contains(notInChannel, user3.Id) // user3's name contains "Another" and is in channel2
	})

	c.Run("Search with empty restricted channels", func() {
		// Test 5: Search with restrictedToChannels but empty (should return no results)
		emptyRestricted := []string{}
		inChannel, notInChannel, err := c.ESImpl.SearchUsersInChannel(c.TH.BasicTeam.Id, channel1.Id, emptyRestricted, "", options)
		c.Nil(err)
		c.Empty(inChannel)
		c.Empty(notInChannel)
	})

	// Clean up
	c.Nil(c.ESImpl.DeleteUser(user1))
	c.Nil(c.ESImpl.DeleteUser(user2))
	c.Nil(c.ESImpl.DeleteUser(user3))
	c.Nil(c.ESImpl.DeleteChannel(channel1))
	c.Nil(c.ESImpl.DeleteChannel(channel2))
}

func (c *CommonTestSuite) TestSearchUsersInTeam() {
	// Create additional teams
	team1 := c.TH.CreateTeam()
	team2 := c.TH.CreateTeam()

	// Create and index users with different team memberships
	user1 := createUser("test.user1", "testuser1", "Test", "User1")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user1, []string{team1.Id}, []string{}))

	user2 := createUser("test.user2", "testuser2", "Test", "User2")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user2, []string{team1.Id, team2.Id}, []string{}))

	user3 := createUser("test.user3", "testuser3", "Another", "User3")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user3, []string{team2.Id}, []string{}))

	// Wait for indexing to complete
	c.NoError(c.RefreshIndexFn())

	// Search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	c.Run("Search for all users in team1", func() {
		// Test 1: Search for all users in team1
		userIds, err := c.ESImpl.SearchUsersInTeam(team1.Id, nil, "testuser", options)
		c.Nil(err)
		c.Len(userIds, 2)
		c.Contains(userIds, user1.Id)
		c.Contains(userIds, user2.Id)
		c.NotContains(userIds, user3.Id)
	})

	c.Run("Search for specific user in team1", func() {
		// Test 2: Search with term that should match user1 in team1
		userIds, err := c.ESImpl.SearchUsersInTeam(team1.Id, nil, "testuser1", options)
		c.Nil(err)
		c.Len(userIds, 1)
		c.Contains(userIds, user1.Id)
		c.NotContains(userIds, user2.Id)
		c.NotContains(userIds, user3.Id)
	})

	c.Run("Search in team2", func() {
		// Test 3: Search in team2
		userIds, err := c.ESImpl.SearchUsersInTeam(team2.Id, nil, "testuser", options)
		c.Nil(err)
		c.Len(userIds, 2)
		c.Contains(userIds, user2.Id)
		c.Contains(userIds, user3.Id)
		c.NotContains(userIds, user1.Id)
	})

	c.Run("Search with term in team2", func() {
		// Test 4: Search with term in team2
		userIds, err := c.ESImpl.SearchUsersInTeam(team2.Id, nil, "another", options)
		c.Nil(err)
		c.Len(userIds, 1)
		c.Contains(userIds, user3.Id)
		c.NotContains(userIds, user1.Id)
		c.NotContains(userIds, user2.Id)
	})

	c.Run("Search with restrictedToChannels", func() {
		// Test 5: Search with restrictedToChannels
		// Create channel in team1
		channel1 := createChannel(team1.Id, "channel1", "Test Channel 1", model.ChannelTypeOpen)
		c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel1, []string{}, []string{}))

		// Update user1 to be in channel1
		c.Nil(c.ESImpl.IndexUser(c.TH.Context, user1, []string{team1.Id}, []string{channel1.Id}))
		c.NoError(c.RefreshIndexFn())

		// Search for users in team1 restricted to channel1
		userIds, err := c.ESImpl.SearchUsersInTeam(team1.Id, []string{channel1.Id}, "", options)
		c.Nil(err)
		c.Len(userIds, 1)
		c.Contains(userIds, user1.Id)
		c.NotContains(userIds, user2.Id)
		c.NotContains(userIds, user3.Id)
		c.Nil(c.ESImpl.DeleteChannel(channel1))
	})

	c.Run("Search with empty restrictedToChannels", func() {
		// Test 6: Search with empty restrictedToChannels (should return no results)
		emptyRestricted := []string{}
		userIds, err := c.ESImpl.SearchUsersInTeam(team1.Id, emptyRestricted, "", options)
		c.Nil(err)
		c.Empty(userIds)
	})

	// Clean up
	c.Nil(c.ESImpl.DeleteUser(user1))
	c.Nil(c.ESImpl.DeleteUser(user2))
	c.Nil(c.ESImpl.DeleteUser(user3))
}

func (c *CommonTestSuite) TestDeleteUser() {
	// Create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{}, []string{}))

	c.NoError(c.RefreshIndexFn())

	// Check the user is there.
	found, _, err := c.GetDocumentFn(IndexBaseUsers, user.Id)
	c.NoError(err)
	c.True(found)

	// Delete the user.
	c.Nil(c.ESImpl.DeleteUser(user))
	c.NoError(c.RefreshIndexFn())
	// Check the user is not there.
	found, _, err = c.GetDocumentFn(IndexBaseUsers, user.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestTestConfig() {
	c.Nil(c.ESImpl.TestConfig(c.TH.Context, c.TH.App.Config()))

	originalConfig := c.TH.App.Config()
	defer c.TH.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.ConnectionURL = *originalConfig.ElasticsearchSettings.ConnectionURL
	})

	c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.ConnectionURL = "example.com:12345" })
	c.Error(c.ESImpl.TestConfig(c.TH.Context, c.TH.App.Config()))

	// Passing a temp config which is different from the saved
	// config should be taken correctly.
	c.Nil(c.ESImpl.TestConfig(c.TH.Context, originalConfig))
}

func (c *CommonTestSuite) TestIndexFile() {
	// First, create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	// Then, create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{c.TH.BasicTeam.Id}, []string{channel.Id}))

	// Create and index a file
	file := createFile(user.Id, channel.Id, "", "file contents", "testfile", "txt")
	c.Nil(c.ESImpl.IndexFile(file, channel.Id))

	c.NoError(c.RefreshIndexFn())

	// Check the file is there
	found, _, err := c.GetDocumentFn(IndexBaseFiles, file.Id)
	c.NoError(err)
	c.True(found)
}

func (c *CommonTestSuite) TestDeleteFile() {
	// First, create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	// Then, create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{c.TH.BasicTeam.Id}, []string{channel.Id}))

	// Create and index a file
	file := createFile(user.Id, channel.Id, "", "file contents", "testfile", "txt")
	c.Nil(c.ESImpl.IndexFile(file, channel.Id))

	c.NoError(c.RefreshIndexFn())

	// Check the file is there
	found, _, err := c.GetDocumentFn(IndexBaseFiles, file.Id)
	c.NoError(err)
	c.True(found)

	// Delete the file
	c.Nil(c.ESImpl.DeleteFile(file.Id))
	c.NoError(c.RefreshIndexFn())

	// Check the file is not there.
	found, _, err = c.GetDocumentFn(IndexBaseFiles, file.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestDeleteUserFiles() {
	// First, create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	// Then, create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{c.TH.BasicTeam.Id}, []string{channel.Id}))

	// Create and index a file
	file := createFile(user.Id, channel.Id, "", "file contents", "testfile", "txt")
	c.Nil(c.ESImpl.IndexFile(file, channel.Id))

	c.NoError(c.RefreshIndexFn())

	// Check the file is there
	found, _, err := c.GetDocumentFn(IndexBaseFiles, file.Id)
	c.NoError(err)
	c.True(found)

	// Delete file by creator
	c.Nil(c.ESImpl.DeleteUserFiles(c.TH.Context, user.Id))
	c.NoError(c.RefreshIndexFn())

	// Check the file is not there.
	found, _, err = c.GetDocumentFn(IndexBaseFiles, file.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestDeletePostFiles() {
	// First, create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	// Then, create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{c.TH.BasicTeam.Id}, []string{channel.Id}))

	// Create and index a post
	post := createPost(user.Id, channel.Id, "test post message")
	c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))

	// Create and index a file
	file := createFile(user.Id, channel.Id, post.Id, "file contents", "testfile", "txt")
	c.Nil(c.ESImpl.IndexFile(file, channel.Id))

	c.NoError(c.RefreshIndexFn())

	// Check the file is there
	found, _, err := c.GetDocumentFn(IndexBaseFiles, file.Id)
	c.NoError(err)
	c.True(found)

	// Delete file by post
	c.Nil(c.ESImpl.DeletePostFiles(c.TH.Context, post.Id))
	c.NoError(c.RefreshIndexFn())

	// Check the file is not there.
	found, _, err = c.GetDocumentFn(IndexBaseFiles, file.Id)
	// This is a difference in behavior between engines.
	if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
		c.Error(err)
	} else {
		c.NoError(err)
	}
	c.False(found)
}

func (c *CommonTestSuite) TestSearchFiles() {
	// First, create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Test Channel", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

	// Then, create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{c.TH.BasicTeam.Id}, []string{channel.Id}))

	// Create multiple test files with different content
	file1 := createFile(user.Id, channel.Id, "", "apple document content", "apple_report", "txt")
	c.Nil(c.ESImpl.IndexFile(file1, channel.Id))

	file2 := createFile(user.Id, channel.Id, "", "orange presentation content", "orange_slides", "pdf")
	c.Nil(c.ESImpl.IndexFile(file2, channel.Id))

	file3 := createFile(user.Id, channel.Id, "", "banana data content", "banana_sheet", "xls")
	c.Nil(c.ESImpl.IndexFile(file3, channel.Id))

	// Wait for indexing to complete
	c.NoError(c.RefreshIndexFn())

	// Create channel list for search
	channels := model.ChannelList{channel}

	c.Run("Search by term (file name and content)", func() {
		// Test 1: Search by term (file name and content)
		searchParams := []*model.SearchParams{
			{
				Terms:     "apple",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		fileIds, err := c.ESImpl.SearchFiles(channels, searchParams, 0, 10)
		c.Nil(err)
		c.Contains(fileIds, file1.Id)
		c.NotContains(fileIds, file2.Id)
		c.NotContains(fileIds, file3.Id)
	})

	c.Run("Search by extension", func() {
		// Test 2: Search by extension
		searchParams := []*model.SearchParams{
			{
				Terms:      "",
				IsHashtag:  false,
				OrTerms:    false,
				Extensions: []string{"pdf"},
			},
		}

		fileIds, err := c.ESImpl.SearchFiles(channels, searchParams, 0, 10)
		c.Nil(err)
		c.NotContains(fileIds, file1.Id)
		c.Contains(fileIds, file2.Id)
		c.NotContains(fileIds, file3.Id)
	})

	c.Run("Search with OR terms", func() {
		// Test 3: Search with OR terms
		searchParams := []*model.SearchParams{
			{
				Terms:     "apple banana",
				IsHashtag: false,
				OrTerms:   true,
			},
		}

		fileIds, err := c.ESImpl.SearchFiles(channels, searchParams, 0, 10)
		c.Nil(err)
		c.Contains(fileIds, file1.Id)
		c.NotContains(fileIds, file2.Id)
		c.Contains(fileIds, file3.Id)
	})

	c.Run("Search with excluded terms", func() {
		// Test 4: Search with excluded terms
		searchParams := []*model.SearchParams{
			{
				Terms:         "content",
				ExcludedTerms: "orange",
				IsHashtag:     false,
				OrTerms:       false,
			},
		}

		fileIds, err := c.ESImpl.SearchFiles(channels, searchParams, 0, 10)
		c.Nil(err)
		c.Contains(fileIds, file1.Id)
		c.NotContains(fileIds, file2.Id)
		c.Contains(fileIds, file3.Id)
	})

	// Clean up indexed files
	c.Nil(c.ESImpl.DeleteFile(file1.Id))
	c.Nil(c.ESImpl.DeleteFile(file2.Id))
	c.Nil(c.ESImpl.DeleteFile(file3.Id))
}

func (c *CommonTestSuite) TestSearchMultiDC() {
	// Store original settings to restore later
	originalIndexPrefix := *c.TH.App.Config().ElasticsearchSettings.IndexPrefix
	originalGlobalSearchPrefix := *c.TH.App.Config().ElasticsearchSettings.GlobalSearchPrefix

	defer c.TH.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.IndexPrefix = originalIndexPrefix
		*cfg.ElasticsearchSettings.GlobalSearchPrefix = originalGlobalSearchPrefix
	})

	// First using DC1 prefix
	c.TH.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.IndexPrefix = "test_dc1_"
		*cfg.ElasticsearchSettings.GlobalSearchPrefix = ""
	})

	// Create a post with content specific to DC1
	postDC1 := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, "unique apple datacenter1")
	c.Nil(c.ESImpl.IndexPost(postDC1, c.TH.BasicTeam.Id))

	// Now switch to DC2 prefix
	c.TH.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ElasticsearchSettings.IndexPrefix = "test_dc2_"
		*cfg.ElasticsearchSettings.GlobalSearchPrefix = ""
	})

	// Create a post with content specific to DC2
	postDC2 := createPost(c.TH.BasicUser.Id, c.TH.BasicChannel.Id, "unique banana datacenter2")
	c.Nil(c.ESImpl.IndexPost(postDC2, c.TH.BasicTeam.Id))

	// Ensure posts are indexed
	c.NoError(c.RefreshIndexFn())

	channels := model.ChannelList{c.TH.BasicChannel}

	// First verify each prefix only finds its own posts
	c.Run("DC1 prefix only finds DC1 post", func() {
		c.TH.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ElasticsearchSettings.IndexPrefix = "test_dc1_"
			*cfg.ElasticsearchSettings.GlobalSearchPrefix = ""
		})

		// Search for common term
		searchParams := []*model.SearchParams{
			{
				Terms:     "unique",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err := c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC1.Id)
		c.NotContains(postIds, postDC2.Id)
	})

	c.Run("DC2 prefix only finds DC2 post", func() {
		c.TH.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ElasticsearchSettings.IndexPrefix = "test_dc2_"
			*cfg.ElasticsearchSettings.GlobalSearchPrefix = ""
		})

		// Search for common term
		searchParams := []*model.SearchParams{
			{
				Terms:     "unique",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err := c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC2.Id)
		c.NotContains(postIds, postDC1.Id)
	})

	c.Run("Global prefix finds posts from both DCs", func() {
		// Set global search prefix to search across both indices
		c.TH.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ElasticsearchSettings.IndexPrefix = "test_dc1_" // Specific prefix doesn't matter for this test
			*cfg.ElasticsearchSettings.GlobalSearchPrefix = "test_"
		})

		// Search for common term - should find both posts
		searchParams := []*model.SearchParams{
			{
				Terms:     "unique",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err := c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Len(postIds, 2)
		c.Contains(postIds, postDC1.Id)
		c.Contains(postIds, postDC2.Id)

		// Search for DC1-specific content
		searchParams = []*model.SearchParams{
			{
				Terms:     "apple",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err = c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC1.Id)
		c.NotContains(postIds, postDC2.Id)

		// Search for DC2-specific content
		searchParams = []*model.SearchParams{
			{
				Terms:     "banana",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err = c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC2.Id)
		c.NotContains(postIds, postDC1.Id)

		// Search for datacenter-specific content
		searchParams = []*model.SearchParams{
			{
				Terms:     "datacenter1",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err = c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC1.Id)
		c.NotContains(postIds, postDC2.Id)

		searchParams = []*model.SearchParams{
			{
				Terms:     "datacenter2",
				IsHashtag: false,
				OrTerms:   false,
			},
		}

		postIds, _, err = c.ESImpl.SearchPosts(channels, searchParams, 0, 20)
		c.Nil(err)
		c.Contains(postIds, postDC2.Id)
		c.NotContains(postIds, postDC1.Id)
	})
}

func (c *CommonTestSuite) TestElasticsearchDataRetentionDeleteIndexes() {
	c.Nil(c.CreateIndexFn("posts_2017_09_15"))
	c.Nil(c.CreateIndexFn("posts_2017_09_16"))
	c.Nil(c.CreateIndexFn("posts_2017_09_17"))
	c.Nil(c.CreateIndexFn("posts_2017_09_18"))
	c.Nil(c.CreateIndexFn("posts_2017_09_19"))

	c.Run("Should delete indexes using start of day cut off", func() {
		c.Nil(c.ESImpl.DataRetentionDeleteIndexes(c.TH.Context, time.Date(2017, 9, 16, 0, 0, 0, 0, time.UTC)))

		postIndexesResult, err := c.GetIndexFn("posts_*")
		c.Nil(err)
		if err == nil {
			found1 := false
			found2 := false
			found3 := false
			found4 := false
			found5 := false

			for _, index := range postIndexesResult {
				if index == "posts_2017_09_15" {
					found1 = true
				} else if index == "posts_2017_09_16" {
					found2 = true
				} else if index == "posts_2017_09_17" {
					found3 = true
				} else if index == "posts_2017_09_18" {
					found4 = true
				} else if index == "posts_2017_09_19" {
					found5 = true
				}
			}

			c.False(found1)
			c.False(found2)
			c.True(found3)
			c.True(found4)
			c.True(found5)
		}
	})

	c.Run("Should delete indexes when cut off is in hours", func() {
		c.Nil(c.ESImpl.DataRetentionDeleteIndexes(c.TH.Context, time.Date(2017, 9, 18, 11, 6, 0, 0, time.UTC)))

		postIndexesResult, err := c.GetIndexFn("posts_*")
		c.Nil(err)
		if err == nil {
			found1 := false
			found2 := false
			found3 := false

			for _, index := range postIndexesResult {
				if index == "posts_2017_09_17" {
					found1 = true
				} else if index == "posts_2017_09_18" {
					found2 = true
				} else if index == "posts_2017_09_19" {
					found3 = true
				}
			}

			c.False(found1)
			c.False(found2)
			c.True(found3)
		}
	})
}

func (c *CommonTestSuite) TestPurgeIndexes() {
	existingIndexPrefix := *c.TH.Server.Config().ElasticsearchSettings.IndexPrefix
	defer c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IndexPrefix = existingIndexPrefix })

	c.Run("Should purge all indexes", func() {
		// Create and index a user
		user := createUser("test.user", "testuser", "Test", "User")
		c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{}, []string{}))

		c.NoError(c.RefreshIndexFn())

		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IndexPrefix = "test_" })

		// index user with a new index prefix
		c.Nil(c.ESImpl.IndexUser(c.TH.Context, user, []string{}, []string{}))
		c.NoError(c.RefreshIndexFn())

		c.Nil(c.ESImpl.PurgeIndexes(c.TH.Context))

		found, _, err := c.GetDocumentFn(IndexBaseUsers, user.Id)
		c.NoError(err)
		c.True(found)

		found, _, err = c.GetDocumentFn("test_"+IndexBaseUsers, user.Id)
		if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
			c.False(found)
		} else {
			elasticErr := err.(*types.ElasticsearchError)
			c.Equal(404, elasticErr.Status)
		}
	})

	c.Run("Should not purge indexes defined to ignore", func() {
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IgnoredPurgeIndexes = "posts*" })
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IndexPrefix = "" })

		// Create a user
		user := createUser("test.user", "testuser", "Test", "User")

		// Create and index a post
		post := createPost(user.Id, c.TH.BasicChannel.Id, "Test")
		c.Nil(c.ESImpl.IndexPost(post, c.TH.BasicTeam.Id))

		c.NoError(c.RefreshIndexFn())
		indexName := BuildPostIndexName(*c.TH.App.Config().ElasticsearchSettings.AggregatePostsAfterDays,
			IndexBasePosts,
			IndexBasePosts_MONTH,
			time.Now(),
			post.CreateAt,
		)

		// We expect posts indexes to remain after purge
		c.Nil(c.ESImpl.PurgeIndexes(c.TH.Context))

		found, _, err := c.GetDocumentFn(indexName, post.Id)
		c.NoError(err)
		c.True(found)

		// Remove the ignore rule
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IgnoredPurgeIndexes = "" })

		c.Nil(c.ESImpl.PurgeIndexes(c.TH.Context))

		// Validate the indexes are gone
		found, _, err = c.GetDocumentFn(IndexBasePosts, post.Id)
		if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
			c.False(found)
		} else {
			elasticErr := err.(*types.ElasticsearchError)
			c.Equal(404, elasticErr.Status)
		}
	})
}

func (c *CommonTestSuite) TestPurgeIndexList() {
	existingIndexPrefix := *c.TH.Server.Config().ElasticsearchSettings.IndexPrefix
	defer c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IndexPrefix = existingIndexPrefix })

	c.Run("Should purge allowed index", func() {
		// Create and index a channel
		channel := createChannel("test.channel", "testuser", "Test", model.ChannelTypeOpen)
		c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

		c.NoError(c.RefreshIndexFn())

		// verify data is in Elasticsearch
		found, _, err := c.GetDocumentFn(IndexBaseChannels, channel.Id)
		c.NoError(err)
		c.True(found)

		// now we'll purge
		c.Nil(c.ESImpl.PurgeIndexList(c.TH.Context, []string{"channels"}))

		found, _, err = c.GetDocumentFn(IndexBaseChannels, channel.Id)
		if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
			c.False(found)
		} else {
			elasticErr := err.(*types.ElasticsearchError)
			c.Equal(404, elasticErr.Status)
		}
	})

	c.Run("Should not purge indexes defined to ignore", func() {
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IgnoredPurgeIndexes = "channels" })
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IndexPrefix = "" })

		channel := createChannel("test.channel", "testuser", "Test", model.ChannelTypeOpen)
		c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{}))

		c.NoError(c.RefreshIndexFn())

		// verify data is in Elasticsearch
		found, _, err := c.GetDocumentFn(IndexBaseChannels, channel.Id)
		c.NoError(err)
		c.True(found)

		// now we'll purge
		c.Nil(c.ESImpl.PurgeIndexList(c.TH.Context, []string{"channels"}))

		// the channel should still be there because we ignored that index
		found, _, err = c.GetDocumentFn(IndexBaseChannels, channel.Id)
		c.NoError(err)
		c.True(found)

		// Remove the ignore rule
		c.TH.App.UpdateConfig(func(cfg *model.Config) { *cfg.ElasticsearchSettings.IgnoredPurgeIndexes = "" })

		c.Nil(c.ESImpl.PurgeIndexList(c.TH.Context, []string{"channels"}))

		// now it should be gone as we're no longer ignoring it
		found, _, err = c.GetDocumentFn(IndexBaseChannels, channel.Id)
		if c.ESImpl.GetName() == model.ElasticsearchSettingsOSBackend {
			c.False(found)
		} else {
			elasticErr := err.(*types.ElasticsearchError)
			c.Equal(404, elasticErr.Status)
		}
	})
}

func (c *CommonTestSuite) TestSearchChannels() {
	// Create and index a channel
	channel := createChannel(c.TH.BasicTeam.Id, "channel", "Channel Open", model.ChannelTypeOpen)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel, []string{}, []string{c.TH.BasicUser.Id, "otheruser"}))
	channel2 := createChannel(c.TH.BasicTeam.Id, "channel", "Channel Private", model.ChannelTypePrivate)
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channel2, []string{c.TH.BasicUser.Id}, []string{c.TH.BasicUser.Id, "otheruser"}))

	c.NoError(c.RefreshIndexFn())

	for _, includeDeleted := range []bool{true, false} {
		// Private channels should be returned for right user.
		ids, appErr := c.ESImpl.SearchChannels("", c.TH.BasicUser.Id, "Channel", false, includeDeleted)
		c.Nil(appErr)
		c.Len(ids, 2)

		// No private channels if user is guest
		ids, appErr = c.ESImpl.SearchChannels("", c.TH.BasicUser.Id, "Channel", true, includeDeleted)
		c.Nil(appErr)
		c.Len(ids, 1)
		c.Equal(channel.Id, ids[0])

		// No Private channels should be returned for wrong user.
		ids, appErr = c.ESImpl.SearchChannels("", "otheruser", "Channel", false, includeDeleted)
		c.Nil(appErr)
		c.Len(ids, 1)
		c.Equal(channel.Id, ids[0])
	}

	// Adding a deleted channel
	channelDel := createChannel(c.TH.BasicTeam.Id, "channelD", "Channel Open- Deleted", model.ChannelTypeOpen)
	channelDel.DeleteAt = 123
	c.Nil(c.ESImpl.IndexChannel(c.TH.Context, channelDel, []string{}, []string{c.TH.BasicUser.Id, "otheruser"}))
	c.NoError(c.RefreshIndexFn())

	ids, appErr := c.ESImpl.SearchChannels("", c.TH.BasicUser.Id, "Channel", false, false)
	c.Nil(appErr)
	c.Len(ids, 2)

	ids, appErr = c.ESImpl.SearchChannels("", c.TH.BasicUser.Id, "Channel", false, true)
	c.Nil(appErr)
	c.Len(ids, 3)

	ids, appErr = c.ESImpl.SearchChannels("", c.TH.BasicUser.Id, "Deleted", false, true)
	c.Nil(appErr)
	c.Len(ids, 1)
}
