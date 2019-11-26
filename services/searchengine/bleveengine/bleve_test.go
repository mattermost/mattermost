package bleveengine

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/model"

	"github.com/blevesearch/bleve"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type BleveEngineTestSuite struct {
	suite.Suite

	engine *BleveEngine
}

func TestBleveEngineTestSuite(t *testing.T) {
	suite.Run(t, new(BleveEngineTestSuite))
}

// ToDo: from elastic/testlib, generalise for both?
func createChannel(teamId, name, displayName string) *model.Channel {
	channel := &model.Channel{
		TeamId:      teamId,
		Type:        "O",
		Name:        name,
		DisplayName: displayName,
	}
	channel.PreSave()

	return channel
}

// ToDo: from elastic/testlib, generalise for both?
func createUser(username, nickname, firstName, lastName string) *model.User {
	user := &model.User{
		Username:  username,
		Password:  username,
		Nickname:  nickname,
		FirstName: firstName,
		LastName:  lastName,
	}
	user.PreSave()

	return user
}

// ToDo: from elastic/testlib, generalise for both?
func createPost(userId string, channelId string, message string) *model.Post {
	post := &model.Post{
		Message:       message,
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userId,
		CreateAt:      1000000,
	}
	post.PreSave()

	return post
}

// ToDo: from elastic/testlib, generalise for both?
func createPostAtTime(userId string, channelId string, message string, createAt int64) *model.Post {
	post := &model.Post{
		Message:       message,
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userId,
		CreateAt:      createAt,
	}
	post.PreSave()

	return post
}

// ToDo: from elastic/testlib, generalise for both?
func createPostWithHashtags(userId string, channelId string, message string, hashtags string) *model.Post {
	post := &model.Post{
		Message:       message,
		ChannelId:     channelId,
		PendingPostId: model.NewId() + ":" + fmt.Sprint(model.GetMillis()),
		UserId:        userId,
		CreateAt:      1000000,
		Hashtags:      hashtags,
	}
	post.PreSave()

	return post
}

// ToDo: from elastic/testlib, generalise for both?
func checkMatchesEqual(t *testing.T, expected model.PostSearchMatches, actual map[string][]string) {
	a := assert.New(t)

	a.Len(actual, len(expected), "Received matches for a different number of posts")

	for postId, expectedMatches := range expected {
		a.ElementsMatch(expectedMatches, actual[postId], fmt.Sprintf("%v: expected %v, got %v", postId, expectedMatches, actual[postId]))
	}
}

func (s *BleveEngineTestSuite) SetupTest() {
	postIndex, err := bleve.NewMemOnly(getPostIndexMapping())
	if err != nil {
		s.FailNow("Error creating in memory index for posts: " + err.Error())
	}

	userIndex, err := bleve.NewMemOnly(getUserIndexMapping())
	if err != nil {
		s.FailNow("Error creating in memory index for users: " + err.Error())
	}

	channelIndex, err := bleve.NewMemOnly(getChannelIndexMapping())
	if err != nil {
		s.FailNow("Error creating in memory index for channels: " + err.Error())
	}

	s.engine = &BleveEngine{
		postIndex: postIndex,
		userIndex: userIndex,
		channelIndex: channelIndex,
	}
}

func (s *BleveEngineTestSuite) TestBleveIndexPost() {
	// Create and index a post
	userId := model.NewId()
	channelId := model.NewId()
	teamId := model.NewId()
	post := createPost(userId, channelId, "some message")
	s.Nil(s.engine.IndexPost(post, teamId))

	// Check the post is there.
	result, err := s.engine.postIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{post.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(post.Id, result.Hits[0].ID)
}

func (s *BleveEngineTestSuite) TestBleveSearchPosts() {
	// Create and index a post
	channel := &model.Channel{Id: model.NewId()}
	post := createPost(model.NewId(), channel.Id, model.NewId())
	s.Nil(s.engine.IndexPost(post, model.NewId()))

	// Check the post is there.
	result, err := s.engine.postIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{post.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(post.Id, result.Hits[0].ID)

	// Do a search for that post.
	channels := &model.ChannelList{
		channel,
	}

	searchParams := []*model.SearchParams{
		{
			Terms:     post.Message,
			IsHashtag: false,
			OrTerms:   false,
		},
	}

	// Check the post is found as expected
	ids, matches, err := s.engine.SearchPosts(channels, searchParams, 0, 20)
	s.Nil(err)
	s.Len(ids, 1)
	s.Equal(ids[0], post.Id)
	checkMatchesEqual(s.T(), map[string][]string{
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

	ids, matches, err = s.engine.SearchPosts(channels, searchParams, 0, 20)
	s.Nil(err)
	s.Len(ids, 0)
	s.Len(matches, 0)
}

func (s *BleveEngineTestSuite) TestBleveDeletePost() {
	post := createPost("userId", "channelId", model.NewId())

	// Index the post.
	s.Nil(s.engine.IndexPost(post, "teamId"))

	// Check the post is there.
	result, err := s.engine.postIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{post.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(post.Id, result.Hits[0].ID)

	// Delete the post.
	s.Nil(s.engine.DeletePost(post))

	// Check the post is not there.
	result, err = s.engine.postIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{post.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 0)
}

func (s *BleveEngineTestSuite) TestBleveIndexChannel() {
	channel := createChannel("team-id", "channel", "test channel")
	s.Require().Nil(s.engine.IndexChannel(channel))

	result, err := s.engine.channelIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{channel.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(channel.Id, result.Hits[0].ID)
}

func (s *BleveEngineTestSuite) TestBleveSearchChannels() {
	// Create and index some channels
	channel1 := createChannel("team-id", "channel", "Test One")
	s.Nil(s.engine.IndexChannel(channel1))

	channel2 := createChannel("team-id", "channel-second", "Test Two")
	s.Nil(s.engine.IndexChannel(channel2))

	channel3 := createChannel("team-id", "channel_third", "Test Three")
	s.Nil(s.engine.IndexChannel(channel3))

	channel4 := createChannel("team2-id", "channel_third", "Test Three")
	s.Nil(s.engine.IndexChannel(channel4))

	// Chech the channels are there
	for _, cId := range []string{channel1.Id, channel2.Id, channel3.Id, channel4.Id} {
		result, err := s.engine.channelIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{cId})))
		s.Require().Nil(err)
		s.Len(result.Hits, 1)
		s.Equal(cId, result.Hits[0].ID)
	}

	testCases := []struct {
		Name     string
		Term     string
		Expected []string
	}{
		{
			Name:     "autocomplete search for all channels by name",
			Term:     "cha",
			Expected: []string{channel1.Id, channel2.Id, channel3.Id},
		},
		{
			Name:     "autocomplete search for one channel by display name",
			Term:     "one",
			Expected: []string{channel1.Id},
		},
		{
			Name:     "autocomplete search for one channel split by -",
			Term:     "seco",
			Expected: []string{channel2.Id},
		},
		{
			Name:     "autocomplete search for one channel split by _",
			Term:     "thir",
			Expected: []string{channel3.Id},
		},
		{
			Name:     "autocomplete search that won't match anything",
			Term:     "nothing",
			Expected: []string{},
		},
	}

	for _, tc := range testCases {
		s.Run(tc.Name, func() {
			r, err := s.engine.SearchChannels("team-id", tc.Term)
			s.Require().Nil(err)
			s.Len(r, len(tc.Expected))
			s.ElementsMatch(r, tc.Expected)
		})
	}
}

func (s *BleveEngineTestSuite) TestBleveDeleteChannel() {
	// Create and index a channel.
	channel := createChannel("team-id", "channel", "Test Channel")
	s.Nil(s.engine.IndexChannel(channel))

	// Check the channel is there.
	result, err := s.engine.channelIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{channel.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(channel.Id, result.Hits[0].ID)

	// Delete the post.
	s.Nil(s.engine.DeleteChannel(channel))

	// Check the post is not there.
	result, err = s.engine.channelIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{channel.Id})))
	s.Nil(err)
	s.Len(result.Hits, 0)
}

func (s *BleveEngineTestSuite) TestBleveIndexUser() {
	// Create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	s.Nil(s.engine.IndexUser(user, []string{}, []string{}))

	// Check the user is there.
	result, err := s.engine.userIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{user.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(user.Id, result.Hits[0].ID)
}

func (s *BleveEngineTestSuite) TestBleveSearchUsersInChannel() {
	// Create and index some users
	// Channels for team 1
	teamId1 := model.NewId()
	channelId1 := model.NewId()
	channelId2 := model.NewId()

	// Channels for team 2
	teamId2 := model.NewId()
	channelId3 := model.NewId()

	// Users in team 1
	user1 := createUser("test.one", "userone", "User", "One")
	s.Nil(s.engine.IndexUser(user1, []string{teamId1}, []string{channelId1, channelId2}))

	user2 := createUser("test.two", "usertwo", "User", "Special Two")
	s.Nil(s.engine.IndexUser(user2, []string{teamId1}, []string{channelId1, channelId2}))

	user3 := createUser("test.three", "userthree", "User", "Special Three")
	s.Nil(s.engine.IndexUser(user3, []string{teamId1}, []string{channelId2}))

	// Users in team 2
	user4 := createUser("test.four", "userfour", "User", "Four")
	s.Nil(s.engine.IndexUser(user4, []string{teamId2}, []string{channelId3}))

	user5 := createUser("test.five_split", "userfive", "User", "Five")
	s.Nil(s.engine.IndexUser(user5, []string{teamId2}, []string{channelId3}))

	// Check that the users are there
	for _, u := range []*model.User{user1, user2, user3, user4, user5} {
		result, err := s.engine.userIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{u.Id})))
		s.Require().Nil(err)
		s.Len(result.Hits, 1)
		s.Equal(u.Id, result.Hits[0].ID)
	}

	// Given the default search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	testCases := []struct {
		Name               string
		Team               string
		Channel            string
		RestrictedChannels []string
		Term               string
		RChan              []string
		RNuchan            []string
	}{
		{
			Name:               "All users in channel1",
			Team:               teamId1,
			Channel:            channelId1,
			RestrictedChannels: nil,
			Term:               "",
			RChan:              []string{user1.Id, user2.Id},
			RNuchan:            []string{user3.Id},
		},
		{
			Name:               "All users in channel1 with channel restrictions",
			Team:               teamId1,
			Channel:            channelId1,
			RestrictedChannels: []string{channelId1},
			Term:               "",
			RChan:              []string{user1.Id, user2.Id},
			RNuchan:            []string{},
		},
		{
			Name:               "All users in channel1 with channel all channels restricted",
			Team:               teamId1,
			Channel:            channelId1,
			RestrictedChannels: []string{},
			Term:               "",
			RChan:              []string{},
			RNuchan:            []string{},
		},
		{
			Name:               "All users in channel2",
			Team:               teamId1,
			Channel:            channelId2,
			RestrictedChannels: nil,
			Term:               "",
			RChan:              []string{user1.Id, user2.Id, user3.Id},
			RNuchan:            []string{},
		},
		{
			Name:               "All users in channel3",
			Team:               teamId2,
			Channel:            channelId3,
			RestrictedChannels: nil,
			Term:               "",
			RChan:              []string{user4.Id, user5.Id},
			RNuchan:            []string{},
		},
		{
			Name:               "All users in channel1 with term \"spe\"",
			Team:               teamId1,
			Channel:            channelId1,
			RestrictedChannels: nil,
			Term:               "spe",
			RChan:              []string{user2.Id},
			RNuchan:            []string{user3.Id},
		},
		{
			Name:               "All users in channel1 with term \"spe\" with channel restrictions",
			Team:               teamId1,
			Channel:            channelId1,
			RestrictedChannels: []string{channelId1},
			Term:               "spe",
			RChan:              []string{user2.Id},
			RNuchan:            []string{},
		},
	}

	for _, tc := range testCases {
		s.Run(tc.Name, func() {
			rchan, rnuchan, err := s.engine.SearchUsersInChannel(tc.Team, tc.Channel, tc.RestrictedChannels, tc.Term, options)
			s.Require().Nil(err)
			s.Len(rchan, len(tc.RChan))
			s.ElementsMatch(rchan, tc.RChan)
			s.Len(rnuchan, len(tc.RNuchan))
			s.ElementsMatch(rnuchan, tc.RNuchan)
		})
	}
}

func (s *BleveEngineTestSuite) TestBleveSearchUsersInTeam() {
	// Create and index some users
	// Channels for team 1
	teamId1 := model.NewId()
	channelId1 := model.NewId()
	channelId2 := model.NewId()

	// Channels for team 2
	teamId2 := model.NewId()
	channelId3 := model.NewId()

	// Users in team 1
	user1 := createUser("test.one.split", "userone", "User", "One")
	s.Nil(s.engine.IndexUser(user1, []string{teamId1}, []string{channelId1, channelId2}))

	user2 := createUser("test.two", "usertwo", "User", "Special Two")
	s.Nil(s.engine.IndexUser(user2, []string{teamId1}, []string{channelId1, channelId2}))

	user3 := createUser("test.three", "userthree", "User", "Special Three")
	s.Nil(s.engine.IndexUser(user3, []string{teamId1}, []string{channelId2}))

	// Users in team 2
	user4 := createUser("test.four-slash", "userfour", "User", "Four")
	s.Nil(s.engine.IndexUser(user4, []string{teamId2}, []string{channelId3}))

	user5 := createUser("test.five.split", "userfive", "User", "Five")
	s.Nil(s.engine.IndexUser(user5, []string{teamId2}, []string{channelId3}))

	// Check that the users are there
	for _, u := range []*model.User{user1, user2, user3, user4, user5} {
		result, err := s.engine.userIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{u.Id})))
		s.Require().Nil(err)
		s.Len(result.Hits, 1)
		s.Equal(u.Id, result.Hits[0].ID)
	}

	// Given the default search options
	options := &model.UserSearchOptions{
		AllowFullNames: true,
		Limit:          100,
	}

	testCases := []struct {
		Name               string
		Team               string
		RestrictedChannels []string
		Term               string
		Result             []string
	}{
		{
			Name:               "All users",
			Team:               "",
			RestrictedChannels: nil,
			Term:               "",
			Result:             []string{user1.Id, user2.Id, user3.Id, user4.Id, user5.Id},
		},
		{
			Name:               "All users with term \"split\"",
			Team:               "",
			RestrictedChannels: nil,
			Term:               "split",
			Result:             []string{user1.Id, user5.Id},
		},
		{
			Name:               "All users in team1",
			Team:               teamId1,
			RestrictedChannels: nil,
			Term:               "",
			Result:             []string{user1.Id, user2.Id, user3.Id},
		},
		{
			Name:               "All users in team1 with term \"spe\"",
			Team:               teamId1,
			RestrictedChannels: nil,
			Term:               "spe",
			Result:             []string{user2.Id, user3.Id},
		},
		{
			Name:               "All users in team1 with term \"spe\" and channel restrictions",
			Team:               teamId1,
			RestrictedChannels: []string{channelId1},
			Term:               "spe",
			Result:             []string{user2.Id},
		},
		{
			Name:               "All users in team1 with term \"spe\" and all channels restricted",
			Team:               teamId1,
			RestrictedChannels: []string{},
			Term:               "spe",
			Result:             []string{},
		},
		{
			Name:               "All users in team2",
			Team:               teamId2,
			RestrictedChannels: nil,
			Term:               "",
			Result:             []string{user4.Id, user5.Id},
		},
		{
			Name:               "All users in team2 with term FiV",
			Team:               teamId2,
			RestrictedChannels: nil,
			Term:               "FiV",
			Result:             []string{user5.Id},
		},
		{
			Name:               "All users in team2 by split part of the username with a dot",
			Team:               teamId2,
			RestrictedChannels: []string{channelId3},
			Term:               "split",
			Result:             []string{user5.Id},
		},
		{
			Name:               "All users in team2 by split part of the username with a slash",
			Team:               teamId2,
			RestrictedChannels: []string{channelId3},
			Term:               "slash",
			Result:             []string{user4.Id},
		},
		{
			Name:               "All users in team2 by split part of the username with a -slash",
			Team:               teamId2,
			RestrictedChannels: []string{channelId3},
			Term:               "-slash",
			Result:             []string{user4.Id},
		},
	}

	for _, tc := range testCases {
		s.Run(tc.Name, func() {
			r, err := s.engine.SearchUsersInTeam(tc.Team, tc.RestrictedChannels, tc.Term, options)
			s.Nil(err)
			s.Len(r, len(tc.Result))
			s.ElementsMatch(r, tc.Result)
		})
	}
}

func (s *BleveEngineTestSuite) TestBleveDeleteUser() {
	// Create and index a user
	user := createUser("test.user", "testuser", "Test", "User")
	s.Nil(s.engine.IndexUser(user, []string{}, []string{}))

	// Check the user is there.
	result, err := s.engine.userIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{user.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 1)
	s.Equal(user.Id, result.Hits[0].ID)

	// Delete the user.
	s.Nil(s.engine.DeleteUser(user))

	// Check the user is not there.
	result, err = s.engine.userIndex.Search(bleve.NewSearchRequest(bleve.NewDocIDQuery([]string{user.Id})))
	s.Require().Nil(err)
	s.Len(result.Hits, 0)
}
