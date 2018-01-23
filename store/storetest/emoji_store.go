// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package storetest

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"

	"github.com/stretchr/testify/assert"
)

func TestEmojiStore(t *testing.T, ss store.Store) {
	t.Run("EmojiSaveDelete", func(t *testing.T) { testEmojiSaveDelete(t, ss) })
	t.Run("EmojiGet", func(t *testing.T) { testEmojiGet(t, ss) })
	t.Run("EmojiGetByName", func(t *testing.T) { testEmojiGetByName(t, ss) })
	t.Run("EmojiGetList", func(t *testing.T) { testEmojiGetList(t, ss) })
	t.Run("EmojiSearch", func(t *testing.T) { testEmojiSearch(t, ss) })
}

func testEmojiSaveDelete(t *testing.T, ss store.Store) {
	emoji1 := &model.Emoji{
		CreatorId: model.NewId(),
		Name:      model.NewId(),
	}

	if result := <-ss.Emoji().Save(emoji1); result.Err != nil {
		t.Fatal(result.Err)
	}

	if len(emoji1.Id) != 26 {
		t.Fatal("should've set id for emoji")
	}

	emoji2 := model.Emoji{
		CreatorId: model.NewId(),
		Name:      emoji1.Name,
	}
	if result := <-ss.Emoji().Save(&emoji2); result.Err == nil {
		t.Fatal("shouldn't be able to save emoji with duplicate name")
	}

	if result := <-ss.Emoji().Delete(emoji1.Id, time.Now().Unix()); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-ss.Emoji().Save(&emoji2); result.Err != nil {
		t.Fatal("should be able to save emoji with duplicate name now that original has been deleted", result.Err)
	}

	if result := <-ss.Emoji().Delete(emoji2.Id, time.Now().Unix()+1); result.Err != nil {
		t.Fatal(result.Err)
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
		emojis[i] = *store.Must(ss.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(ss.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	for _, emoji := range emojis {
		if result := <-ss.Emoji().Get(emoji.Id, false); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}

	for _, emoji := range emojis {
		if result := <-ss.Emoji().Get(emoji.Id, true); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}

	for _, emoji := range emojis {
		if result := <-ss.Emoji().Get(emoji.Id, true); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
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
		emojis[i] = *store.Must(ss.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(ss.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	for _, emoji := range emojis {
		if result := <-ss.Emoji().GetByName(emoji.Name); result.Err != nil {
			t.Fatalf("failed to get emoji with name %v: %v", emoji.Name, result.Err)
		}
	}
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
		emojis[i] = *store.Must(ss.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(ss.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	if result := <-ss.Emoji().GetList(0, 100, ""); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		for _, emoji := range emojis {
			found := false

			for _, savedEmoji := range result.Data.([]*model.Emoji) {
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

	result := <-ss.Emoji().GetList(0, 3, model.EMOJI_SORT_BY_NAME)
	assert.Nil(t, result.Err)
	remojis := result.Data.([]*model.Emoji)
	assert.Equal(t, 3, len(remojis))
	assert.Equal(t, emojis[0].Name, remojis[0].Name)
	assert.Equal(t, emojis[1].Name, remojis[1].Name)
	assert.Equal(t, emojis[2].Name, remojis[2].Name)

	result = <-ss.Emoji().GetList(1, 2, model.EMOJI_SORT_BY_NAME)
	assert.Nil(t, result.Err)
	remojis = result.Data.([]*model.Emoji)
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
		emojis[i] = *store.Must(ss.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(ss.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	shouldFind := []bool{true, false, false, false}

	if result := <-ss.Emoji().Search("blargh", true, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		for i, emoji := range emojis {
			found := false

			for _, savedEmoji := range result.Data.([]*model.Emoji) {
				if emoji.Id == savedEmoji.Id {
					found = true
					break
				}
			}

			assert.Equal(t, shouldFind[i], found, emoji.Name)
		}
	}

	shouldFind = []bool{true, true, true, false}
	if result := <-ss.Emoji().Search("blargh", false, 100); result.Err != nil {
		t.Fatal(result.Err)
	} else {
		for i, emoji := range emojis {
			found := false

			for _, savedEmoji := range result.Data.([]*model.Emoji) {
				if emoji.Id == savedEmoji.Id {
					found = true
					break
				}
			}

			assert.Equal(t, shouldFind[i], found, emoji.Name)
		}
	}
}
