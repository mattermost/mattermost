// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"image"
	"image/gif"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

func TestGetEmoji(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

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
		emojis[i] = store.Must(th.App.Srv.Store.Emoji().Save(emoji)).(*model.Emoji)
	}
	defer func() {
		for _, emoji := range emojis {
			store.Must(th.App.Srv.Store.Emoji().Delete(emoji.Id, time.Now().Unix()))
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
	deleted = store.Must(th.App.Srv.Store.Emoji().Save(deleted)).(*model.Emoji)

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
			t.Fatalf("shouldn't have gotten deleted emoji %v", deleted.Id)
		}
	}
}

func TestCreateEmoji(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = false })

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	// try to create an emoji when they're disabled
	if _, err := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji when they're disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	// try to create a valid gif emoji when they're enabled
	if emojiResult, err := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif"); err != nil {
		t.Fatal(err)
	} else {
		emoji = emojiResult
	}

	// try to create an emoji with a duplicate name
	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      emoji.Name,
	}
	if _, err := Client.CreateEmoji(emoji2, utils.CreateTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji with a duplicate name")
	}

	Client.MustGeneric(Client.DeleteEmoji(emoji.Id))

	// try to create a valid animated gif emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if emojiResult, err := Client.CreateEmoji(emoji, utils.CreateTestAnimatedGif(t, 10, 10, 10), "image.gif"); err != nil {
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
	if emojiResult, err := Client.CreateEmoji(emoji, utils.CreateTestJpeg(t, 10, 10), "image.jpeg"); err != nil {
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
	if emojiResult, err := Client.CreateEmoji(emoji, utils.CreateTestPng(t, 10, 10), "image.png"); err != nil {
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
	if _, err := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 1000, 10), "image.gif"); err != nil {
		t.Fatal("should be able to create an emoji that's too wide by resizing it")
	}

	// try to create an emoji that's too tall
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 1000), "image.gif"); err != nil {
		t.Fatal("should be able to create an emoji that's too tall by resizing it")
	}

	// try to create an emoji that's too large
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, utils.CreateTestAnimatedGif(t, 100, 100, 10000), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji that's too large")
	}

	// try to create an emoji with data that isn't an image
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, make([]byte, 100), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji with non-image data")
	}

	// try to create an emoji as another user
	emoji = &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}
	if _, err := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif"); err == nil {
		t.Fatal("shouldn't be able to create an emoji as another user")
	}
}

func TestDeleteEmoji(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.BasicClient

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = false })

	emoji1 := createTestEmoji(t, th.App, &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}, utils.CreateTestGif(t, 10, 10))

	if _, err := Client.DeleteEmoji(emoji1.Id); err == nil {
		t.Fatal("shouldn't have been able to delete an emoji when they're disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	if deleted, err := Client.DeleteEmoji(emoji1.Id); err != nil {
		t.Fatal(err)
	} else if !deleted {
		t.Fatalf("should be able to delete your own emoji %v", emoji1.Id)
	}

	if _, err := Client.DeleteEmoji(emoji1.Id); err == nil {
		t.Fatal("shouldn't be able to delete an already-deleted emoji")
	}

	emoji2 := createTestEmoji(t, th.App, &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}, utils.CreateTestGif(t, 10, 10))

	if _, err := Client.DeleteEmoji(emoji2.Id); err == nil {
		t.Fatal("shouldn't be able to delete another user's emoji")
	}

	if deleted, err := th.SystemAdminClient.DeleteEmoji(emoji2.Id); err != nil {
		t.Fatal(err)
	} else if !deleted {
		t.Fatalf("system admin should be able to delete anyone's emoji %v", emoji2.Id)
	}
}

func createTestEmoji(t *testing.T, a *app.App, emoji *model.Emoji, imageData []byte) *model.Emoji {
	emoji = store.Must(a.Srv.Store.Emoji().Save(emoji)).(*model.Emoji)

	if err := a.WriteFile(imageData, "emoji/"+emoji.Id+"/image"); err != nil {
		store.Must(a.Srv.Store.Emoji().Delete(emoji.Id, time.Now().Unix()))
		t.Fatalf("failed to write image: %v", err.Error())
	}

	return emoji
}

func TestGetEmojiImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	Client := th.BasicClient

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	RestrictCustomEmojiCreation := *th.App.Config().ServiceSettings.RestrictCustomEmojiCreation
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.RestrictCustomEmojiCreation = RestrictCustomEmojiCreation
		})
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.RestrictCustomEmojiCreation = model.RESTRICT_EMOJI_CREATION_ALL
	})

	emoji1 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji1 = Client.MustGeneric(Client.CreateEmoji(emoji1, utils.CreateTestGif(t, 10, 10), "image.gif")).(*model.Emoji)
	defer func() { Client.MustGeneric(Client.DeleteEmoji(emoji1.Id)) }()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = false })

	if _, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji1.Id), "", ""); err == nil {
		t.Fatal("should've failed to get emoji image when disabled")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

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
	emoji2 = Client.MustGeneric(Client.CreateEmoji(emoji2, utils.CreateTestAnimatedGif(t, 10, 10, 10), "image.gif")).(*model.Emoji)
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
	emoji3 = Client.MustGeneric(Client.CreateEmoji(emoji3, utils.CreateTestJpeg(t, 10, 10), "image.jpeg")).(*model.Emoji)
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
	emoji4 = Client.MustGeneric(Client.CreateEmoji(emoji4, utils.CreateTestPng(t, 10, 10), "image.png")).(*model.Emoji)
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
	emoji5 = Client.MustGeneric(Client.CreateEmoji(emoji5, utils.CreateTestPng(t, 10, 10), "image.png")).(*model.Emoji)
	Client.MustGeneric(Client.DeleteEmoji(emoji5.Id))

	if _, err := Client.DoApiGet(Client.GetCustomEmojiImageUrl(emoji5.Id), "", ""); err == nil {
		t.Fatal("should've failed to get image for deleted emoji")
	}
}

func TestResizeEmoji(t *testing.T) {
	// try to resize a jpeg image within MaxEmojiWidth and MaxEmojiHeight
	small_img_data := utils.CreateTestJpeg(t, app.MaxEmojiWidth, app.MaxEmojiHeight)
	if small_img, _, err := image.Decode(bytes.NewReader(small_img_data)); err != nil {
		t.Fatal("failed to decode jpeg bytes to image.Image")
	} else {
		resized_img := resizeEmoji(small_img, small_img.Bounds().Dx(), small_img.Bounds().Dy())
		if resized_img.Bounds().Dx() > app.MaxEmojiWidth || resized_img.Bounds().Dy() > app.MaxEmojiHeight {
			t.Fatal("resized jpeg width and height should not be greater than MaxEmojiWidth or MaxEmojiHeight")
		}
		if resized_img != small_img {
			t.Fatal("should've returned small_img itself")
		}
	}
	// try to resize a jpeg image
	jpeg_data := utils.CreateTestJpeg(t, 256, 256)
	if jpeg_img, _, err := image.Decode(bytes.NewReader(jpeg_data)); err != nil {
		t.Fatal("failed to decode jpeg bytes to image.Image")
	} else {
		resized_jpeg := resizeEmoji(jpeg_img, jpeg_img.Bounds().Dx(), jpeg_img.Bounds().Dy())
		if resized_jpeg.Bounds().Dx() > app.MaxEmojiWidth || resized_jpeg.Bounds().Dy() > app.MaxEmojiHeight {
			t.Fatal("resized jpeg width and height should not be greater than MaxEmojiWidth or MaxEmojiHeight")
		}
	}
	// try to resize a png image
	png_data := utils.CreateTestJpeg(t, 256, 256)
	if png_img, _, err := image.Decode(bytes.NewReader(png_data)); err != nil {
		t.Fatal("failed to decode png bytes to image.Image")
	} else {
		resized_png := resizeEmoji(png_img, png_img.Bounds().Dx(), png_img.Bounds().Dy())
		if resized_png.Bounds().Dx() > app.MaxEmojiWidth || resized_png.Bounds().Dy() > app.MaxEmojiHeight {
			t.Fatal("resized png width and height should not be greater than MaxEmojiWidth or MaxEmojiHeight")
		}
	}
	// try to resize an animated gif
	gif_data := utils.CreateTestAnimatedGif(t, 256, 256, 10)
	if gif_img, err := gif.DecodeAll(bytes.NewReader(gif_data)); err != nil {
		t.Fatal("failed to decode gif bytes to gif.GIF")
	} else {
		resized_gif := resizeEmojiGif(gif_img)
		if resized_gif.Config.Width > app.MaxEmojiWidth || resized_gif.Config.Height > app.MaxEmojiHeight {
			t.Fatal("resized gif width and height should not be greater than MaxEmojiWidth or MaxEmojiHeight")
		}
		if len(resized_gif.Image) != len(gif_img.Image) {
			t.Fatal("resized gif should have the same number of frames as original gif")
		}
	}
}
