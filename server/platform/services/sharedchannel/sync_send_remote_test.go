// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestHandleUserMentions(t *testing.T) {
	t.Run("should handle mentions correctly for target remote users", func(t *testing.T) {
		// Create a post with two mentions: one with colon (from autocomplete) and one without
		post := &model.Post{
			Message: "Hello @user and @user:remote",
		}

		// Mention map with both formats of mentions
		mentionMap := model.UserMentionMap{
			"user":        "userid",
			"user:remote": "userid",
		}

		// Create a remote user object
		remoteId := "remoteid"
		user := &model.User{
			Id:       "userid",
			RemoteId: &remoteId,
			Props:    model.StringMap{model.UserPropsKeyRemoteUsername: "realuser"},
		}

		// Case 1: User from target remote with autocomplete mention should keep the mention (fixMention)
		postCopy1 := &model.Post{Message: post.Message}
		hasSelectedMention := true
		if hasSelectedMention {
			fixMention(postCopy1, mentionMap, user)
		} else {
			removeMention(postCopy1, mentionMap, user)
		}
		require.Equal(t, "Hello @user and @realuser", postCopy1.Message, "Should fix only the colon mention")

		// Case 2: User from target remote without autocomplete mention should remove mention (removeMention)
		postCopy2 := &model.Post{Message: post.Message}
		hasSelectedMention = false
		if hasSelectedMention {
			fixMention(postCopy2, mentionMap, user)
		} else {
			removeMention(postCopy2, mentionMap, user)
		}
		require.Equal(t, "Hello user and user:remote", postCopy2.Message, "Should remove mentions for user")

		// Case 3: User from different remote should always remove the mention
		differentRemoteId := "differentremoteid"
		user.RemoteId = &differentRemoteId
		postCopy3 := &model.Post{Message: post.Message}
		removeMention(postCopy3, mentionMap, user)
		require.Equal(t, "Hello user and user:remote", postCopy3.Message, "Should remove mentions for different remote user")
	})
}
