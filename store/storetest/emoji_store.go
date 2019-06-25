// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEmojiStore(t *testing.T, ss store.Store) {
	t.Run("EmojiSaveDelete", func(t *testing.T) { testEmojiSaveDelete(t, ss) })
	t.Run("EmojiGet", func(t *testing.T) { testEmojiGet(t, ss) })
	t.Run("EmojiGetByName", func(t *testing.T) { testEmojiGetByName(t, ss) })
	t.Run("EmojiGetMultipleByName", func(t *testing.T) { testEmojiGetMultipleByName(t, ss) })
	t.Run("EmojiGetList", func(t *testing.T) { testEmojiGetList(t, ss) })
	t.Run("EmojiSearch", func(t *testing.T) { testEmojiSearch(t, ss) })
}

func testEmojiSaveDelete(t *testing.T, ss store.Store) {
	emoji1 := &model.Emoji{
		CreatorId: model.NewId(),
		Name:      model.NewId(),
	}

	if _, err := ss.Emoji().Save(emoji1); err != nil {
		t.Fatal(err)
	}

	if len(emoji1.Id) != 26 {
		t.Fatal("should've set id for emoji")
	}

	emoji2 := model.Emoji{
		CreatorId: model.NewId(),
		Name:      emoji1.Name,
	}
	if _, err := ss.Emoji().Save(&emoji2); err == nil {
		t.Fatal("shouldn't be able to save emoji with duplicate name")
	}

	if err := ss.Emoji().Delete(emoji1.Id, time.Now().Unix()); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Emoji().Save(&emoji2); err != nil {
		t.Fatal("should be able to save emoji with duplicate name now that original has been deleted", err)
	}

	if err := ss.Emoji().Delete(emoji2.Id, time.Now().Unix()+1); err != nil {
		t.Fatal(err)
	}
}

func testEmojiGet(t *testing.T, ss store.Store) {
	emojis := []model.Emoji{
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
	}

	for i, emoji := range emojis {
		data, err := ss.Emoji().Save(&emoji)
		require.Nil(t, err)
		emojis[i] = *data
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji.Id, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	for _, emoji := range emojis {
		if _, err := ss.Emoji().Get(emoji.Id, false); err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, err)
		}
	}

	for _, emoji := range emojis {
		if _, err := ss.Emoji().Get(emoji.Id, true); err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, err)
		}
	}

	for _, emoji := range emojis {
		if _, err := ss.Emoji().Get(emoji.Id, true); err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, err)
		}
	}
}

func testEmojiGetByName(t *testing.T, ss store.Store) {
	emojis := []model.Emoji{
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
	}

	for i, emoji := range emojis {
		data, err := ss.Emoji().Save(&emoji)
		require.Nil(t, err)
		emojis[i] = *data
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji.Id, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	for _, emoji := range emojis {
		if _, err := ss.Emoji().GetByName(emoji.Name); err != nil {
			t.Fatalf("failed to get emoji with name %v: %v", emoji.Name, err)
		}
	}
}

func testEmojiGetMultipleByName(t *testing.T, ss store.Store) {
	emojis := []model.Emoji{
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
	}

	for i, emoji := range emojis {
		data, err := ss.Emoji().Save(&emoji)
		require.Nil(t, err)
		emojis[i] = *data
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji.Id, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	t.Run("one emoji", func(t *testing.T) {
		if result := <-ss.Emoji().GetMultipleByName([]string{emojis[0].Name}); result.Err != nil {
			t.Fatal("could not get emoji", result.Err)
		} else if received := result.Data.([]*model.Emoji); len(received) != 1 || *received[0] != emojis[0] {
			t.Fatal("got incorrect emoji")
		}
	})

	t.Run("multiple emojis", func(t *testing.T) {
		if result := <-ss.Emoji().GetMultipleByName([]string{emojis[0].Name, emojis[1].Name, emojis[2].Name}); result.Err != nil {
			t.Fatal("could not get emojis", result.Err)
		} else if received := result.Data.([]*model.Emoji); len(received) != 3 {
			t.Fatal("got incorrect emojis")
		}
	})

	t.Run("one nonexistent emoji", func(t *testing.T) {
		if result := <-ss.Emoji().GetMultipleByName([]string{"ab"}); result.Err != nil {
			t.Fatal("could not get emoji", result.Err)
		} else if received := result.Data.([]*model.Emoji); len(received) != 0 {
			t.Fatal("got incorrect emoji")
		}
	})

	t.Run("multiple emojis with nonexistent names", func(t *testing.T) {
		if result := <-ss.Emoji().GetMultipleByName([]string{emojis[0].Name, emojis[1].Name, emojis[2].Name, "abcd", "1234"}); result.Err != nil {
			t.Fatal("could not get emojis", result.Err)
		} else if received := result.Data.([]*model.Emoji); len(received) != 3 {
			t.Fatal("got incorrect emojis")
		}
	})
}

func testEmojiGetList(t *testing.T, ss store.Store) {
	emojis := []model.Emoji{
		{
			CreatorId: model.NewId(),
			Name:      "00000000000000000000000000a" + model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      "00000000000000000000000000b" + model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      "00000000000000000000000000c" + model.NewId(),
		},
	}

	for i, emoji := range emojis {
		data, err := ss.Emoji().Save(&emoji)
		require.Nil(t, err)
		emojis[i] = *data
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji.Id, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	if result, err := ss.Emoji().GetList(0, 100, ""); err != nil {
		t.Fatal(err)
	} else {
		for _, emoji := range emojis {
			found := false

			for _, savedEmoji := range result {
				if emoji.Id == savedEmoji.Id {
					found = true
					break
				}
			}

			if !found {
				t.Fatalf("failed to get emoji with id %v", emoji.Id)
			}
		}
	}

	remojis, err := ss.Emoji().GetList(0, 3, model.EMOJI_SORT_BY_NAME)
	assert.Nil(t, err)
	assert.Equal(t, 3, len(remojis))
	assert.Equal(t, emojis[0].Name, remojis[0].Name)
	assert.Equal(t, emojis[1].Name, remojis[1].Name)
	assert.Equal(t, emojis[2].Name, remojis[2].Name)

	remojis, err = ss.Emoji().GetList(1, 2, model.EMOJI_SORT_BY_NAME)
	assert.Nil(t, err)
	assert.Equal(t, 2, len(remojis))
	assert.Equal(t, emojis[1].Name, remojis[0].Name)
	assert.Equal(t, emojis[2].Name, remojis[1].Name)

}

func testEmojiSearch(t *testing.T, ss store.Store) {
	emojis := []model.Emoji{
		{
			CreatorId: model.NewId(),
			Name:      "blargh_" + model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId() + "_blargh",
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId() + "_blargh_" + model.NewId(),
		},
		{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		},
	}

	for i, emoji := range emojis {
		data, err := ss.Emoji().Save(&emoji)
		require.Nil(t, err)
		emojis[i] = *data
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji.Id, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	shouldFind := []bool{true, false, false, false}

	if result, err := ss.Emoji().Search("blargh", true, 100); err != nil {
		t.Fatal(err)
	} else {
		for i, emoji := range emojis {
			found := false

			for _, savedEmoji := range result {
				if emoji.Id == savedEmoji.Id {
					found = true
					break
				}
			}

			assert.Equal(t, shouldFind[i], found, emoji.Name)
		}
	}

	shouldFind = []bool{true, true, true, false}
	if result, err := ss.Emoji().Search("blargh", false, 100); err != nil {
		t.Fatal(err)
	} else {
		for i, emoji := range emojis {
			found := false

			for _, savedEmoji := range result {
				if emoji.Id == savedEmoji.Id {
					found = true
					break
				}
			}

			assert.Equal(t, shouldFind[i], found, emoji.Name)
		}
	}
}
