// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
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

	if r.ContentLength > app.MaxEmojiFileSize {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.too_large.app_error", nil, "")
		c.Err.StatusCode = http.StatusRequestEntityTooLarge
		return
	}

	if err := r.ParseMultipartForm(app.MaxEmojiFileSize); err != nil {
		c.Err = model.NewLocAppError("createEmoji", "api.emoji.create.parse.app_error", nil, err.Error())
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	m := r.MultipartForm
	props := m.Value

	emoji := model.EmojiFromJson(strings.NewReader(props["emoji"][0]))
	if emoji == nil {
		c.SetInvalidParam("createEmoji")
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
