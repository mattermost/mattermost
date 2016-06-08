// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"github.com/mattermost/platform/model"
	"testing"
	"time"
)

func TestEmojiSaveDelete(t *testing.T) {
	Setup()

	emoji := model.Emoji{
		CreatorId: model.NewId(),
		Name:      model.NewId(),
	}

	if result := <-store.Emoji().Save(&emoji); result.Err != nil {
		t.Fatal(result.Err)
	}

	if len(emoji.Id) != 26 {
		t.Fatal("should've set id for emoji")
	}

	if result := <-store.Emoji().Delete(emoji.Id, time.Now().Unix()); result.Err != nil {
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
		if result := <-store.Emoji().Get(emoji.Id); result.Err != nil {
			t.Fatalf("failed to get emoji with id %v: %v", emoji.Id, result.Err)
		}
	}
}

func TestEmojiGetAll(t *testing.T) {
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

	if result := <-store.Emoji().GetAll(); result.Err != nil {
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
