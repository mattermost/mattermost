package bleveengine

import (
	"fmt"
	"io/ioutil"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/model"

	"github.com/blevesearch/bleve"
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

func (s *BleveEngineTestSuite) SetupTest() {
	dirname, err := ioutil.TempDir(os.TempDir(), "mm_bleveengine_")
	if err != nil {
		s.FailNow("Can't create temporal index directory: " + err.Error())
	}

	cfg := &model.Config{
		BleveSettings: model.BleveSettings{
			IndexDir: model.NewString(dirname),
		},
	}
	blvEngine, err := NewBleveEngine(cfg, nil, nil)
	if err != nil {
		s.FailNow("Can't create bleve engine instance: " + err.Error())
	}

	s.engine = blvEngine
}

func (s *BleveEngineTestSuite) TearDownTest() {
	if err := os.RemoveAll(*s.engine.cfg.BleveSettings.IndexDir); err != nil {
		s.FailNow("Can't remove temporal index directory: " + err.Error())
	}
}

func (s *BleveEngineTestSuite) TestBleveIndexChannel() {
	channel := createChannel("team-id", "channel", "test channel")
	s.Require().Nil(s.engine.IndexChannel(channel))

	q := bleve.NewDocIDQuery([]string{channel.Id})
	result, err := s.engine.channelIndex.Search(bleve.NewSearchRequest(q))
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
		q := bleve.NewDocIDQuery([]string{cId})
		result, err := s.engine.channelIndex.Search(bleve.NewSearchRequest(q))
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
