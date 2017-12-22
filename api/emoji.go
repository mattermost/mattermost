// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"image"
	"image/draw"
	"image/gif"
	"net/http"
	"strings"

	"image/color/palette"

	"github.com/disintegration/imaging"
	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitEmoji() {
	api.BaseRoutes.Emoji.Handle("/list", api.ApiUserRequired(getEmoji)).Methods("GET")
	api.BaseRoutes.Emoji.Handle("/create", api.ApiUserRequired(createEmoji)).Methods("POST")
	api.BaseRoutes.Emoji.Handle("/delete", api.ApiUserRequired(deleteEmoji)).Methods("POST")
	api.BaseRoutes.Emoji.Handle("/{id:[A-Za-z0-9_]+}", api.ApiUserRequiredTrustRequester(getEmojiImage)).Methods("GET")
}

func getEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	listEmoji, err := c.App.GetEmojiList(0, 100000)
	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.EmojiListToJson(listEmoji)))
	}
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("createEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if emojiInterface := c.App.Emoji; emojiInterface != nil &&
		!emojiInterface.CanUserCreateEmoji(c.Session.Roles, c.Session.TeamMembers) {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("createEmoji", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if r.ContentLength > app.MaxEmojiFileSize {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.too_large.app_error", nil, "", http.StatusRequestEntityTooLarge)
		return
	}

	if err := r.ParseMultipartForm(app.MaxEmojiFileSize); err != nil {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.parse.app_error", nil, err.Error(), http.StatusBadRequest)
		return
	}

	m := r.MultipartForm
	props := m.Value

	emoji := model.EmojiFromJson(strings.NewReader(props["emoji"][0]))
	if emoji == nil {
		c.SetInvalidParam("createEmoji", "emoji")
		return
	}

	// wipe the emoji id so that existing emojis can't get overwritten
	emoji.Id = ""

	// do our best to validate the emoji before committing anything to the DB so that we don't have to clean up
	// orphaned files left over when validation fails later on
	emoji.PreSave()
	if err := emoji.IsValid(); err != nil {
		c.Err = err
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if emoji.CreatorId != c.Session.UserId {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.other_user.app_error", nil, "", http.StatusUnauthorized)
		return
	}

	if result := <-c.App.Srv.Store.Emoji().GetByName(emoji.Name); result.Err == nil && result.Data != nil {
		c.Err = model.NewAppError("createEmoji", "api.emoji.create.duplicate.app_error", nil, "", http.StatusBadRequest)
		return
	}

	if imageData := m.File["image"]; len(imageData) == 0 {
		c.SetInvalidParam("createEmoji", "image")
		return
	} else if err := c.App.UploadEmojiImage(emoji.Id, imageData[0]); err != nil {
		c.Err = err
		return
	}

	if result := <-c.App.Srv.Store.Emoji().Save(emoji); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_EMOJI_ADDED, "", "", "", nil)
		message.Add("emoji", result.Data.(*model.Emoji).ToJson())

		c.App.Publish(message)
		w.Write([]byte(result.Data.(*model.Emoji).ToJson()))
	}
}

func deleteEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("deleteEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("deleteImage", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteEmoji", "id")
		return
	}

	emoji, err := c.App.GetEmoji(id)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != emoji.CreatorId && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewAppError("deleteEmoji", "api.emoji.delete.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
		return
	}

	err = c.App.DeleteEmoji(emoji)
	if err != nil {
		c.Err = err
		return
	} else {
		ReturnStatusOK(w)
	}
}

func getEmojiImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	params := mux.Vars(r)

	id := params["id"]
	if len(id) == 0 {
		c.SetInvalidParam("getEmojiImage", "id")
		return
	}

	image, imageType, err := c.App.GetEmojiImage(id)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "image/"+imageType)
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Write(image)
}

func resizeEmoji(img image.Image, width int, height int) image.Image {
	emojiWidth := float64(width)
	emojiHeight := float64(height)

	var emoji image.Image
	if emojiHeight <= app.MaxEmojiHeight && emojiWidth <= app.MaxEmojiWidth {
		emoji = img
	} else {
		emoji = imaging.Fit(img, app.MaxEmojiWidth, app.MaxEmojiHeight, imaging.Lanczos)
	}
	return emoji
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

func imageToPaletted(img image.Image) *image.Paletted {
	b := img.Bounds()
	pm := image.NewPaletted(b, palette.Plan9)
	draw.FloydSteinberg.Draw(pm, b, img, image.ZP)
	return pm
}
