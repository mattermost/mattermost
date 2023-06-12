// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

func TestTaskActionActions(t *testing.T) {
}

func TestTaskActionTriggers(t *testing.T) {
	t.Run("Keywords by user trigger", func(t *testing.T) {

		t.Run("validator", func(t *testing.T) {
			_, err := NewKeywordsByUsersTrigger(Trigger{
				Type:    KeywordsByUsersTriggerType,
				Payload: "",
			})
			require.Error(t, err)

			trigger, err := NewKeywordsByUsersTrigger(Trigger{
				Type:    KeywordsByUsersTriggerType,
				Payload: "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[]}",
			})
			require.NoError(t, err)
			require.NoError(t, trigger.IsValid())

			// Empty keywords and user_ids is valid. This means this trigger
			// is triggered on every posted message.
			// On the frontend, in the task actions modal, if the keywords input
			// is made empty, then the action is marked as disabled.
			trigger, err = NewKeywordsByUsersTrigger(Trigger{
				Type:    KeywordsByUsersTriggerType,
				Payload: "{\"keywords\":[], \"user_ids\":[]}",
			})
			require.NoError(t, err)
			require.NoError(t, trigger.IsValid())
		})

		t.Run("triggering", func(t *testing.T) {
			t.Run("simple", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.True(t, trigger.IsTriggered(&model.Post{Message: "one is a trigger word"}))
			})

			t.Run("trigger words with with formatting matches, backticks", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"phrase with `backticks`\", \"two\"], \"user_ids\":[]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.True(t, trigger.IsTriggered(&model.Post{Message: "post with a phrase with `backticks`"}))
			})

			t.Run("trigger words with with formatting matches, asterisks", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"phrase with *asterisks*\", \"two\"], \"user_ids\":[]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.True(t, trigger.IsTriggered(&model.Post{Message: "post with a phrase with *asterisks*"}))
			})

			t.Run("simple, post does not contain trigger word", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.False(t, trigger.IsTriggered(&model.Post{Message: "three is NOT a trigger word"}))
			})

			t.Run("With user specified in the trigger", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[\"abc\"]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.True(t, trigger.IsTriggered(&model.Post{Message: "one is a trigger word", UserId: "abc"}))
			})

			t.Run("With user specified in the trigger, but post is by other user", func(t *testing.T) {
				trigger, err := NewKeywordsByUsersTrigger(Trigger{
					Type:    KeywordsByUsersTriggerType,
					Payload: "{\"keywords\":[\"one\", \"two\"], \"user_ids\":[\"abc\"]}",
				})
				require.NoError(t, err)
				require.NoError(t, trigger.IsValid())
				require.False(t, trigger.IsTriggered(&model.Post{Message: "one is a trigger word", UserId: "def"}))
			})
		})
	})
}
