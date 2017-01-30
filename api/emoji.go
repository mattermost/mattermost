// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

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
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/disintegration/imaging"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"image/color/palette"
)

const (
	MaxEmojiFileSize = 1000 * 1024 // 1 MB
	MaxEmojiWidth    = 128
	MaxEmojiHeight   = 128
)

func InitEmoji() {
	l4g.Debug(utils.T("api.emoji.init.debug"))

	BaseRoutes.Emoji.Handle("/list", ApiUserRequired(getEmoji)).Methods("GET")
	BaseRoutes.Emoji.Handle("/create", ApiUserRequired(createEmoji)).Methods("POST")
	BaseRoutes.Emoji.Handle("/delete", ApiUserRequired(deleteEmoji)).Methods("POST")
	BaseRoutes.Emoji.Handle("/{id:[A-Za-z0-9_]+}", ApiUserRequiredTrustRequester(getEmojiImage)).Methods("GET")
}

func getEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewLocAppError("getEmoji", "api.emoji.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if result := <-app.Srv.Store.Emoji().GetAll(); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		emoji := result.Data.([]*model.Emoji)
		w.Write([]byte(model.EmojiListToJson(emoji)))
	}
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if emojiInterface := einterfaces.GetEmojiInterface(); emojiInterface != nil &&
		!emojiInterface.CanUserCreateEmoji(c.Session.Roles, c.Session.TeamMembers) {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.permissions.app_error", nil, "user_id="+c.Session.UserId)
		c.Err.StatusCode = http.StatusUnauthorized
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if r.ContentLength > MaxEmojiFileSize {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	if err := r.ParseMultipartForm(MaxEmojiFileSize); err != nil {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.parse.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
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
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.other_user.app_error", nil, "")
		c.Err.StatusCode = http.StatusUnauthorized
		return
	}

	if result := <-app.Srv.Store.Emoji().GetByName(emoji.Name); result.Err == nil && result.Data != nil {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.duplicate.app_error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if imageData := m.File["image"]; len(imageData) == 0 {
		c.SetInvalidParam("createEmoji", "image")
		return
	} else if err := uploadEmojiImage(emoji.Id, imageData[0]); err != nil {
		c.Err = err
		return
	}

	if result := <-app.Srv.Store.Emoji().Save(emoji); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		w.Write([]byte(result.Data.(*model.Emoji).ToJson()))
	}
}

func uploadEmojiImage(id string, imageData *multipart.FileHeader) *model.AppError {
	file, err := imageData.Open()
	if err != nil {
		return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.open.app_error", nil, "")
	}
	defer file.Close()

	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)

	// make sure the file is an image and is within the required dimensions
	if config, _, err := image.DecodeConfig(bytes.NewReader(buf.Bytes())); err != nil {
		return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.image.app_error", nil, err.Error())
	} else if config.Width > MaxEmojiWidth || config.Height > MaxEmojiHeight {
		data := buf.Bytes()
		newbuf := bytes.NewBuffer(nil)
		if info, err := model.GetInfoForBytes(imageData.Filename, data); err != nil {
			return err
		} else if info.MimeType == "image/gif" {
			if gif_data, err := gif.DecodeAll(bytes.NewReader(data)); err != nil {
				return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_decode_error", nil, "")
			} else {
				resized_gif := resizeEmojiGif(gif_data)
				if err := gif.EncodeAll(newbuf, resized_gif); err != nil {
					return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.large_image.gif_encode_error", nil, "")
				}
				if err := app.WriteFile(newbuf.Bytes(), getEmojiImagePath(id)); err != nil {
					return err
				}
			}
		} else {
			if img, _, err := image.Decode(bytes.NewReader(data)); err != nil {
				return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.large_image.decode_error", nil, "")
			} else {
				resized_image := resizeEmoji(img, config.Width, config.Height)
				if err := png.Encode(newbuf, resized_image); err != nil {
					return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.large_image.encode_error", nil, "")
				}
				if err := app.WriteFile(newbuf.Bytes(), getEmojiImagePath(id)); err != nil {
					return err
				}
			}
		}
	} else {
		if err := app.WriteFile(buf.Bytes(), getEmojiImagePath(id)); err != nil {
			return err
		}
	}

	return nil
}

func deleteEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewLocAppError("deleteEmoji", "api.emoji.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("deleteImage", "api.emoji.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	props := model.MapFromJson(r.Body)

	id := props["id"]
	if len(id) == 0 {
		c.SetInvalidParam("deleteEmoji", "id")
		return
	}

	var emoji *model.Emoji
	if result := <-app.Srv.Store.Emoji().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		emoji = result.Data.(*model.Emoji)

		if c.Session.UserId != emoji.CreatorId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			c.Err = model.NewLocAppError("deleteEmoji", "api.emoji.delete.permissions.app_error", nil, "user_id="+c.Session.UserId)
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}

	if err := (<-app.Srv.Store.Emoji().Delete(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	go deleteEmojiImage(id)
	go deleteReactionsForEmoji(emoji.Name)

	ReturnStatusOK(w)
}

func deleteEmojiImage(id string) {
	if err := app.MoveFile(getEmojiImagePath(id), "emoji/"+id+"/image_deleted"); err != nil {
		l4g.Error("Failed to rename image when deleting emoji %v", id)
	}
}

func deleteReactionsForEmoji(emojiName string) {
	if result := <-app.Srv.Store.Reaction().DeleteAllWithEmojiName(emojiName); result.Err != nil {
		l4g.Warn(utils.T("api.emoji.delete.delete_reactions.app_error"), emojiName)
		l4g.Warn(result.Err)
	}
}

func getEmojiImage(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewLocAppError("getEmojiImage", "api.emoji.disabled.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewLocAppError("getEmojiImage", "api.emoji.storage.app_error", nil, "")
		c.Err.StatusCode = http.StatusNotImplemented
		return
	}

	params := mux.Vars(r)

	id := params["id"]
	if len(id) == 0 {
		c.SetInvalidParam("getEmojiImage", "id")
		return
	}

	if result := <-app.Srv.Store.Emoji().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		var img []byte

		if data, err := app.ReadFile(getEmojiImagePath(id)); err != nil {
			c.Err = model.NewLocAppError("getEmojiImage", "api.emoji.get_image.read.app_error", nil, err.Error())
			return
		} else {
			img = data
		}

		if _, imageType, err := image.DecodeConfig(bytes.NewReader(img)); err != nil {
			model.NewLocAppError("getEmojiImage", "api.emoji.get_image.decode.app_error", nil, err.Error())
		} else {
			w.Header().Set("Content-Type", "image/"+imageType)
		}

		w.Write(img)
	}
}

func getEmojiImagePath(id string) string {
	return "emoji/" + id + "/image"
}

func resizeEmoji(img image.Image, width int, height int) image.Image {
	emojiWidth := float64(width)
	emojiHeight := float64(height)

	var emoji image.Image
	if emojiHeight <= MaxEmojiHeight && emojiWidth <= MaxEmojiWidth {
		emoji = img
	} else {
		emoji = imaging.Fit(img, MaxEmojiWidth, MaxEmojiHeight, imaging.Lanczos)
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
