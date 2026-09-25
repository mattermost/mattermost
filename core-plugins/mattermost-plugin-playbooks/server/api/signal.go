// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type PostVerifier interface {
	IsFromPoster(post *model.Post) bool
}

type SignalHandler struct {
	*ErrorHandler
	api                   *pluginapi.Client
	playbookRunService    app.PlaybookRunService
	playbookService       app.PlaybookService
	keywordsThreadIgnorer app.KeywordsThreadIgnorer
	postVerifier          PostVerifier
}

func NewSignalHandler(router *mux.Router, api *pluginapi.Client, playbookRunService app.PlaybookRunService, playbookService app.PlaybookService, keywordsThreadIgnorer app.KeywordsThreadIgnorer, postVerifier PostVerifier) *SignalHandler {
	handler := &SignalHandler{
		ErrorHandler:          &ErrorHandler{},
		api:                   api,
		playbookRunService:    playbookRunService,
		playbookService:       playbookService,
		keywordsThreadIgnorer: keywordsThreadIgnorer,
		postVerifier:          postVerifier,
	}

	signalRouter := router.PathPrefix("/signal").Subrouter()

	keywordsRouter := signalRouter.PathPrefix("/keywords").Subrouter()
	keywordsRouter.HandleFunc("/run-playbook", withContext(handler.playbookRun)).Methods(http.MethodPost)
	keywordsRouter.HandleFunc("/ignore-thread", withContext(handler.ignoreKeywords)).Methods(http.MethodPost)

	return handler
}

func (h *SignalHandler) playbookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	var req *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}
	if req == nil {
		h.returnError(publicErrorMessage, errors.New("nil request"), c.logger, w)
		return
	}

	botPost, err := h.verifyRequestAuthenticity(req, "runPlaybookButton")
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	id, err := getStringField("selected_option", req.Context)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	pbook, err := h.playbookService.Get(id)
	if err != nil {
		h.returnError("can't get chosen playbook", errors.Wrapf(err, "can't get chosen playbook, id - %s", id), c.logger, w)
		return
	}

	if err := h.playbookRunService.OpenCreatePlaybookRunDialog(req.TeamId, req.UserId, req.TriggerId, "", "", []app.Playbook{pbook}); err != nil {
		h.returnError("can't open dialog", errors.Wrap(err, "can't open a dialog"), c.logger, w)
		return
	}

	ReturnJSON(w, &model.PostActionIntegrationResponse{}, http.StatusOK)
	if err := h.api.Post.DeletePost(botPost.Id); err != nil {
		h.returnError("unable to delete original post", err, c.logger, w)
		return
	}
}

func (h *SignalHandler) ignoreKeywords(c *Context, w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"
	userID := r.Header.Get("Mattermost-User-ID")

	var req *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req == nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	botPost, err := h.verifyRequestAuthenticity(req, "ignoreKeywordsButton")
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	if !h.api.User.HasPermissionToChannel(userID, botPost.ChannelId, model.PermissionReadChannel) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "no permission to post specified", nil)
		return
	}

	postID, err := getStringField("postID", req.Context)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
	}
	post, err := h.api.Post.GetPost(postID)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	h.keywordsThreadIgnorer.Ignore(postID, post.UserId)
	if post.RootId != "" {
		h.keywordsThreadIgnorer.Ignore(post.RootId, post.UserId)
	}

	ReturnJSON(w, &model.PostActionIntegrationResponse{}, http.StatusOK)
	if err := h.api.Post.DeletePost(botPost.Id); err != nil {
		h.returnError("unable to delete original post", err, c.logger, w)
		return
	}
}

func (h *SignalHandler) returnError(returnMessage string, err error, logger logrus.FieldLogger, w http.ResponseWriter) {
	resp := model.PostActionIntegrationResponse{
		EphemeralText: fmt.Sprintf("Error: %s", returnMessage),
	}
	logger.WithError(err).Warn(returnMessage)
	ReturnJSON(w, &resp, http.StatusOK)
}

func getStringField(field string, context map[string]interface{}) (string, error) {
	fieldInt, ok := context[field]
	if !ok {
		return "", errors.Errorf("no %s field in the request context", field)
	}
	fieldValue, ok := fieldInt.(string)
	if !ok {
		return "", errors.Errorf("%s field is not a string", field)
	}
	return fieldValue, nil
}

// verifyRequestAuthenticity verifies the authenticity of the request by checking if the original post is from the plugin bot
// and if the action ID match the ones provided in the request.
// It returns an error if the authenticity check fails, otherwise it returns the original post.
func (h *SignalHandler) verifyRequestAuthenticity(req *model.PostActionIntegrationRequest, actionID string) (*model.Post, error) {
	botPost, err := h.api.Post.GetPost(req.PostId)
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve original post: %w", err)
	}
	if !h.postVerifier.IsFromPoster(botPost) {
		return nil, errors.New("original post is not from the plugin bot")
	}

	attachments := botPost.Attachments()
	if len(attachments) == 0 {
		return nil, errors.New("no attachments in the bot post")
	}
	for _, action := range attachments[0].Actions {
		if action.Id == actionID {
			return botPost, nil
		}
	}
	return nil, errors.New("no matching action found in the bot post")
}
