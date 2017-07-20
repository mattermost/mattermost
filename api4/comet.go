// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitComet() {
	l4g.Debug(utils.T("api.comet.init.debug"))

	BaseRoutes.ApiRoot.Handle("/comet", ApiSessionRequired(connectComet)).Methods("GET")
}

func connectComet(c *Context, w http.ResponseWriter, r *http.Request) {
	type Response struct {
		Events      []interface{} `json:"events"`
		ResumeToken string        `json:"resume_token"`
	}

	resumeToken := r.URL.Query().Get("resume_token")
	hub := app.GetHubForUserId(c.Session.UserId)

	firstEventContext, firstEventCancel := context.WithTimeout(context.Background(), time.Second*30)
	defer firstEventCancel()
	batchedEventContext, batchedEventCancel := context.WithTimeout(context.Background(), time.Millisecond*500)
	defer batchedEventCancel()

	ctx := firstEventContext

	var response Response

	for {
		select {
		case <-ctx.Done():
			if len(response.Events) > 0 {
				if err := json.NewEncoder(w).Encode(response); err != nil {
					http.Error(w, "internal server error", http.StatusInternalServerError)
				}
			} else {
				http.Error(w, "request timeout", http.StatusRequestTimeout)
			}
			return
		default:
		}
		if result, err := hub.NextCometEvent(ctx, resumeToken, &c.Session); err == context.DeadlineExceeded {
			continue
		} else if err != nil {
			c.Err = model.NewAppError("connectComet", "api.comet.connect.app_error", nil, err.Error(), http.StatusInternalServerError)
			return
		} else {
			response.ResumeToken = result.ResumeToken
			response.Events = append(response.Events, result.Event)
			ctx = batchedEventContext
			resumeToken = result.ResumeToken
		}
	}

}
