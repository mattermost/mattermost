// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/app"
	"github.com/mattermost/mattermost/server/v8/playbooks/server/playbooks"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

type SignalHandler struct {
	*ErrorHandler
	api                   playbooks.ServicesAPI
	playbookRunService    app.PlaybookRunService
	playbookService       app.PlaybookService
	keywordsThreadIgnorer app.KeywordsThreadIgnorer
}

func NewSignalHandler(router *mux.Router, api playbooks.ServicesAPI, playbookRunService app.PlaybookRunService, playbookService app.PlaybookService, keywordsThreadIgnorer app.KeywordsThreadIgnorer) *SignalHandler {
	handler := &SignalHandler{
		ErrorHandler:          &ErrorHandler{},
		api:                   api,
		playbookRunService:    playbookRunService,
		playbookService:       playbookService,
		keywordsThreadIgnorer: keywordsThreadIgnorer,
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

	id, err := getStringField("selected_option", req.Context, w)
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
	if _, err := h.api.DeletePost(req.PostId); err != nil {
		h.returnError("unable to delete original post", err, c.logger, w)
		return
	}
}

func (h *SignalHandler) ignoreKeywords(c *Context, w http.ResponseWriter, r *http.Request) {
	publicErrorMessage := "unable to decode post action integration request"

	var req *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil || req == nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	postID, err := getStringField("postID", req.Context, w)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}
	post, err := h.api.GetPost(postID)
	if err != nil {
		h.returnError(publicErrorMessage, err, c.logger, w)
		return
	}

	h.keywordsThreadIgnorer.Ignore(postID, post.UserId)
	if post.RootId != "" {
		h.keywordsThreadIgnorer.Ignore(post.RootId, post.UserId)
	}

	ReturnJSON(w, &model.PostActionIntegrationResponse{}, http.StatusOK)
	if _, err := h.api.DeletePost(req.PostId); err != nil {
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

func getStringField(field string, context map[string]interface{}, w http.ResponseWriter) (string, error) {
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
