package app

import (
	"github.com/stretchr/testify/assert"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestReactionsOfPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := th.BasicPost
	post.HasReactions = true

	reactionObject := model.Reaction{
		UserId:    model.NewId(),
		PostId:    post.Id,
		EmojiName: "emoji",
		CreateAt:  model.GetMillis(),
	}

	th.App.SaveReactionForPost(&reactionObject)
	reactionsOfPost, err := th.App.BuildPostReactions(post.Id)

	if err != nil {
		t.Fatal("should have reactions")
	}

	assert.Equal(t, reactionObject.EmojiName, *(*reactionsOfPost)[0].EmojiName)
}
