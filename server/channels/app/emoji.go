// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color/palette"
	"image/draw"
	"image/gif"
	_ "image/jpeg"
	"io"
	"mime/multipart"
	"net/http"
	"path"

	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	_ "golang.org/x/image/webp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const (
	MaxEmojiFileSize       = 1 << 19 // 512 KiB
	MaxEmojiWidth          = 128
	MaxEmojiHeight         = 128
	MaxEmojiOriginalWidth  = 1028
	MaxEmojiOriginalHeight = 1028
)

func (a *App) CreateEmoji(c request.CTX, sessionUserId string, emoji *model.Emoji, multiPartImageData *multipart.Form) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("CreateEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusForbidden)
	}

	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("CreateEmoji", "api.emoji.storage.app_error", nil, "", http.StatusForbidden)
	}

	// wipe the emoji id so that existing emojis can't get overwritten
	emoji.Id = ""

	// do our best to validate the emoji before committing anything to the DB so that we don't have to clean up
	// orphaned files left over when validation fails later on
	emoji.PreSave()
	if appErr := emoji.IsValid(); appErr != nil {
		return nil, appErr
	}

	if emoji.CreatorId != sessionUserId {
		return nil, model.NewAppError("CreateEmoji", "api.emoji.create.other_user.app_error", nil, "", http.StatusForbidden)
	}

	if existingEmoji, err := a.Srv().Store().Emoji().GetByName(c, emoji.Name, true); err == nil && existingEmoji != nil {
		return nil, model.NewAppError("CreateEmoji", "api.emoji.create.duplicate.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	imageData := multiPartImageData.File["image"]
	if len(imageData) == 0 {
		return nil, model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]any{"Name": "createEmoji"}, "", http.StatusBadRequest)
	}

	filename := imageData[0].Filename
	file, err := imageData[0].Open()
	if err != nil {
		return nil, model.NewAppError("CreateEmoji", "api.emoji.upload.open.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	defer file.Close()

	if appErr := a.uploadEmojiImage(c, emoji.Id, filename, file); appErr != nil {
		return nil, appErr
	}

	emoji, err = a.Srv().Store().Emoji().Save(emoji)
	if err != nil {
		return nil, model.NewAppError("CreateEmoji", "app.emoji.create.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	message := model.NewWebSocketEvent(model.WebsocketEventEmojiAdded, "", "", "", nil, "")
	emojiJSON, jsonErr := json.Marshal(emoji)
	if jsonErr != nil {
		return nil, model.NewAppError("CreateEmoji", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
	}
	message.Add("emoji", string(emojiJSON))
	a.Publish(message)
	return emoji, nil
}

func (a *App) GetEmojiList(c request.CTX, page, perPage int, sort string) ([]*model.Emoji, *model.AppError) {
	list, err := a.Srv().Store().Emoji().GetList(page*perPage, perPage, sort)
	if err != nil {
		return nil, model.NewAppError("GetEmojiList", "app.emoji.get_list.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return list, nil
}

func (a *App) uploadEmojiImage(c request.CTX, id string, filename string, file io.ReadSeeker) *model.AppError {
	// make sure the file is an image and is within the required dimensions
	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.image.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if config.Width > MaxEmojiOriginalWidth || config.Height > MaxEmojiOriginalHeight {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.too_large.app_error", map[string]any{
			"MaxWidth":  MaxEmojiOriginalWidth,
			"MaxHeight": MaxEmojiOriginalHeight,
		}, "", http.StatusBadRequest)
	}

	_, err = file.Seek(0, io.SeekStart)
	if err != nil {
		return model.NewAppError("uploadEmojiImage", "api.emoji.upload.seek.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if config.Width <= MaxEmojiWidth && config.Height <= MaxEmojiHeight {
		// No need to resize the image
		_, appErr := a.WriteFile(file, getEmojiImagePath(id))
		return appErr
	}

	// Create a buffer for the resized image
	buf := &bytes.Buffer{}

	info := model.NewInfo(filename)
	if info.MimeType == "image/gif" {
		g, err := gif.DecodeAll(file)
		if err != nil {
			return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_decode_error", nil, "", http.StatusBadRequest).Wrap(err)
		}

		resizeEmojiGif(g)
		if err := gif.EncodeAll(buf, g); err != nil {
			return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_encode_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	} else {
		img, _, err := image.Decode(file)
		if err != nil {
			return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.decode_error", nil, "", http.StatusBadRequest).Wrap(err)
		}

		resizedImg := resizeEmoji(img, config.Width, config.Height)
		if err := a.ch.imgEncoder.EncodePNG(buf, resizedImg); err != nil {
			return model.NewAppError("uploadEmojiImage", "api.emoji.upload.large_image.encode_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	_, appErr := a.WriteFile(buf, getEmojiImagePath(id))
	return appErr
}

func (a *App) DeleteEmoji(c request.CTX, emoji *model.Emoji) *model.AppError {
	if err := a.Srv().Store().Emoji().Delete(emoji, model.GetMillis()); err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return model.NewAppError("DeleteEmoji", "app.emoji.delete.no_results", nil, "id="+emoji.Id, http.StatusNotFound).Wrap(err)
		default:
			return model.NewAppError("DeleteEmoji", "app.emoji.delete.app_error", nil, "id="+emoji.Id, http.StatusInternalServerError).Wrap(err)
		}
	}

	a.deleteEmojiImage(c, emoji.Id)
	a.deleteReactionsForEmoji(c, emoji.Name)
	return nil
}

func (a *App) GetEmoji(c request.CTX, emojiId string) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusForbidden)
	}

	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("GetEmoji", "api.emoji.storage.app_error", nil, "", http.StatusForbidden)
	}

	emoji, err := a.Srv().Store().Emoji().Get(c, emojiId, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return emoji, model.NewAppError("GetEmoji", "app.emoji.get.no_result", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return emoji, model.NewAppError("GetEmoji", "app.emoji.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return emoji, nil
}

func (a *App) GetEmojiByName(c request.CTX, emojiName string) (*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetEmojiByName", "api.emoji.disabled.app_error", nil, "", http.StatusForbidden)
	}

	if *a.Config().FileSettings.DriverName == "" {
		return nil, model.NewAppError("GetEmojiByName", "api.emoji.storage.app_error", nil, "", http.StatusForbidden)
	}

	emoji, err := a.Srv().Store().Emoji().GetByName(c, emojiName, true)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return emoji, model.NewAppError("GetEmojiByName", "app.emoji.get_by_name.no_result", nil, "", http.StatusNotFound).Wrap(err)
		default:
			return emoji, model.NewAppError("GetEmojiByName", "app.emoji.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return emoji, nil
}

func (a *App) GetMultipleEmojiByName(c request.CTX, names []string) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("GetMultipleEmojiByName", "api.emoji.disabled.app_error", nil, "", http.StatusForbidden)
	}

	// Filtering out system emojis
	i := 0
	for _, n := range names {
		if _, ok := model.GetSystemEmojiId(n); !ok {
			names[i] = n
			i++
		}
	}
	names = names[:i]

	if len(names) == 0 {
		return []*model.Emoji{}, nil
	}

	emoji, err := a.Srv().Store().Emoji().GetMultipleByName(c, names)
	if err != nil {
		return nil, model.NewAppError("GetMultipleEmojiByName", "app.emoji.get_by_name.app_error", nil, fmt.Sprintf("names=%v", names), http.StatusInternalServerError).Wrap(err)
	}

	return emoji, nil
}

func (a *App) GetEmojiImage(c request.CTX, emojiId string) ([]byte, string, *model.AppError) {
	_, storeErr := a.Srv().Store().Emoji().Get(c, emojiId, true)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(storeErr, &nfErr):
			return nil, "", model.NewAppError("GetEmojiImage", "app.emoji.get.no_result", nil, "", http.StatusNotFound).Wrap(storeErr)
		default:
			return nil, "", model.NewAppError("GetEmojiImage", "app.emoji.get.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	img, appErr := a.ReadFile(getEmojiImagePath(emojiId))
	if appErr != nil {
		return nil, "", model.NewAppError("getEmojiImage", "api.emoji.get_image.read.app_error", nil, "", http.StatusNotFound).Wrap(appErr)
	}

	_, imageType, err := image.DecodeConfig(bytes.NewReader(img))
	if err != nil {
		return nil, "", model.NewAppError("getEmojiImage", "api.emoji.get_image.decode.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return img, imageType, nil
}

func (a *App) SearchEmoji(c request.CTX, name string, prefixOnly bool, limit int) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		return nil, model.NewAppError("SearchEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusForbidden)
	}

	list, err := a.Srv().Store().Emoji().Search(name, prefixOnly, limit)
	if err != nil {
		return nil, model.NewAppError("SearchEmoji", "app.emoji.get_by_name.app_error", nil, "name="+name, http.StatusInternalServerError).Wrap(err)
	}

	return list, nil
}

// GetEmojiStaticURL returns a relative static URL for system default emojis,
// and the API route for custom ones. Errors if not found or if custom and deleted.
func (a *App) GetEmojiStaticURL(c request.CTX, emojiName string) (string, *model.AppError) {
	subPath, _ := utils.GetSubpathFromConfig(a.Config())

	if id, found := model.GetSystemEmojiId(emojiName); found {
		return path.Join(subPath, "/static/emoji", id+".png"), nil
	}

	emoji, err := a.Srv().Store().Emoji().GetByName(c, emojiName, true)
	if err == nil {
		return path.Join(subPath, "/api/v4/emoji", emoji.Id, "image"), nil
	}
	var nfErr *store.ErrNotFound
	switch {
	case errors.As(err, &nfErr):
		return "", model.NewAppError("GetEmojiStaticURL", "app.emoji.get_by_name.no_result", nil, "", http.StatusNotFound).Wrap(err)
	default:
		return "", model.NewAppError("GetEmojiStaticURL", "app.emoji.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
}

func resizeEmojiGif(gifImg *gif.GIF) {
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
	return imaging.Fit(img, MaxEmojiWidth, MaxEmojiHeight)
}

func imageToPaletted(img image.Image) *image.Paletted {
	b := img.Bounds()
	pm := image.NewPaletted(b, palette.Plan9)
	draw.FloydSteinberg.Draw(pm, b, img, image.Point{})
	return pm
}

func (a *App) deleteEmojiImage(rctx request.CTX, id string) {
	if err := a.MoveFile(getEmojiImagePath(id), "emoji/"+id+"/image_deleted"); err != nil {
		rctx.Logger().Warn("Failed to rename image when deleting emoji", mlog.String("emoji_id", id))
	}
}

func (a *App) deleteReactionsForEmoji(rctx request.CTX, emojiName string) {
	if err := a.Srv().Store().Reaction().DeleteAllWithEmojiName(emojiName); err != nil {
		rctx.Logger().Warn("Unable to delete reactions when deleting emoji", mlog.String("emoji_name", emojiName), mlog.Err(err))
	}
}

func (a *App) confirmEmojiExists(c request.CTX, emojiName string) *model.AppError {
	if model.IsSystemEmojiName(emojiName) {
		return nil
	}

	err := model.IsValidEmojiName(emojiName)
	if err != nil {
		return err
	}

	_, err = a.GetEmojiByName(c, emojiName)
	return err
}
