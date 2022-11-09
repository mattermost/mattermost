package storetest

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestHashtagStore(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("SaveMultipleForPosts", func(t *testing.T) { saveMultipleForPosts(t, ss) })
	t.Run("UpdateOnPostEdit", func(t *testing.T) { updateOnPostEdit(t, ss, s) })
	t.Run("UpdateOnPostOverwrite", func(t *testing.T) { updateOnPostOverwrite(t, ss, s) })
}

func saveMultipleForPosts(t *testing.T, ss store.Store) {
	t.Run("Save multiple hashtags", func(t *testing.T) {
		testSaveMultipleHashtags(t, ss)
	})

	t.Run("Save duplicate hashtags", func(t *testing.T) {
		testSaveDuplicateHashtags(t, ss)
	})

	t.Run("Save a single hashtag", func(t *testing.T) {
		testSaveSingleHashtag(t, ss)
	})

	t.Run("Save no hashtags", func(t *testing.T) {
		testSaveNoHashtags(t, ss)
	})
}

func updateOnPostEdit(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("Assign old hashtags to old post", func(t *testing.T) {
		testAssigningHashtagsToOldPostOnPostUpdate(t, ss, s)
	})

	t.Run("Create hashtags from new post", func(t *testing.T) {
		testCreatingHashtagsForUpdatedPost(t, ss, s)
	})
}

func updateOnPostOverwrite(t *testing.T, ss store.Store, s SqlStore) {
	t.Run("Update hashtags when a post is overwritten ", func(t *testing.T) {
		testUpdatingHashtagsForOverwrittenPost(t, ss, s)
	})
}

func testSaveMultipleHashtags(t *testing.T, ss store.Store) {
	post := model.Post{Id: model.NewId(), Hashtags: "#testing #new #mattermost #features"}
	results, err := ss.Hashtag().SaveMultipleForPosts([]*model.Post{&post})
	require.NoError(t, err)

	expected := []string{
		"#testing",
		"#new",
		"#mattermost",
		"#features",
	}

	for index, hashtag := range results {
		assert.Equal(t, expected[index], hashtag.Value)
	}
}

func testSaveDuplicateHashtags(t *testing.T, ss store.Store) {
	post := model.Post{Id: model.NewId(), Message: "I'm #testing, #testing and #testing"}
	results, err := ss.Hashtag().SaveMultipleForPosts([]*model.Post{&post})

	require.NoError(t, err)
	assert.Equal(t, 1, len(results))
}

func testSaveSingleHashtag(t *testing.T, ss store.Store) {
	post := model.Post{Id: model.NewId(), Message: "I'm #testing"}
	results, err := ss.Hashtag().SaveMultipleForPosts([]*model.Post{&post})

	require.NoError(t, err)
	assert.Equal(t, "#testing", results[0].Value)
}

func testSaveNoHashtags(t *testing.T, ss store.Store) {
	post := model.Post{Id: model.NewId(), Message: "post with no hashtags"}
	results, err := ss.Hashtag().SaveMultipleForPosts([]*model.Post{&post})

	require.NoError(t, err)
	assert.Len(t, results, 0)
}

func testAssigningHashtagsToOldPostOnPostUpdate(t *testing.T, ss store.Store, s SqlStore) {
	oldPost := model.Post{Id: "newId", OriginalId: "originalId"}
	newPost := oldPost.Clone()
	hashtag := model.Hashtag{Id: model.NewId(), PostId: "originalId", Value: "#abc"}
	_, err := ss.Hashtag().Save(&hashtag)
	require.NoError(t, err)
	err = ss.Hashtag().UpdateOnPostEdit(&oldPost, newPost)
	require.NoError(t, err)

	var hashtags []*model.Hashtag
	err = s.GetMasterX().Select(&hashtags, "SELECT * FROM Hashtags WHERE PostId = 'newId'")
	require.NoError(t, err)

	assert.Len(t, hashtags, 1)
	assert.Equal(t, hashtags[0].PostId, "newId")
}

func testCreatingHashtagsForUpdatedPost(t *testing.T, ss store.Store, s SqlStore) {
	newPostId := model.NewId()
	oldPostId := model.NewId()
	newPost := model.Post{Id: newPostId, Message: "post with a #hashtag"}
	oldPost := model.Post{Id: oldPostId, OriginalId: newPost.Id, Message: "post with no hashtags"}
	err := ss.Hashtag().UpdateOnPostEdit(&oldPost, &newPost)
	require.NoError(t, err)

	var hashtags []*model.Hashtag
	err = s.GetMasterX().Select(&hashtags, "SELECT * FROM Hashtags WHERE PostId = ?", newPost.Id)
	require.NoError(t, err)

	assert.Len(t, hashtags, 1)
	assert.Equal(t, hashtags[0].Value, "#hashtag")
}

func testUpdatingHashtagsForOverwrittenPost(t *testing.T, ss store.Store, s SqlStore) {
	postModel := model.Post{ChannelId: model.NewId(), UserId: model.NewId(), Message: "New #feature is coming!", Hashtags: "#feature"}
	postBeforeOverwrite, err := ss.Post().Save(&postModel)
	require.NoError(t, err)
	postAfterOverwrite := postBeforeOverwrite.Clone()
	postAfterOverwrite.Message = "#Winter is coming!"
	postAfterOverwrite.Hashtags = "#Winter"
	_, err = ss.Post().Overwrite(postAfterOverwrite)
	require.NoError(t, err)

	var hashtags []*model.Hashtag
	err = s.GetMasterX().Select(&hashtags, "SELECT * FROM Hashtags WHERE PostId = ?", postBeforeOverwrite.Id)
	require.NoError(t, err)

	assert.Len(t, hashtags, 1)
	assert.Equal(t, hashtags[0].Value, "#Winter")
}
