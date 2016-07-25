// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"
	"time"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
)

func TestGetEmoji(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient

	EnableCustomEmoji := *utils.Cfg.ServiceSettings.EnableCustomEmoji
	defer func() {
		*utils.Cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji
	}()
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true

	emojis := []*model.Emoji{
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
		emojis[i] = store.Must(Srv.Store.Emoji().Save(emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(Srv.Store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		}
	}()

	if returnedEmojis, err := Client.ListEmoji(); err != nil {
		t.Fatal(err)
	} else {
		for _, emoji := range emojis {
			found := false

			for _, savedEmoji := range returnedEmojis {
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

	deleted := &model.Emoji{
		CreatorId: model.NewId(),
		Name:      model.NewId(),
		DeleteAt:  1,
	}
	deleted = store.Must(Srv.Store.Emoji().Save(deleted)).(*model.Emoji)

	if returnedEmojis, err := Client.ListEmoji(); err != nil {
		t.Fatal(err)
	} else {
		found := false

		for _, savedEmoji := range returnedEmojis {
			if deleted.Id == savedEmoji.Id {
				found = true
				break
			}
		}

		if found {
			t.Fatalf("souldn't have gotten deleted emoji %v", deleted.Id)
		}
	}
}

func TestCreateEmoji(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.BasicClient

	EnableCustomEmoji := *utils.Cfg.ServiceSettings.EnableCustomEmoji
	defer func() {
		*utils.Cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji
	}()
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = false

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	// try to create an emoji when they're disabled
	if _, err := Client.CreateEmoji(emoji, createTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji when they're disabled")
	}

	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true

	// try to create a valid gif emoji when they're enabled
	if emojiResult, err := Client.CreateEmoji(emoji, createTestGif(t, 10, 10), "image.gif"); err != nil {
		t.Fatal(err)
	} else {
		emoji = emojiResult
	}

	// try to create an emoji with a duplicate name
	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      emoji.Name,
	}
	if _, err := Client.CreateEmoji(emoji2, createTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji with a duplicate name")
	}

	Client.MustGeneric(Client.DeleteEmoji(emoji.Id))

	// try to create a valid animated gif emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if emojiResult, err := Client.CreateEmoji(emoji, createTestAnimatedGif(t, 10, 10, 10), "image.gif"); err != nil {
		t.Fatal(err)
	} else {
		emoji = emojiResult
	}
	Client.MustGeneric(Client.DeleteEmoji(emoji.Id))

	// try to create a valid jpeg emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if emojiResult, err := Client.CreateEmoji(emoji, createTestJpeg(t, 10, 10), "image.jpeg"); err != nil {
		t.Fatal(err)
	} else {
		emoji = emojiResult
	}
	Client.MustGeneric(Client.DeleteEmoji(emoji.Id))

	// try to create a valid png emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if emojiResult, err := Client.CreateEmoji(emoji, createTestPng(t, 10, 10), "image.png"); err != nil {
		t.Fatal(err)
	} else {
		emoji = emojiResult
	}
	Client.MustGeneric(Client.DeleteEmoji(emoji.Id))

	// try to create an emoji that's too wide
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, createTestGif(t, 1000, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji that's too wide")
	}

	// try to create an emoji that's too tall
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, createTestGif(t, 10, 1000), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji that's too tall")
	}

	// try to create an emoji that's too large
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, createTestAnimatedGif(t, 100, 100, 4000), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji that's too large")
	}

	// try to create an emoji with data that isn't an image
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, make([]byte, 100, 100), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji with non-image data")
	}

	// try to create an emoji as another user
	emoji = &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, createTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji as another user")
	}
}

func TestDeleteEmoji(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	Client := th.BasicClient

	EnableCustomEmoji := *utils.Cfg.ServiceSettings.EnableCustomEmoji
	defer func() {
		*utils.Cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji
	}()
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = false

	emoji1 := createTestEmoji(t, &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}, createTestGif(t, 10, 10))

	if _, err := Client.DeleteEmoji(emoji1.Id); err == nil {
		t.Fatal("shouldn't have been able to delete an emoji when they're disabled")
	}

	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true

	if deleted, err := Client.DeleteEmoji(emoji1.Id); err != nil {
		t.Fatal(err)
	} else if !deleted {
		t.Fatalf("should be able to delete your own emoji %v", emoji1.Id)
	}

	if _, err := Client.DeleteEmoji(emoji1.Id); err == nil {
		t.Fatal("shouldn't be able to delete an already-deleted emoji")
	}

	emoji2 := createTestEmoji(t, &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}, createTestGif(t, 10, 10))

	if _, err := Client.DeleteEmoji(emoji2.Id); err == nil {
		t.Fatal("shouldn't be able to delete another user's emoji")
	}

	if deleted, err := th.SystemAdminClient.DeleteEmoji(emoji2.Id); err != nil {
		t.Fatal(err)
	} else if !deleted {
		t.Fatalf("system admin should be able to delete anyone's emoji %v", emoji2.Id)
	}
}

func createTestGif(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := gif.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil); err != nil {
		t.Fatalf("failed to create gif: %v", err.Error())
	}

	return buffer.Bytes()
}

func createTestAnimatedGif(t *testing.T, width int, height int, frames int) []byte {
	var buffer bytes.Buffer

	img := gif.GIF{
		Image: make([]*image.Paletted, frames, frames),
		Delay: make([]int, frames, frames),
	}
	for i := 0; i < frames; i++ {
		img.Image[i] = image.NewPaletted(image.Rect(0, 0, width, height), color.Palette{color.Black})
		img.Delay[i] = 0
	}
	if err := gif.EncodeAll(&buffer, &img); err != nil {
		t.Fatalf("failed to create animated gif: %v", err.Error())
	}

	return buffer.Bytes()
}

func createTestJpeg(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := jpeg.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil); err != nil {
		t.Fatalf("failed to create jpeg: %v", err.Error())
	}

	return buffer.Bytes()
}

func createTestPng(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
		t.Fatalf("failed to create png: %v", err.Error())
	}

	return buffer.Bytes()
}

func createTestEmoji(t *testing.T, emoji *model.Emoji, imageData []byte) *model.Emoji {
	emoji = store.Must(Srv.Store.Emoji().Save(emoji)).(*model.Emoji)

	if err := WriteFile(imageData, "emoji/"+emoji.Id+"/image"); err != nil {
		store.Must(Srv.Store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		t.Fatalf("failed to write image: %v", err.Error())
	}

	return emoji
}

func TestGetEmojiImage(t *testing.T) {
	th := Setup().InitBasic()
	Client := th.BasicClient

	EnableCustomEmoji := *utils.Cfg.ServiceSettings.EnableCustomEmoji
	RestrictCustomEmojiCreation := *utils.Cfg.ServiceSettings.RestrictCustomEmojiCreation
	defer func() {
		*utils.Cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji
		*utils.Cfg.ServiceSettings.RestrictCustomEmojiCreation = RestrictCustomEmojiCreation
	}()
	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true
	*utils.Cfg.ServiceSettings.RestrictCustomEmojiCreation = model.RESTRICT_EMOJI_CREATION_ALL

	emoji1 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji1 = Client.MustGeneric(Client.CreateEmoji(emoji1, createTestGif(t, 10, 10), "image.gif")).(*model.Emoji)
	defer func() { Client.MustGeneric(Client.DeleteEmoji(emoji1.Id)) }()

	*utils.Cfg.ServiceSettings.EnableCustomEmoji = false

	if _, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji1.Id), "", ""); err == nil {
		t.Fatal("should've failed to get emoji image when disabled")
	}

	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true

	if resp, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji1.Id), "", ""); err != nil {
		t.Fatal(err)
	} else if resp.Header.Get("Content-Type") != "image/gif" {
		t.Fatal("should've received a gif")
	} else if _, imageType, err := image.DecodeConfig(resp.Body); err != nil {
		t.Fatalf("unable to identify received image: %v", err.Error())
	} else if imageType != "gif" {
		t.Fatal("should've received gif data")
	}

	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji2 = Client.MustGeneric(Client.CreateEmoji(emoji2, createTestAnimatedGif(t, 10, 10, 10), "image.gif")).(*model.Emoji)
	defer func() { Client.MustGeneric(Client.DeleteEmoji(emoji2.Id)) }()

	if resp, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji2.Id), "", ""); err != nil {
		t.Fatal(err)
	} else if resp.Header.Get("Content-Type") != "image/gif" {
		t.Fatal("should've received a gif")
	} else if _, imageType, err := image.DecodeConfig(resp.Body); err != nil {
		t.Fatalf("unable to identify received image: %v", err.Error())
	} else if imageType != "gif" {
		t.Fatal("should've received gif data")
	}

	emoji3 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji3 = Client.MustGeneric(Client.CreateEmoji(emoji3, createTestJpeg(t, 10, 10), "image.jpeg")).(*model.Emoji)
	defer func() { Client.MustGeneric(Client.DeleteEmoji(emoji3.Id)) }()

	if resp, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji3.Id), "", ""); err != nil {
		t.Fatal(err)
	} else if resp.Header.Get("Content-Type") != "image/jpeg" {
		t.Fatal("should've received a jpeg")
	} else if _, imageType, err := image.DecodeConfig(resp.Body); err != nil {
		t.Fatalf("unable to identify received image: %v", err.Error())
	} else if imageType != "jpeg" {
		t.Fatal("should've received jpeg data")
	}

	emoji4 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji4 = Client.MustGeneric(Client.CreateEmoji(emoji4, createTestPng(t, 10, 10), "image.png")).(*model.Emoji)
	defer func() { Client.MustGeneric(Client.DeleteEmoji(emoji4.Id)) }()

	if resp, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji4.Id), "", ""); err != nil {
		t.Fatal(err)
	} else if resp.Header.Get("Content-Type") != "image/png" {
		t.Fatal("should've received a png")
	} else if _, imageType, err := image.DecodeConfig(resp.Body); err != nil {
		t.Fatalf("unable to identify received image: %v", err.Error())
	} else if imageType != "png" {
		t.Fatal("should've received png data")
	}

	emoji5 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji5 = Client.MustGeneric(Client.CreateEmoji(emoji5, createTestPng(t, 10, 10), "image.png")).(*model.Emoji)
	Client.MustGeneric(Client.DeleteEmoji(emoji5.Id))

	if _, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji5.Id), "", ""); err == nil {
		t.Fatal("should've failed to get image for deleted emoji")
	}
}
