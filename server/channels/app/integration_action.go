// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Integration Action Flow
//
// 1. An integration creates an interactive message button or menu.
// 2. A user clicks on a button or selects an option from the menu.
// 3. The client sends a request to server to complete the post action, calling DoPostActionWithCookie below.
// 4. DoPostActionWithCookie will send an HTTP POST request to the integration containing contextual data, including
// an encoded and signed trigger ID. Slash commands also include trigger IDs in their payloads.
// 5. The integration performs any actions it needs to and optionally makes a request back to the MM server
// using the trigger ID to open an interactive dialog.
// 6. If that optional request is made, OpenInteractiveDialog sends a WebSocket event to all connected clients
// for the relevant user, telling them to display the dialog.
// 7. The user fills in the dialog and submits it, where SubmitInteractiveDialog will submit it back to the
// integration for handling.

package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (a *App) DoPostActionWithCookie(c request.CTX, postID, actionId, userID, selectedOption string, cookie *model.PostActionCookie) (string, *model.AppError) {
	// PostAction may result in the original post being updated. For the
	// updated post, we need to unconditionally preserve the original
	// IsPinned and HasReaction attributes, and preserve its entire
	// original Props set unless the plugin returns a replacement value.
	// originalXxx variables are used to preserve these values.
	var originalProps map[string]any
	originalIsPinned := false
	originalHasReactions := false

	// If the updated post does contain a replacement Props set, we still
	// need to preserve some original values, as listed in
	// model.PostActionRetainPropKeys. remove and retain track these.
	remove := []string{}
	retain := map[string]any{}

	datasource := ""
	upstreamURL := ""
	rootPostId := ""
	upstreamRequest := &model.PostActionIntegrationRequest{
		UserId: userID,
		PostId: postID,
	}

	// See if the post exists in the DB, if so ignore the cookie.
	// Start all queries here for parallel execution
	pchan := make(chan store.StoreResult[*model.Post], 1)
	go func() {
		post, err := a.Srv().Store().Post().GetSingle(c, postID, false)
		pchan <- store.StoreResult[*model.Post]{Data: post, NErr: err}
		close(pchan)
	}()

	cchan := make(chan store.StoreResult[*model.Channel], 1)
	go func() {
		channel, err := a.Srv().Store().Channel().GetForPost(postID)
		cchan <- store.StoreResult[*model.Channel]{Data: channel, NErr: err}
		close(cchan)
	}()

	userChan := make(chan store.StoreResult[*model.User], 1)
	go func() {
		user, err := a.Srv().Store().User().Get(context.Background(), upstreamRequest.UserId)
		userChan <- store.StoreResult[*model.User]{Data: user, NErr: err}
		close(userChan)
	}()

	result := <-pchan
	if result.NErr != nil {
		if cookie == nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(result.NErr, &nfErr):
				return "", model.NewAppError("DoPostActionWithCookie", "app.post.get.app_error", nil, "", http.StatusNotFound).Wrap(result.NErr)
			default:
				return "", model.NewAppError("DoPostActionWithCookie", "app.post.get.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
			}
		}
		if cookie.Integration == nil {
			return "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "no Integration in action cookie", http.StatusBadRequest)
		}

		if postID != cookie.PostId {
			return "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "postId doesn't match", http.StatusBadRequest)
		}

		channel, err := a.Srv().Store().Channel().Get(cookie.ChannelId, true)
		if err != nil {
			errCtx := map[string]any{"channel_id": cookie.ChannelId}
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(err, &nfErr):
				return "", model.NewAppError("DoPostActionWithCookie", "app.channel.get.existing.app_error", errCtx, "", http.StatusNotFound).Wrap(err)
			default:
				return "", model.NewAppError("DoPostActionWithCookie", "app.channel.get.find.app_error", errCtx, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		upstreamRequest.ChannelId = cookie.ChannelId
		upstreamRequest.ChannelName = channel.Name
		upstreamRequest.TeamId = channel.TeamId
		upstreamRequest.Type = cookie.Type
		upstreamRequest.Context = cookie.Integration.Context
		datasource = cookie.DataSource

		retain = cookie.RetainProps
		remove = cookie.RemoveProps
		rootPostId = cookie.RootPostId
		upstreamURL = cookie.Integration.URL
	} else {
		post := result.Data
		chResult := <-cchan
		if chResult.NErr != nil {
			return "", model.NewAppError("DoPostActionWithCookie", "app.channel.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(result.NErr)
		}
		channel := chResult.Data

		action := post.GetAction(actionId)
		if action == nil || action.Integration == nil {
			return "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("action=%v", action), http.StatusNotFound)
		}

		upstreamRequest.ChannelId = post.ChannelId
		upstreamRequest.ChannelName = channel.Name
		upstreamRequest.TeamId = channel.TeamId
		upstreamRequest.Type = action.Type
		upstreamRequest.Context = action.Integration.Context
		datasource = action.DataSource

		// Save the original values that may need to be preserved (including selected
		// Props, i.e. override_username, override_icon_url)
		for _, key := range model.PostActionRetainPropKeys {
			value, ok := post.GetProps()[key]
			if ok {
				retain[key] = value
			} else {
				remove = append(remove, key)
			}
		}
		originalProps = post.GetProps()
		originalIsPinned = post.IsPinned
		originalHasReactions = post.HasReactions

		if post.RootId == "" {
			rootPostId = post.Id
		} else {
			rootPostId = post.RootId
		}

		upstreamURL = action.Integration.URL
	}

	teamChan := make(chan store.StoreResult[*model.Team], 1)

	go func() {
		defer close(teamChan)

		// Direct and group channels won't have teams.
		if upstreamRequest.TeamId == "" {
			return
		}

		team, err := a.Srv().Store().Team().Get(upstreamRequest.TeamId)
		teamChan <- store.StoreResult[*model.Team]{Data: team, NErr: err}
	}()

	ur := <-userChan
	if ur.NErr != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(ur.NErr, &nfErr):
			return "", model.NewAppError("DoPostActionWithCookie", MissingAccountError, nil, "", http.StatusNotFound).Wrap(ur.NErr)
		default:
			return "", model.NewAppError("DoPostActionWithCookie", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(ur.NErr)
		}
	}
	user := ur.Data
	upstreamRequest.UserName = user.Username

	tr, ok := <-teamChan
	if ok {
		if tr.NErr != nil {
			var nfErr *store.ErrNotFound
			switch {
			case errors.As(tr.NErr, &nfErr):
				return "", model.NewAppError("DoPostActionWithCookie", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(tr.NErr)
			default:
				return "", model.NewAppError("DoPostActionWithCookie", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(tr.NErr)
			}
		}

		team := tr.Data
		upstreamRequest.TeamName = team.Name
	}

	if upstreamRequest.Type == model.PostActionTypeSelect {
		if selectedOption != "" {
			if upstreamRequest.Context == nil {
				upstreamRequest.Context = map[string]any{}
			}
			upstreamRequest.DataSource = datasource
			upstreamRequest.Context["selected_option"] = selectedOption
		}
	}

	clientTriggerId, _, appErr := upstreamRequest.GenerateTriggerId(a.AsymmetricSigningKey())
	if appErr != nil {
		return "", appErr
	}

	requestJSON, err := json.Marshal(upstreamRequest)
	if err != nil {
		return "", model.NewAppError("DoPostActionWithCookie", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Log request, regardless of whether destination is internal or external
	c.Logger().Info("DoPostActionWithCookie POST request, through DoActionRequest",
		mlog.String("url", upstreamURL),
		mlog.String("user_id", upstreamRequest.UserId),
		mlog.String("post_id", upstreamRequest.PostId),
		mlog.String("channel_id", upstreamRequest.ChannelId),
		mlog.String("team_id", upstreamRequest.TeamId),
	)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout)*time.Second)
	defer cancel()
	resp, appErr := a.DoActionRequest(c.WithContext(ctx), upstreamURL, requestJSON)
	if appErr != nil {
		return "", appErr
	}
	defer resp.Body.Close()

	var response model.PostActionIntegrationResponse
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if len(respBytes) > 0 {
		if err = json.Unmarshal(respBytes, &response); err != nil {
			return "", model.NewAppError("DoPostActionWithCookie", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
	}

	if response.Update != nil {
		response.Update.Id = postID

		// Restore the post attributes and Props that need to be preserved
		if response.Update.GetProps() == nil {
			response.Update.SetProps(originalProps)
		} else {
			for key, value := range retain {
				response.Update.AddProp(key, value)
			}
			for _, key := range remove {
				response.Update.DelProp(key)
			}
		}
		response.Update.IsPinned = originalIsPinned
		response.Update.HasReactions = originalHasReactions

		if _, appErr = a.UpdatePost(c, response.Update, &model.UpdatePostOptions{SafeUpdate: false}); appErr != nil {
			return "", appErr
		}
	}

	if response.EphemeralText != "" {
		ephemeralPost := &model.Post{
			Message:   response.EphemeralText,
			ChannelId: upstreamRequest.ChannelId,
			RootId:    rootPostId,
			UserId:    userID,
		}

		if !response.SkipSlackParsing {
			ephemeralPost.Message = model.ParseSlackLinksToMarkdown(response.EphemeralText)
		}

		for key, value := range retain {
			ephemeralPost.AddProp(key, value)
		}
		a.SendEphemeralPost(c, userID, ephemeralPost)
	}

	return clientTriggerId, nil
}

// DoActionRequest performs an HTTP POST request to an integration's action endpoint.
// Caller must consume and close returned http.Response as necessary.
// For internal requests, requests are routed directly to a plugin ServerHTTP hook
func (a *App) DoActionRequest(c request.CTX, rawURL string, body []byte) (*http.Response, *model.AppError) {
	inURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	rawURLPath := path.Clean(rawURL)
	if strings.HasPrefix(rawURLPath, "/plugins/") || strings.HasPrefix(rawURLPath, "plugins/") {
		return a.DoLocalRequest(c, rawURLPath, body)
	}

	req, err := http.NewRequestWithContext(c.Context(), "POST", rawURL, bytes.NewReader(body))
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			c.Logger().Info("Outgoing Integration Action request timed out. Consider increasing ServiceSettings.OutgoingIntegrationRequestsTimeout.")
		}
		return nil, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Allow access to plugin routes for action buttons
	var httpClient *http.Client
	subpath, _ := utils.GetSubpathFromConfig(a.Config())
	siteURL, _ := url.Parse(*a.Config().ServiceSettings.SiteURL)
	if inURL.Hostname() == siteURL.Hostname() && strings.HasPrefix(inURL.Path, path.Join(subpath, "plugins")) {
		req.Header.Set(model.HeaderAuth, "Bearer "+c.Session().Token)
		httpClient = a.HTTPService().MakeClient(true)
	} else {
		httpClient = a.HTTPService().MakeClient(false)
	}

	resp, httpErr := httpClient.Do(req)
	if httpErr != nil {
		return nil, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(httpErr)
	}

	if resp.StatusCode != http.StatusOK {
		return resp, model.NewAppError("DoActionRequest", "api.post.do_action.action_integration.app_error", nil, fmt.Sprintf("status=%v", resp.StatusCode), http.StatusBadRequest)
	}

	return resp, nil
}

type LocalResponseWriter struct {
	data    []byte
	headers http.Header
	status  int
}

func (w *LocalResponseWriter) Header() http.Header {
	if w.headers == nil {
		w.headers = make(http.Header)
	}
	return w.headers
}

func (w *LocalResponseWriter) Write(bytes []byte) (int, error) {
	w.data = make([]byte, len(bytes))
	copy(w.data, bytes)
	return len(w.data), nil
}

func (w *LocalResponseWriter) WriteHeader(statusCode int) {
	w.status = statusCode
}

func (a *App) doPluginRequest(c request.CTX, method, rawURL string, values url.Values, body []byte) (*http.Response, *model.AppError) {
	return a.ch.doPluginRequest(c, method, rawURL, values, body)
}

func (ch *Channels) doPluginRequest(c request.CTX, method, rawURL string, values url.Values, body []byte) (*http.Response, *model.AppError) {
	rawURL = strings.TrimPrefix(rawURL, "/")
	inURL, err := url.Parse(rawURL)
	if err != nil {
		return nil, model.NewAppError("doPluginRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	result := strings.Split(inURL.Path, "/")
	if len(result) < 2 {
		return nil, model.NewAppError("doPluginRequest", "api.post.do_action.action_integration.app_error", nil, "err=Unable to find pluginId", http.StatusBadRequest)
	}
	if result[0] != "plugins" {
		return nil, model.NewAppError("doPluginRequest", "api.post.do_action.action_integration.app_error", nil, "err=plugins not in path", http.StatusBadRequest)
	}
	pluginID := result[1]

	path := strings.TrimPrefix(inURL.Path, "plugins/"+pluginID)

	base, err := url.Parse(path)
	if err != nil {
		return nil, model.NewAppError("doPluginRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// merge the rawQuery params (if any) with the function's provided values
	rawValues := inURL.Query()
	if len(rawValues) != 0 {
		if values == nil {
			values = make(url.Values)
		}
		for k, vs := range rawValues {
			for _, v := range vs {
				values.Add(k, v)
			}
		}
	}
	if values != nil {
		base.RawQuery = values.Encode()
	}

	w := &LocalResponseWriter{}
	r, err := http.NewRequest(method, base.String(), bytes.NewReader(body))
	if err != nil {
		return nil, model.NewAppError("doPluginRequest", "api.post.do_action.action_integration.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}
	r.Header.Set("Mattermost-User-Id", c.Session().UserId)
	r.Header.Set(model.HeaderAuth, "Bearer "+c.Session().Token)
	params := make(map[string]string)
	params["plugin_id"] = pluginID
	r = mux.SetURLVars(r, params)

	ch.ServePluginRequest(w, r)

	resp := &http.Response{
		StatusCode: w.status,
		Proto:      "HTTP/1.1",
		ProtoMajor: 1,
		ProtoMinor: 1,
		Header:     w.headers,
		Body:       io.NopCloser(bytes.NewReader(w.data)),
	}
	if resp.StatusCode == 0 {
		resp.StatusCode = http.StatusOK
	}

	return resp, nil
}

type MailToLinkContent struct {
	MetricId      string `json:"metric_id"`
	MailRecipient string `json:"mail_recipient"`
	MailCC        string `json:"mail_cc"`
	MailSubject   string `json:"mail_subject"`
	MailBody      string `json:"mail_body"`
}

func (mlc *MailToLinkContent) ToJSON() string {
	b, _ := json.Marshal(mlc)
	return string(b)
}

func (a *App) DoLocalRequest(c request.CTX, rawURL string, body []byte) (*http.Response, *model.AppError) {
	return a.doPluginRequest(c, "POST", rawURL, nil, body)
}

func (a *App) OpenInteractiveDialog(c request.CTX, request model.OpenDialogRequest) *model.AppError {
	timeout := time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout) * time.Second
	clientTriggerId, userID, appErr := request.DecodeAndVerifyTriggerId(a.AsymmetricSigningKey(), timeout)
	if appErr != nil {
		return appErr
	}

	if dialogErr := request.IsValid(); dialogErr != nil {
		c.Logger().Warn("Interactive dialog is invalid", mlog.Err(dialogErr))
	}

	request.TriggerId = clientTriggerId

	jsonRequest, err := json.Marshal(request)
	if err != nil {
		a.ch.srv.Log().Warn("Error encoding request", mlog.Err(err))
	}

	message := model.NewWebSocketEvent(model.WebsocketEventOpenDialog, "", "", userID, nil, "")
	message.Add("dialog", string(jsonRequest))
	a.Publish(message)

	return nil
}

func (a *App) SubmitInteractiveDialog(c request.CTX, request model.SubmitDialogRequest) (*model.SubmitDialogResponse, *model.AppError) {
	url := request.URL
	request.URL = ""
	request.Type = "dialog_submission"

	b, err := json.Marshal(request)
	if err != nil {
		return nil, model.NewAppError("SubmitInteractiveDialog", "app.submit_interactive_dialog.json_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	// Log request, regardless of whether destination is internal or external
	c.Logger().Info("SubmitInteractiveDialog POST request, through DoActionRequest",
		mlog.String("url", url),
		mlog.String("user_id", request.UserId),
		mlog.String("channel_id", request.ChannelId),
		mlog.String("team_id", request.TeamId),
	)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(*a.Config().ServiceSettings.OutgoingIntegrationRequestsTimeout)*time.Second)
	defer cancel()
	resp, appErr := a.DoActionRequest(c.WithContext(ctx), url, b)
	if appErr != nil {
		return nil, appErr
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, model.NewAppError("SubmitInteractiveDialog", "app.submit_interactive_dialog.read_body_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var response model.SubmitDialogResponse
	if len(body) == 0 {
		// Don't fail, an empty response is acceptable
		return &response, nil
	}

	err = json.Unmarshal(body, &response)
	if err != nil {
		return nil, model.NewAppError("SubmitInteractiveDialog", "app.submit_interactive_dialog.decode_json_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return &response, nil
}
