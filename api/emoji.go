// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bytes"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	MaxEmojiFileSize = 64 * 1024 // 64 KB
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

	if result := <-Srv.Store.Emoji().GetAll(); result.Err != nil {
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

	if result := <-Srv.Store.Emoji().GetByName(emoji.Name); result.Err == nil && result.Data != nil {
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

	if result := <-Srv.Store.Emoji().Save(emoji); result.Err != nil {
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
		return model.NewLocAppError("uploadEmojiImage", "api.emoji.upload.large_image.app_error", nil, "")
	}

	if err := WriteFile(buf.Bytes(), getEmojiImagePath(id)); err != nil {
		return err
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

	if result := <-Srv.Store.Emoji().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		if c.Session.UserId != result.Data.(*model.Emoji).CreatorId && !c.IsSystemAdmin() {
			c.Err = model.NewLocAppError("deleteEmoji", "api.emoji.delete.permissions.app_error", nil, "user_id="+c.Session.UserId)
			c.Err.StatusCode = http.StatusUnauthorized
			return
		}
	}

	if err := (<-Srv.Store.Emoji().Delete(id, model.GetMillis())).Err; err != nil {
		c.Err = err
		return
	}

	go deleteEmojiImage(id)

	ReturnStatusOK(w)
}

func deleteEmojiImage(id string) {
	if err := MoveFile(getEmojiImagePath(id), "emoji/"+id+"/image_deleted"); err != nil {
		l4g.Error("Failed to rename image when deleting emoji %v", id)
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

	if result := <-Srv.Store.Emoji().Get(id); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		var img []byte

		if data, err := ReadFile(getEmojiImagePath(id)); err != nil {
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
