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
	t.Run("EmojiCaching", func(t *testing.T) { testEmojiCaching(t, ss) })
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

	if err := ss.Emoji().Delete(emoji1, time.Now().Unix()); err != nil {
		t.Fatal(err)
	}

	if _, err := ss.Emoji().Save(&emoji2); err != nil {
		t.Fatal("should be able to save emoji with duplicate name now that original has been deleted", err)
	}

	if err := ss.Emoji().Delete(&emoji2, time.Now().Unix()+1); err != nil {
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
			err := ss.Emoji().Delete(&emoji, time.Now().Unix())
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
}

func testEmojiCaching(t *testing.T, ss store.Store) {
	emojis := make([]*model.Emoji, 3)
	for i := range emojis {
		emojis[i] = &model.Emoji{
			CreatorId: model.NewId(),
			Name:      model.NewId(),
		}
	}

	for _, emoji := range emojis {
		_, err := ss.Emoji().Save(emoji)
		require.Nil(t, err)
	}
	defer func() {
		for _, emoji := range emojis {
			err := ss.Emoji().Delete(emoji, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	var retrievedEmoji *model.Emoji
	var cachedEmoji *model.Emoji
	var err *model.AppError

	for _, emoji := range emojis {
		cachedEmoji, err = ss.Emoji().Get(emoji.Id, true)
		assert.Nilf(t, err, "should be able to retrieve emoji with id %v", emoji.Id)

		retrievedEmoji, err = ss.Emoji().Get(emoji.Id, false)
		if assert.Nilf(t, err, "should be able to retrieve emoji with id %v", emoji.Id) {
			assert.Falsef(t, retrievedEmoji == cachedEmoji, "should not be the same as cached with id %v", emoji.Id)
		}

		retrievedEmoji, err = ss.Emoji().Get(emoji.Id, true)
		if assert.Nilf(t, err, "should be able to retrieve emoji with id %v", emoji.Id) {
			assert.Truef(t, retrievedEmoji == cachedEmoji, "should be the cached emoji with id %v", emoji.Id)
		}

		retrievedEmoji, err = ss.Emoji().GetByName(emoji.Name, false)
		if assert.Nilf(t, err, "should be able to retrieve emoji with name %v", emoji.Name) {
			assert.Falsef(t, retrievedEmoji == cachedEmoji, "should not be the same as cached with name %v", emoji.Name)
		}

		retrievedEmoji, _ = ss.Emoji().GetByName(emoji.Name, true)
		if assert.Nilf(t, err, "should be able to retrieve emoji with name %v", emoji.Name) {
			assert.Truef(t, retrievedEmoji == cachedEmoji, "should be the cached emoji with name %v", emoji.Name)
		}
	}

	_, err = ss.Emoji().Get(model.NewId(), false)
	assert.NotNilf(t, err, "should not retrieve emoji with unsaved ID")
	_, err = ss.Emoji().GetByName(model.NewId(), false)
	assert.NotNilf(t, err, "should not retrieve emoji with unsaved name")
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
			err := ss.Emoji().Delete(&emoji, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	for _, emoji := range emojis {
		if _, err := ss.Emoji().GetByName(emoji.Name, true); err != nil {
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
			err := ss.Emoji().Delete(&emoji, time.Now().Unix())
			require.Nil(t, err)
		}
	}()

	t.Run("one emoji", func(t *testing.T) {
		if received, err := ss.Emoji().GetMultipleByName([]string{emojis[0].Name}); err != nil {
			t.Fatal("could not get emoji", err)
		} else if len(received) != 1 || *received[0] != emojis[0] {
			t.Fatal("got incorrect emoji")
		}
	})

	t.Run("multiple emojis", func(t *testing.T) {
		if received, err := ss.Emoji().GetMultipleByName([]string{emojis[0].Name, emojis[1].Name, emojis[2].Name}); err != nil {
			t.Fatal("could not get emojis", err)
		} else if len(received) != 3 {
			t.Fatal("got incorrect emojis")
		}
	})

	t.Run("one nonexistent emoji", func(t *testing.T) {
		if received, err := ss.Emoji().GetMultipleByName([]string{"ab"}); err != nil {
			t.Fatal("could not get emoji", err)
		} else if len(received) != 0 {
			t.Fatal("got incorrect emoji")
		}
	})

	t.Run("multiple emojis with nonexistent names", func(t *testing.T) {
		if received, err := ss.Emoji().GetMultipleByName([]string{emojis[0].Name, emojis[1].Name, emojis[2].Name, "abcd", "1234"}); err != nil {
			t.Fatal("could not get emojis", err)
		} else if len(received) != 3 {
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
			err := ss.Emoji().Delete(&emoji, time.Now().Unix())
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
			err := ss.Emoji().Delete(&emoji, time.Now().Unix())
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
