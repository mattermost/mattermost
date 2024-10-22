// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"image"
	_ "image/gif"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestCreateEmoji(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = false })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	// constants to be used along with checkEmojiFile
	emojiWidth := app.MaxEmojiWidth
	emojiHeight := app.MaxEmojiHeight * 2
	// check that emoji gets resized correctly, respecting proportions, and is of expected type
	checkEmojiFile := func(id, expectedImageType string) {
		path, _ := fileutils.FindDir("data")
		file, fileErr := os.Open(filepath.Join(path, "/emoji/"+id+"/image"))
		require.NoError(t, fileErr)
		defer file.Close()
		config, imageType, err := image.DecodeConfig(file)
		require.NoError(t, err)
		require.Equal(t, expectedImageType, imageType)
		require.Equal(t, emojiWidth/2, config.Width)
		require.Equal(t, emojiHeight/2, config.Height)
	}

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	// try to create an emoji when they're disabled
	_, resp, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	// enable emoji creation for next cases
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	// try to create a valid gif emoji when they're enabled
	newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, emojiWidth, emojiHeight), "image.gif")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")
	checkEmojiFile(newEmoji.Id, "gif")

	// try to create an emoji with a duplicate name
	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      newEmoji.Name,
	}
	_, resp, err = client.CreateEmoji(context.Background(), emoji2, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "api.emoji.create.duplicate.app_error")

	// try to create a valid animated gif emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestAnimatedGif(t, emojiWidth, emojiHeight, 10), "image.gif")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")
	checkEmojiFile(newEmoji.Id, "gif")

	// try to create a valid webp emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	path, _ := fileutils.FindDir("tests")
	bytes, err := os.ReadFile(filepath.Join(path, "testwebp.webp"))
	require.NoError(t, err)
	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, bytes, "image.webp")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")
	checkEmojiFile(newEmoji.Id, "png") // emoji must be converted from webp to png

	// try to create a valid jpeg emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestJpeg(t, emojiWidth, emojiHeight), "image.jpeg")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")
	checkEmojiFile(newEmoji.Id, "png") // emoji must be converted from jpeg to png

	// try to create a valid png emoji
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestPng(t, emojiWidth, emojiHeight), "image.png")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")
	checkEmojiFile(newEmoji.Id, "png")

	// try to create an emoji that's too wide
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 1000, 10), "image.gif")
	require.NoError(t, err)
	require.Equal(t, newEmoji.Name, emoji.Name, "create with wrong name")

	// try to create an emoji that's too wide
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, app.MaxEmojiOriginalWidth+1), "image.gif")
	require.Error(t, err, "should fail - emoji is too wide")

	// try to create an emoji that's too tall
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, app.MaxEmojiOriginalHeight+1, 10), "image.gif")
	require.Error(t, err, "should fail - emoji is too tall")

	// try to create an emoji that's too large
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestAnimatedGif(t, 100, 100, 10000), "image.gif")
	require.Error(t, err, "should fail - emoji is too big")

	// try to create an emoji with data that isn't an image
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, resp, err = client.CreateEmoji(context.Background(), emoji, make([]byte, 100), "image.gif")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
	CheckErrorID(t, err, "api.emoji.upload.image.app_error")

	// try to create an emoji as another user
	emoji = &model.Emoji{
		CreatorId: th.BasicUser2.Id,
		Name:      model.NewId(),
	}

	_, resp, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// try to create an emoji without permissions
	th.RemovePermissionFromRole(model.PermissionCreateEmojis.Id, model.SystemUserRoleId)

	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, resp, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// create an emoji with permissions in one team
	th.AddPermissionToRole(model.PermissionCreateEmojis.Id, model.TeamUserRoleId)

	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	_, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)
}

func TestGetEmojiList(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	emojis := []*model.Emoji{
		{
			CreatorId: th.BasicUser.Id,
			Name:      model.NewId(),
		},
		{
			CreatorId: th.BasicUser.Id,
			Name:      model.NewId(),
		},
		{
			CreatorId: th.BasicUser.Id,
			Name:      model.NewId(),
		},
	}

	for idx, emoji := range emojis {
		newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
		require.NoError(t, err)
		emojis[idx] = newEmoji
	}

	listEmoji, _, err := client.GetEmojiList(context.Background(), 0, 100)
	require.NoError(t, err)
	for _, emoji := range emojis {
		found := false
		for _, savedEmoji := range listEmoji {
			if emoji.Id == savedEmoji.Id {
				found = true
				break
			}
		}
		require.Truef(t, found, "failed to get emoji with id %v, %v", emoji.Id, len(listEmoji))
	}

	_, err = client.DeleteEmoji(context.Background(), emojis[0].Id)
	require.NoError(t, err)
	listEmoji, _, err = client.GetEmojiList(context.Background(), 0, 100)
	require.NoError(t, err)
	found := false
	for _, savedEmoji := range listEmoji {
		if savedEmoji.Id == emojis[0].Id {
			found = true
			break
		}
	}
	require.Falsef(t, found, "should not get a deleted emoji %v", emojis[0].Id)

	listEmoji, _, err = client.GetEmojiList(context.Background(), 0, 1)
	require.NoError(t, err)

	require.Len(t, listEmoji, 1, "should only return 1")

	listEmoji, _, err = client.GetSortedEmojiList(context.Background(), 0, 100, model.EmojiSortByName)
	require.NoError(t, err)

	require.Greater(t, len(listEmoji), 0, "should return more than 0")
}

func TestGetEmojisByNames(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// Set up some custom emojis
	adminClient := th.SystemAdminClient

	imageBytes := utils.CreateTestJpeg(t, 10, 10)

	emoji1 := &model.Emoji{
		CreatorId: th.SystemAdminUser.Id,
		Name:      model.NewId(),
	}
	emoji1, _, err := adminClient.CreateEmoji(context.Background(), emoji1, imageBytes, "emoji.jpg")
	require.NoError(t, err)

	emoji2 := &model.Emoji{
		CreatorId: th.SystemAdminUser.Id,
		Name:      model.NewId(),
	}
	emoji2, _, err = adminClient.CreateEmoji(context.Background(), emoji2, imageBytes, "emoji.jpg")
	require.NoError(t, err)

	client := th.Client

	t.Run("should return a single emoji", func(t *testing.T) {
		emojis, _, err := client.GetEmojisByNames(context.Background(), []string{emoji1.Name})

		require.NoError(t, err)
		require.Len(t, emojis, 1)
		assert.Equal(t, emoji1.Id, emojis[0].Id)
	})

	t.Run("should return multiple emojis", func(t *testing.T) {
		emojis, _, err := client.GetEmojisByNames(context.Background(), []string{emoji1.Name, emoji2.Name})

		var emojiIds []string
		for _, emoji := range emojis {
			emojiIds = append(emojiIds, emoji.Id)
		}

		require.NoError(t, err)
		require.Len(t, emojis, 2)
		assert.Contains(t, emojiIds, emoji1.Id)
		assert.Contains(t, emojiIds, emoji2.Id)
	})

	t.Run("should ignore non-existent emojis", func(t *testing.T) {
		emojis, _, err := client.GetEmojisByNames(context.Background(), []string{emoji1.Name, emoji2.Name, model.NewId()})
		var emojiIds []string
		for _, emoji := range emojis {
			emojiIds = append(emojiIds, emoji.Id)
		}

		require.NoError(t, err)
		require.Len(t, emojis, 2)
		assert.Contains(t, emojiIds, emoji1.Id)
		assert.Contains(t, emojiIds, emoji2.Id)
	})

	t.Run("should return an error when too many emojis are requested", func(t *testing.T) {
		names := make([]string, GetEmojisByNamesMax+1)
		for i := 0; i < len(names); i++ {
			names[i] = model.NewId()
		}

		_, _, err := client.GetEmojisByNames(context.Background(), names)

		require.Error(t, err)
	})
}

func TestDeleteEmoji(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	defaultRolePermissions := th.SaveDefaultRolePermissions()
	defer func() {
		th.RestoreDefaultRolePermissions(defaultRolePermissions)
	}()

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	_, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)

	_, _, err = client.GetEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err, "expected error fetching deleted emoji")

	//Admin can delete other users emoji
	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	_, err = th.SystemAdminClient.DeleteEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)

	_, _, err = th.SystemAdminClient.GetEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err, "expected error fetching deleted emoji")

	// Try to delete just deleted emoji
	resp, err := client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	//Try to delete non-existing emoji
	resp, err = client.DeleteEmoji(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	//Try to delete without Id
	resp, err = client.DeleteEmoji(context.Background(), "")
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	//Try to delete my custom emoji without permissions
	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.RemovePermissionFromRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	resp, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)

	//Try to delete other user's custom emoji without DELETE_EMOJIS permissions
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.RemovePermissionFromRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteOthersEmojis.Id, model.SystemUserRoleId)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic2()

	resp, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.RemovePermissionFromRole(model.PermissionDeleteOthersEmojis.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic()

	//Try to delete other user's custom emoji without DELETE_OTHERS_EMOJIS permissions
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic2()

	resp, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic()

	//Try to delete other user's custom emoji with permissions
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteOthersEmojis.Id, model.SystemUserRoleId)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic2()

	_, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic()

	//Try to delete my custom emoji with permissions at team level
	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.RemovePermissionFromRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.TeamUserRoleId)
	_, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)
	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	th.RemovePermissionFromRole(model.PermissionDeleteEmojis.Id, model.TeamUserRoleId)

	//Try to delete other user's custom emoji with permissions at team level
	emoji = &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err = client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.RemovePermissionFromRole(model.PermissionDeleteEmojis.Id, model.SystemUserRoleId)
	th.RemovePermissionFromRole(model.PermissionDeleteOthersEmojis.Id, model.SystemUserRoleId)

	th.AddPermissionToRole(model.PermissionDeleteEmojis.Id, model.TeamUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteOthersEmojis.Id, model.TeamUserRoleId)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	th.LoginBasic2()

	_, err = client.DeleteEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)
}

func TestGetEmoji(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	EnableCustomEmoji := *th.App.Config().ServiceSettings.EnableCustomEmoji
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = EnableCustomEmoji })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	emoji, _, err = client.GetEmoji(context.Background(), newEmoji.Id)
	require.NoError(t, err)
	require.Equal(t, newEmoji.Id, emoji.Id, "wrong emoji was returned")

	_, resp, err := client.GetEmoji(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestGetEmojiByName(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	emoji := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	emoji, _, err = client.GetEmojiByName(context.Background(), newEmoji.Name)
	require.NoError(t, err)
	assert.Equal(t, newEmoji.Name, emoji.Name)

	_, resp, err := client.GetEmojiByName(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetEmojiByName(context.Background(), newEmoji.Name)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestGetEmojiImage(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	emoji1 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	emoji1, _, err := client.CreateEmoji(context.Background(), emoji1, utils.CreateTestGif(t, 10, 10), "image.gif")
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = false })

	_, resp, err := client.GetEmojiImage(context.Background(), emoji1.Id)
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
	CheckErrorID(t, err, "api.emoji.disabled.app_error")

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.FileSettings.DriverName = "local" })

	emojiImage, _, err := client.GetEmojiImage(context.Background(), emoji1.Id)
	require.NoError(t, err)
	require.Greater(t, len(emojiImage), 0, "should return the image")

	_, imageType, err := image.DecodeConfig(bytes.NewReader(emojiImage))
	require.NoError(t, err)
	require.Equal(t, imageType, "gif", "expected gif")

	emoji2 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}

	emoji2, _, err = client.CreateEmoji(context.Background(), emoji2, utils.CreateTestAnimatedGif(t, 10, 10, 10), "image.gif")
	require.NoError(t, err)

	emojiImage, _, err = client.GetEmojiImage(context.Background(), emoji2.Id)
	require.NoError(t, err)
	require.Greater(t, len(emojiImage), 0, "no image returned")

	_, imageType, err = image.DecodeConfig(bytes.NewReader(emojiImage))
	require.NoError(t, err, "unable to identify received image")
	require.Equal(t, imageType, "gif", "expected gif")

	emoji3 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji3, _, err = client.CreateEmoji(context.Background(), emoji3, utils.CreateTestJpeg(t, 10, 10), "image.jpg")
	require.NoError(t, err)

	emojiImage, _, err = client.GetEmojiImage(context.Background(), emoji3.Id)
	require.NoError(t, err)
	require.Greater(t, len(emojiImage), 0, "no image returned")

	_, imageType, err = image.DecodeConfig(bytes.NewReader(emojiImage))
	require.NoError(t, err, "unable to identify received image")
	require.Equal(t, imageType, "jpeg", "expected jpeg")

	emoji4 := &model.Emoji{
		CreatorId: th.BasicUser.Id,
		Name:      model.NewId(),
	}
	emoji4, _, err = client.CreateEmoji(context.Background(), emoji4, utils.CreateTestPng(t, 10, 10), "image.png")
	require.NoError(t, err)

	emojiImage, _, err = client.GetEmojiImage(context.Background(), emoji4.Id)
	require.NoError(t, err)
	require.Greater(t, len(emojiImage), 0, "no image returned")

	_, imageType, err = image.DecodeConfig(bytes.NewReader(emojiImage))
	require.NoError(t, err, "unable to identify received image")
	require.Equal(t, imageType, "png", "expected png")

	_, err = client.DeleteEmoji(context.Background(), emoji4.Id)
	require.NoError(t, err)

	_, resp, err = client.GetEmojiImage(context.Background(), emoji4.Id)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetEmojiImage(context.Background(), model.NewId())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = client.GetEmojiImage(context.Background(), "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)
}

func TestSearchEmoji(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	searchTerm1 := model.NewId()
	searchTerm2 := model.NewId()

	emojis := []*model.Emoji{
		{
			CreatorId: th.BasicUser.Id,
			Name:      searchTerm1,
		},
		{
			CreatorId: th.BasicUser.Id,
			Name:      "blargh_" + searchTerm2,
		},
	}

	for idx, emoji := range emojis {
		newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
		require.NoError(t, err)
		emojis[idx] = newEmoji
	}

	search := &model.EmojiSearch{Term: searchTerm1}
	remojis, resp, err := client.SearchEmoji(context.Background(), search)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	found := false
	for _, e := range remojis {
		if e.Name == emojis[0].Name {
			found = true
		}
	}

	assert.True(t, found)

	search.Term = searchTerm2
	search.PrefixOnly = true
	remojis, resp, err = client.SearchEmoji(context.Background(), search)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	found = false
	for _, e := range remojis {
		if e.Name == emojis[1].Name {
			found = true
		}
	}

	assert.False(t, found)

	search.PrefixOnly = false
	remojis, resp, err = client.SearchEmoji(context.Background(), search)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	found = false
	for _, e := range remojis {
		if e.Name == emojis[1].Name {
			found = true
		}
	}

	assert.True(t, found)

	search.Term = ""
	_, resp, err = client.SearchEmoji(context.Background(), search)
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.SearchEmoji(context.Background(), search)
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}

func TestAutocompleteEmoji(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableCustomEmoji = true })

	searchTerm1 := model.NewId()

	emojis := []*model.Emoji{
		{
			CreatorId: th.BasicUser.Id,
			Name:      searchTerm1,
		},
		{
			CreatorId: th.BasicUser.Id,
			Name:      "blargh_" + searchTerm1,
		},
	}

	for idx, emoji := range emojis {
		newEmoji, _, err := client.CreateEmoji(context.Background(), emoji, utils.CreateTestGif(t, 10, 10), "image.gif")
		require.NoError(t, err)
		emojis[idx] = newEmoji
	}

	remojis, resp, err := client.AutocompleteEmoji(context.Background(), searchTerm1, "")
	require.NoErrorf(t, err, "AutocompleteEmoji failed with search term: %s", searchTerm1)
	CheckOKStatus(t, resp)

	found1 := false
	found2 := false
	for _, e := range remojis {
		if e.Name == emojis[0].Name {
			found1 = true
		}

		if e.Name == emojis[1].Name {
			found2 = true
		}
	}

	assert.True(t, found1)
	assert.False(t, found2)

	_, resp, err = client.AutocompleteEmoji(context.Background(), "", "")
	require.Error(t, err)
	CheckBadRequestStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.AutocompleteEmoji(context.Background(), searchTerm1, "")
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)
}
