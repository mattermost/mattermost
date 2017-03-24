// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestCreateEmoji(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

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
	_, resp := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	CheckNotImplementedStatus(t, resp)

	*utils.Cfg.ServiceSettings.EnableCustomEmoji = true
	// try to create a valid gif emoji when they're enabled
	newEmoji, resp := Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create an emoji with a duplicate name
	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      newEmoji.Name,
	}
	_, resp = Client.CreateEmoji(emoji2, utils.CreateTestGif(t, 10, 10), "image.gif")
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "api.emoji.create.duplicate.app_error")

	// try to create a valid animated gif emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, resp = Client.CreateEmoji(emoji, utils.CreateTestAnimatedGif(t, 10, 10, 10), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create a valid jpeg emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, resp = Client.CreateEmoji(emoji, utils.CreateTestJpeg(t, 10, 10), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create a valid png emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, resp = Client.CreateEmoji(emoji, utils.CreateTestPng(t, 10, 10), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create an emoji that's too wide
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, resp = Client.CreateEmoji(emoji, utils.CreateTestGif(t, 1000, 10), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create an emoji that's too tall
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, resp = Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 1000), "image.gif")
	CheckNoError(t, resp)
	if newEmoji.Name != emoji.Name {
		t.Fatal("create with wrong name")
	}

	// try to create an emoji that's too large
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, resp = Client.CreateEmoji(emoji, utils.CreateTestAnimatedGif(t, 100, 100, 10000), "image.gif")
	if resp.Error == nil {
		t.Fatal("should fail - emoji is too big")
	}

	// try to create an emoji with data that isn't an image
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, resp = Client.CreateEmoji(emoji, make([]byte, 100, 100), "image.gif")
	CheckBadRequestStatus(t, resp)
	CheckErrorMessage(t, resp, "api.emoji.upload.image.app_error")

	// try to create an emoji as another user
	emoji = &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}

	_, resp = Client.CreateEmoji(emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	CheckForbiddenStatus(t, resp)
}
