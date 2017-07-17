// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
	"time"
)

func TestEmojiSaveDelete(t *testing.T) {
	Setup()

	emoji1 := &model.Emoji{
		CreatorId: model.NewId(),
		Name:      model.NewId(),
	}

	if result := <-store.Emoji().Save(emoji1); result.Err != nil {
		t.Fatal(result.Err)
	}

	if len(emoji1.Id) != 26 {
		t.Fatal("should've set id for emoji")
	}

	emoji2 := model.Emoji{
		CreatorId: model.NewId(),
		Name:      emoji1.Name,
	}
	if result := <-store.Emoji().Save(&emoji2); result.Err == nil {
		t.Fatal("shouldn't be able to save emoji with duplicate name")
	}

	if result := <-store.Emoji().Delete(emoji1.Id, time.Now().Unix()); result.Err != nil {
		t.Fatal(result.Err)
	}

	if result := <-store.Emoji().Save(&emoji2); result.Err != nil {
		t.Fatal("should be able to save emoji with duplicate name now that original has been deleted", result.Err)
	}

	if result := <-store.Emoji().Delete(emoji2.Id, time.Now().Unix()+1); result.Err != nil {
		t.Fatal(result.Err)
	}
}

func TestEmojiGet(t *testing.T) {
	Setup()

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
		emojis[i] = *Must(store.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			Must(store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	for _, emoji := range emojis {
		if result := <-store.Emoji().Get(emoji.Id, false); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}

	for _, emoji := range emojis {
		if result := <-store.Emoji().Get(emoji.Id, true); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}

	for _, emoji := range emojis {
		if result := <-store.Emoji().Get(emoji.Id, true); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}
}

func TestEmojiGetByName(t *testing.T) {
	Setup()

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
		emojis[i] = *Must(store.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			Must(store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	for _, emoji := range emojis {
		if result := <-store.Emoji().GetByName(emoji.Name); result.Err != nil {
			t.Fatalf("failed to get emoji with name %v: %v", emoji.Name, result.Err)
		}
	}
}

func TestEmojiGetList(t *testing.T) {
	Setup()

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
		emojis[i] = *Must(store.Emoji().Save(&emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			Must(store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	if result := <-store.Emoji().GetList(0, 100); result.Err != nil {
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
}
