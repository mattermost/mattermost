// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitReaction() {
	l4g.Debug(utils.T("api.reaction.init.debug"))

	BaseRoutes.Post.Handle("/reactions", ApiSessionRequired(getReactions)).Methods("GET")
}

func getReactions(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePostId()
	if c.Err != nil {
		return
	}

	if !app.SessionHasPermissionToChannelByPost(c.Session, c.Params.PostId, model.PERMISSION_READ_CHANNEL) {
		c.SetPermissionError(model.PERMISSION_READ_CHANNEL)
		return
	}

	if reactions, err := app.GetReactionsForPost(c.Params.PostId); err != nil {
		c.Err = err
		return
	} else {
		w.Write([]byte(model.ReactionsToJson(reactions)))
		return
	}
}
