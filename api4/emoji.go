// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"io"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/web"
)

const (
	EMOJI_MAX_AUTOCOMPLETE_ITEMS = 100
)

func (api *API) InitEmoji() {
	api.BaseRoutes.Emojis.Handle("", api.ApiSessionRequired(createEmoji)).Methods("POST")
	api.BaseRoutes.Emojis.Handle("", api.ApiSessionRequired(getEmojiList)).Methods("GET")
	api.BaseRoutes.Emojis.Handle("/search", api.ApiSessionRequired(searchEmojis)).Methods("POST")
	api.BaseRoutes.Emojis.Handle("/autocomplete", api.ApiSessionRequired(autocompleteEmojis)).Methods("GET")
	api.BaseRoutes.Emoji.Handle("", api.ApiSessionRequired(deleteEmoji)).Methods("DELETE")
	api.BaseRoutes.Emoji.Handle("", api.ApiSessionRequired(getEmoji)).Methods("GET")
	api.BaseRoutes.EmojiByName.Handle("", api.ApiSessionRequired(getEmojiByName)).Methods("GET")
	api.BaseRoutes.Emoji.Handle("/image", api.ApiSessionRequiredTrustRequester(getEmojiImage)).Methods("GET")
}

func createEmoji(c *Context, w http.ResponseWriter, r *http.Request) {
	defer io.Copy(ioutil.Discard, r.Body)

	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("createEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
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

	// Allow any user with MANAGE_EMOJIS permission at Team level to manage emojis at system level
	memberships, err := c.App.GetTeamMembersForUser(c.Session.UserId)

	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_EMOJIS) {
		hasPermission := false
		for _, membership := range memberships {
			if c.App.SessionHasPermissionToTeam(c.Session, membership.TeamId, model.PERMISSION_MANAGE_EMOJIS) {
				hasPermission = true
				break
			}
		}
		if !hasPermission {
			c.SetPermissionError(model.PERMISSION_MANAGE_EMOJIS)
			return
		}
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
	}

	w.Write([]byte(newEmoji.ToJson()))
}

func getEmojiList(c *Context, w http.ResponseWriter, r *http.Request) {
	if !*c.App.Config().ServiceSettings.EnableCustomEmoji {
		c.Err = model.NewAppError("getEmoji", "api.emoji.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	sort := r.URL.Query().Get("sort")
	if sort != "" && sort != model.EMOJI_SORT_BY_NAME {
		c.SetInvalidUrlParam("sort")
		return
	}

	listEmoji, err := c.App.GetEmojiList(c.Params.Page, c.Params.PerPage, sort)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.EmojiListToJson(listEmoji)))
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

	// Allow any user with MANAGE_EMOJIS permission at Team level to manage emojis at system level
	memberships, err := c.App.GetTeamMembersForUser(c.Session.UserId)

	if err != nil {
		c.Err = err
		return
	}

	if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_EMOJIS) {
		hasPermission := false
		for _, membership := range memberships {
			if c.App.SessionHasPermissionToTeam(c.Session, membership.TeamId, model.PERMISSION_MANAGE_EMOJIS) {
				hasPermission = true
				break
			}
		}
		if !hasPermission {
			c.SetPermissionError(model.PERMISSION_MANAGE_EMOJIS)
			return
		}
	}

	if c.Session.UserId != emoji.CreatorId {
		if !c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_OTHERS_EMOJIS) {
			hasPermission := false
			for _, membership := range memberships {
				if c.App.SessionHasPermissionToTeam(c.Session, membership.TeamId, model.PERMISSION_MANAGE_OTHERS_EMOJIS) {
					hasPermission = true
					break
				}
			}

			if !hasPermission {
				c.SetPermissionError(model.PERMISSION_MANAGE_OTHERS_EMOJIS)
				return
			}
		}
	}

	err = c.App.DeleteEmoji(emoji)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
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
	}

	w.Write([]byte(emoji.ToJson()))
}

func getEmojiByName(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireEmojiName()
	if c.Err != nil {
		return
	}

	emoji, err := c.App.GetEmojiByName(c.Params.EmojiName)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(emoji.ToJson()))
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

func searchEmojis(c *Context, w http.ResponseWriter, r *http.Request) {
	emojiSearch := model.EmojiSearchFromJson(r.Body)
	if emojiSearch == nil {
		c.SetInvalidParam("term")
		return
	}

	if emojiSearch.Term == "" {
		c.SetInvalidParam("term")
		return
	}

	emojis, err := c.App.SearchEmoji(emojiSearch.Term, emojiSearch.PrefixOnly, web.PER_PAGE_MAXIMUM)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.EmojiListToJson(emojis)))
}

func autocompleteEmojis(c *Context, w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")

	if name == "" {
		c.SetInvalidUrlParam("name")
		return
	}

	emojis, err := c.App.SearchEmoji(name, true, EMOJI_MAX_AUTOCOMPLETE_ITEMS)
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(model.EmojiListToJson(emojis)))
}
