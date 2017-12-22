// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitEmoji() {
	api.BaseRoutes.Emojis.Handle("", api.ApiSessionRequired(createEmoji)).Methods("POST")
	api.BaseRoutes.Emojis.Handle("", api.ApiSessionRequired(getEmojiList)).Methods("GET")
	api.BaseRoutes.Emoji.Handle("", api.ApiSessionRequired(deleteEmoji)).Methods("DELETE")
	api.BaseRoutes.Emoji.Handle("", api.ApiSessionRequired(getEmoji)).Methods("GET")
	api.BaseRoutes.Emoji.Handle("/image", api.ApiSessionRequiredTrustRequester(getEmojiImage)).Methods("GET")
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("createEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if emojiInterface := c.App.Emoji; emojiInterface != nil &&
		!emojiInterface.CanUserCreateEmoji(c.Session.Roles, c.Session.TeamMembers) {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
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

	if len(props["emoji"]) == 0 {
		c.SetInvalidParam("emoji")
		return
	}

	emoji := model.EmojiFromJson(strings.NewReader(props["emoji"][0]))
	if emoji == nil {
		c.SetInvalidParam("emoji")
		return
	}

	newEmoji, err := c.App.CreateEmoji(c.Session.UserId, emoji, m)
	if err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(newEmoji.ToJson()))
	}
}

func getEmojiList(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	listEmoji, err := c.App.GetEmojiList(c.Params.Page, c.Params.PerPage)
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

	emoji, err := c.App.GetEmoji(c.Params.EmojiId)
	if err != nil {
		c.Err = err
		return
	}

	if c.Session.UserId != emoji.CreatorId && !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
		c.Err = model.NewAppError("deleteImage", "api.emoji.delete.permissions.app_error", nil, "user_id="+c.Session.UserId, http.StatusUnauthorized)
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

func getEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmojiId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	emoji, err := c.App.GetEmoji(c.Params.EmojiId)
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

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	if len(*c.App.Config().FileSettings.DriverName) == 0 {
		c.Err = model.NewAppError("getEmojiImage", "api.emoji.storage.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	image, imageType, err := c.App.GetEmojiImage(c.Params.EmojiId)
	if err != nil {
		c.Err = err
		return
	}

	w.Header().Set("Content-Type", "image/"+imageType)
	w.Header().Set("Cache-Control", "max-age=2592000, public")
	w.Write(image)
}
