// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitEmoji() {
	l4g.Debug(utils.T("api.emoji.init.debug"))

	BaseRoutes.Emojis.Handle("", ApiSessionRequired(createEmoji)).Methods("POST")
	BaseRoutes.Emojis.Handle("", ApiSessionRequired(getEmojiList)).Methods("GET")
	BaseRoutes.Emoji.Handle("", ApiSessionRequired(deleteEmoji)).Methods("DELETE")
	BaseRoutes.Emoji.Handle("", ApiSessionRequired(getEmoji)).Methods("GET")
	BaseRoutes.Emoji.Handle("/image", ApiSessionRequiredTrustRequester(getEmojiImage)).Methods("GET")
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("createEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if emojiInterface := einterfaces.GetEmojiInterface(); emojiInterface != nil &&
		!emojiInterface.CanUserCreateEmoji(c.Session.Roles, c.Session.TeamMembers) {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
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

	if len(props["emoji"]) == 0 {
		c.SetInvalidParam("emoji")
		return
	}

	emoji := model.EmojiFromJson(strings.NewReader(props["emoji"][0]))
	if emoji == nil {
		c.SetInvalidParam("emoji")
		return
	}

	newEmoji, err := app.CreateEmoji(c.Session.UserId, emoji, m)
	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(newEmoji.ToJson()))
	}
}

func getEmojiList(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	listEmoji, err := app.GetEmojiList(c.Params.Page, c.Params.PerPage)
	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.EmojiListToJson(listEmoji)))
	}
}

func deleteEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmojiId()
	if c.Err != nil {
		return
	}

	emoji, err := app.GetEmoji(c.Params.EmojiId)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != emoji.CreatorId && !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewAppError("deleteImage", "api.emoji.delete.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
		return
	}

	err = app.DeleteEmoji(emoji)
	if err != nil {
		c.Err = err
		return
	} else {
		ReturnStatusOK(w)
	}
}

func getEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmojiId()
	if c.Err != nil {
		return
	}

	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	emoji, err := app.GetEmoji(c.Params.EmojiId)
	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(emoji.ToJson()))
	}
}

func getEmojiImage(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmojiId()
	if c.Err != nil {
		return
	}

	if !*utils.Cfg.ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if len(utils.Cfg.FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	image, imageType, err := app.GetEmojiImage(c.Params.EmojiId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "image/"+imageType)
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Write(image)
}
