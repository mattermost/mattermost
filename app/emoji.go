// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"image"
	"image/draw"
	"image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"path"

	"image/color/palette"

	"github.com/disintegration/imaging"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	MaxEmojiFileSize       = 1 << 20 // 1 MB
	MaxEmojiWidth          = 128
	MaxEmojiHeight         = 128
	MaxEmojiOriginalWidth  = 1028
	MaxEmojiOriginalHeight = 1028
)

func (a *App) CreateEmoji(sessionUserId string, emoji *model.Emoji, multiPartImageData *multipart.Form) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("UploadEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetEmoji", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	// wipe the emoji id so that existing emojis can't get overwritten
	emoji.Id = ""

	// do our best to validate the emoji before committing anything to the DB so that we don't have to clean up
	// orphaned files left over when validation fails later on
	emoji.PreSave()
	if err := emoji.IsValid(); err != nil {
		return nil, err
	}

	if emoji.CreatorId != sessionUserId {
		return nil, model.NewAppError("createEmoji", "api.emoji.create.other_user.app_error", nil, "", http.StatusForbidden)
	}

	if existingEmoji, err := a.Srv.Store.Emoji().GetByName(emoji.Name, true); err == nil && existingEmoji != nil {
		return nil, model.NewAppError("createEmoji", "api.emoji.create.duplicate.app_error", nil, "", http.StatusBadRequest)
	}

	imageData := multiPartImageData.File["image"]
	if len(imageData) == 0 {
		err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]interface{}{"Name": "createEmoji"}, "", http.StatusBadRequest)
		return nil, err
	}

	if err := a.UploadEmojiImage(emoji.Id, imageData[0]); err != nil {
		return nil, err
	}

	emoji, err := a.Srv.Store.Emoji().Save(emoji)
	if err != nil {
		return nil, err
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_EMOJI_ADDED, "", "", "", nil)
	message.Add("emoji", emoji.ToJson())
	a.Publish(message)
	return emoji, nil
}

func (a *App) GetEmojiList(page, perPage int, sort string) ([]*model.Emoji, *model.AppError) {
	return a.Srv.Store.Emoji().GetList(page*perPage, perPage, sort)
}

func (a *App) UploadEmojiImage(id string, imageData *multipart.FileHeader) *model.AppError {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return model.NewAppError("UploadEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return model.NewAppError("UploadEmojiImage", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	file, err := imageData.Open()
	if err != nil {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.open.app_error", nil, "", http.StatusBadRequest)
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	// make sure the file is an image and is within the required dimensions
	config, _, err := image.DecodeConfig(bytes.NewReader(buf.Bytes()))
	if err != nil {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.image.app_error", nil, "", http.StatusBadRequest)
	}

	if config.Width > MaxEmojiOriginalWidth || config.Height > MaxEmojiOriginalHeight {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.too_large.app_error", map[string]interface{}{
			"MaxWidth":  MaxEmojiOriginalWidth,
			"MaxHeight": MaxEmojiOriginalHeight,
		}, "", http.StatusBadRequest)
	}

	if config.Width > MaxEmojiWidth || config.Height > MaxEmojiHeight {
		data := buf.Bytes()
		newbuf := bytes.NewBuffer(nil)
		info, err := model.GetInfoForBytes(imageData.Filename, data)
		if err != nil {
			return err
		}

		if info.MimeType == "image/gif" {
			gif_data, err := gif.DecodeAll(bytes.NewReader(data))
			if err != nil {
				return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_decode_error", nil, "", http.StatusBadRequest)
			}

			resized_gif := resizeEmojiGif(gif_data)
			if err := gif.EncodeAll(newbuf, resized_gif); err != nil {
				return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_encode_error", nil, "", http.StatusBadRequest)
			}

			if _, err := a.WriteFile(newbuf, getEmojiImagePath(id)); err != nil {
				return err
			}
		} else {
			img, _, err := image.Decode(bytes.NewReader(data))
			if err != nil {
				return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.decode_error", nil, "", http.StatusBadRequest)
			}

			resized_image := resizeEmoji(img, config.Width, config.Height)
			if err := png.Encode(newbuf, resized_image); err != nil {
				return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.encode_error", nil, "", http.StatusBadRequest)
			}
			if _, err := a.WriteFile(newbuf, getEmojiImagePath(id)); err != nil {
				return err
			}
		}
	}

	_, appErr := a.WriteFile(buf, getEmojiImagePath(id))
	return appErr
}

func (a *App) DeleteEmoji(emoji *model.Emoji) *model.AppError {
	if err := a.Srv.Store.Emoji().Delete(emoji, model.GetMillis()); err != nil {
		return err
	}

	a.deleteEmojiImage(emoji.Id)
	a.deleteReactionsForEmoji(emoji.Name)
	return nil
}

func (a *App) GetEmoji(emojiId string) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetEmoji", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	return a.Srv.Store.Emoji().Get(emojiId, false)
}

func (a *App) GetEmojiByName(emojiName string) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if len(*a.Config().FileSettings.DriverName) == 0 {
		return nil, model.NewAppError("GetEmoji", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
	}

	return a.Srv.Store.Emoji().GetByName(emojiName, true)
}

func (a *App) GetMultipleEmojiByName(names []string) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetMultipleEmojiByName", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	return a.Srv.Store.Emoji().GetMultipleByName(names)
}

func (a *App) GetEmojiImage(emojiId string) ([]byte, string, *model.AppError) {
	_, storeErr := a.Srv.Store.Emoji().Get(emojiId, true)
	if storeErr != nil {
		return nil, "", storeErr
	}

	img, appErr := a.ReadFile(getEmojiImagePath(emojiId))
	if appErr != nil {
		return nil, "", model.NewAppError("getEmojiImage", "api.emoji.get_image.read.app_error", nil, appErr.Error(), http.StatusNotFound)
	}

	_, imageType, err := image.DecodeConfig(bytes.NewReader(img))
	if err != nil {
		return nil, "", model.NewAppError("getEmojiImage", "api.emoji.get_image.decode.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return img, imageType, nil
}

func (a *App) SearchEmoji(name string, prefixOnly bool, limit int) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("SearchEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	return a.Srv.Store.Emoji().Search(name, prefixOnly, limit)
}

// GetEmojiStaticUrl returns a relative static URL for system default emojis,
// and the API route for custom ones. Errors if not found or if custom and deleted.
func (a *App) GetEmojiStaticUrl(emojiName string) (string, *model.AppError) {
	subPath, _ := utils.GetSubpathFromConfig(a.Config())

	if id, found := model.GetSystemEmojiId(emojiName); found {
		return path.Join(subPath, "/static/emoji", id+".png"), nil
	}

	if emoji, err := a.Srv.Store.Emoji().GetByName(emojiName, true); err == nil {
		return path.Join(subPath, "/api/v4/emoji", emoji.Id, "image"), nil
	} else {
		return "", err
	}
}

func resizeEmojiGif(gifImg *gif.GIF) *gif.GIF {
	// Create a new RGBA image to hold the incremental frames.
	firstFrame := gifImg.Image[0].Bounds()
	b := image.Rect(0, 0, firstFrame.Dx(), firstFrame.Dy())
	img := image.NewRGBA(b)

	resizedImage := image.Image(nil)
	// Resize each frame.
	for index, frame := range gifImg.Image {
		bounds := frame.Bounds()
		draw.Draw(img, bounds, frame, bounds.Min, draw.Over)
		resizedImage = resizeEmoji(img, firstFrame.Dx(), firstFrame.Dy())
		gifImg.Image[index] = imageToPaletted(resizedImage)
	}
	// Set new gif width and height
	gifImg.Config.Width = resizedImage.Bounds().Dx()
	gifImg.Config.Height = resizedImage.Bounds().Dy()
	return gifImg
}

func getEmojiImagePath(id string) string {
	return "emoji/" + id + "/image"
}

func resizeEmoji(img image.Image, width int, height int) image.Image {
	emojiWidth := float64(width)
	emojiHeight := float64(height)

	if emojiHeight <= MaxEmojiHeight && emojiWidth <= MaxEmojiWidth {
		return img
	}
	return imaging.Fit(img, MaxEmojiWidth, MaxEmojiHeight, imaging.Lanczos)
}

func imageToPaletted(img image.Image) *image.Paletted {
	b := img.Bounds()
	pm := image.NewPaletted(b, palette.Plan9)
	draw.FloydSteinberg.Draw(pm, b, img, image.ZP)
	return pm
}

func (a *App) deleteEmojiImage(id string) {
	if err := a.MoveFile(getEmojiImagePath(id), "emoji/"+id+"/image_deleted"); err != nil {
		mlog.Error("Failed to rename image when deleting emoji", mlog.String("emoji_id", id))
	}
}

func (a *App) deleteReactionsForEmoji(emojiName string) {
	if err := a.Srv.Store.Reaction().DeleteAllWithEmojiName(emojiName); err != nil {
		mlog.Warn("Unable to delete reactions when deleting emoji", mlog.String("emoji_name", emojiName), mlog.Err(err))
	}
}
