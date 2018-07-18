package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetReactionCountsForPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := th.BasicPost

	reactions := []*model.Reaction{
		{
			UserId:    th.BasicUser.Id,
			EmojiName: "smile",
		},
		{
			UserId:    th.BasicUser.Id,
			EmojiName: "frowning",
		},
		{
			UserId:    th.BasicUser2.Id,
			EmojiName: "smile",
		},
		{
			UserId:    th.BasicUser2.Id,
			EmojiName: "neutral_face",
		},
	}
	for _, reaction := range reactions {
		reaction.PostId = post.Id

		if _, err := th.App.SaveReactionForPost(reaction); err != nil {
			t.Fatal(err)
		}
	}

	if reactionCounts, err := th.App.getReactionCountsForPost(post.Id); err != nil {
		t.Fatal(err)
	} else if len(reactionCounts) != 3 {
		t.Fatal("should've received counts for 3 reactions")
	} else if reactionCounts["smile"] != 2 {
		t.Fatal("should've received 2 smile reactions")
	} else if reactionCounts["frowning"] != 1 {
		t.Fatal("should've received 1 frowning reaction")
	} else if reactionCounts["neutral_face"] != 1 {
		t.Fatal("should've received 2 neutral_face reaction")
	}
}
