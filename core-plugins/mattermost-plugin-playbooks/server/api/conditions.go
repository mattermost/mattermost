// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

const (
	DefaultPerPage = 20
	MaxPerPage     = 200
)

// NewConditionHandler creates the condition API handler and sets up routes
func NewConditionHandler(router *mux.Router, conditionService app.ConditionService, playbookService app.PlaybookService, playbookRunService app.PlaybookRunService, propertyService app.PropertyService, permissions *app.PermissionsService, pluginAPI *pluginapi.Client) *ConditionHandler {
	handler := &ConditionHandler{
		ErrorHandler:       &ErrorHandler{},
		conditionService:   conditionService,
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
		propertyService:    propertyService,
		permissions:        permissions,
		pluginAPI:          pluginAPI,
	}

	// Playbook conditions: /playbooks/{id}/conditions
	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()
	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookConditionsRouter := playbookRouter.PathPrefix("/conditions").Subrouter()
	playbookConditionsRouter.HandleFunc("", withContext(handler.getPlaybookConditions)).Methods(http.MethodGet)
	playbookConditionsRouter.HandleFunc("", withContext(handler.createPlaybookCondition)).Methods(http.MethodPost)

	playbookConditionRouter := playbookConditionsRouter.PathPrefix("/{conditionID:[A-Za-z0-9]+}").Subrouter()
	playbookConditionRouter.HandleFunc("", withContext(handler.updatePlaybookCondition)).Methods(http.MethodPut)
	playbookConditionRouter.HandleFunc("", withContext(handler.deletePlaybookCondition)).Methods(http.MethodDelete)

	// Run conditions: /runs/{id}/conditions (read-only)
	runsRouter := router.PathPrefix("/runs").Subrouter()
	runRouter := runsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	runConditionsRouter := runRouter.PathPrefix("/conditions").Subrouter()
	runConditionsRouter.HandleFunc("", withContext(handler.getRunConditions)).Methods(http.MethodGet)

	return handler
}

// ConditionHandler handles condition-related API endpoints
type ConditionHandler struct {
	*ErrorHandler
	conditionService   app.ConditionService
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
	propertyService    app.PropertyService
	permissions        *app.PermissionsService
	pluginAPI          *pluginapi.Client
}

// READ operations

// getPlaybookConditions handles GET /api/v0/playbooks/{id}/conditions
func (h *ConditionHandler) getPlaybookConditions(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookViewConditions(userID, playbookID)) {
		return
	}

	page, perPage := parsePaginationParams(r.URL.Query())

	results, err := h.conditionService.GetPlaybookConditions(userID, playbookID, page, perPage)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getRunConditions handles GET /api/v0/runs/{id}/conditions
func (h *ConditionHandler) getRunConditions(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	runID := vars["id"]

	// Permission check for run view
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunViewConditions(userID, runID)) {
		return
	}

	// Get the run to find the playbookID
	run, err := h.playbookRunService.GetPlaybookRun(runID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	page, perPage := parsePaginationParams(r.URL.Query())

	results, err := h.conditionService.GetRunConditions(userID, run.PlaybookID, runID, page, perPage)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// WRITE operations (playbook conditions only - run conditions are read-only)

// createPlaybookCondition handles POST /api/v0/playbooks/{id}/conditions
func (h *ConditionHandler) createPlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageConditions(userID, playbook)) {
		return
	}

	var conditionRequest ConditionRequest
	if err := json.NewDecoder(r.Body).Decode(&conditionRequest); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode condition request", err)
		return
	}

	// Set playbook ID from URL
	conditionRequest.PlaybookID = playbookID

	// Convert request to domain model
	condition, err := conditionRequest.ToCondition()
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid condition format", err)
		return
	}

	createdCondition, err := h.conditionService.CreatePlaybookCondition(userID, *condition, playbook.TeamID)
	if err != nil {
		if errors.Is(err, app.ErrMalformedCondition) {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid condition expression", err)
		} else {
			h.HandleError(w, c.logger, err)
		}
		return
	}

	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s/conditions/%s", playbookID, createdCondition.ID))
	ReturnJSON(w, createdCondition, http.StatusCreated)
}

// updatePlaybookCondition handles PUT /api/v0/playbooks/{id}/conditions/{conditionID}
func (h *ConditionHandler) updatePlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]
	conditionID := vars["conditionID"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageConditions(userID, playbook)) {
		return
	}

	// Get existing condition
	existing, err := h.conditionService.GetPlaybookCondition(userID, playbookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this playbook
	if existing.PlaybookID != playbookID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	var conditionRequest ConditionRequest
	if err := json.NewDecoder(r.Body).Decode(&conditionRequest); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode condition request", err)
		return
	}

	// Set condition metadata from URL
	conditionRequest.ID = conditionID
	conditionRequest.PlaybookID = playbookID

	// Convert request to domain model
	condition, err := conditionRequest.ToCondition()
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid condition format", err)
		return
	}

	updatedCondition, err := h.conditionService.UpdatePlaybookCondition(userID, *condition, playbook.TeamID)
	if err != nil {
		if errors.Is(err, app.ErrMalformedCondition) {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid condition expression", err)
		} else {
			h.HandleError(w, c.logger, err)
		}
		return
	}

	ReturnJSON(w, updatedCondition, http.StatusOK)
}

// deletePlaybookCondition handles DELETE /api/v0/playbooks/{id}/conditions/{conditionID}
func (h *ConditionHandler) deletePlaybookCondition(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	playbookID := vars["id"]
	conditionID := vars["conditionID"]

	// Get playbook for permission check
	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Permission check
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookManageConditions(userID, playbook)) {
		return
	}

	// Get existing condition
	existing, err := h.conditionService.GetPlaybookCondition(userID, playbookID, conditionID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// Verify condition belongs to this playbook
	if existing.PlaybookID != playbookID {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "condition not found", nil)
		return
	}

	// Check if this is a run condition (read-only)
	if existing.RunID != "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "run conditions cannot be deleted", nil)
		return
	}

	if err := h.conditionService.DeletePlaybookCondition(userID, playbookID, conditionID, playbook.TeamID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// parsePaginationParams parses page and per_page query parameters from url.Values
func parsePaginationParams(query url.Values) (page, perPage int) {
	perPage = DefaultPerPage

	// Parse page parameter
	if pageStr := query.Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p >= 0 {
			page = p
		}
	}

	// Parse per_page parameter, only override default if valid
	if perPageStr := query.Get("per_page"); perPageStr != "" {
		if pp, err := strconv.Atoi(perPageStr); err == nil && pp > 0 {
			if pp > MaxPerPage {
				pp = MaxPerPage
			}
			perPage = pp
		}
	}

	return page, perPage
}

// ConditionRequest represents a condition request from the API
type ConditionRequest struct {
	ID            string          `json:"id"`
	ConditionExpr json.RawMessage `json:"condition_expr"`
	Version       int             `json:"version"`
	PlaybookID    string          `json:"playbook_id"`
	RunID         string          `json:"run_id,omitempty"`
	CreateAt      int64           `json:"create_at"`
	UpdateAt      int64           `json:"update_at"`
}

// ToCondition converts a ConditionRequest to a Condition
func (cr *ConditionRequest) ToCondition() (*app.Condition, error) {
	// Enforce version requirement
	if cr.Version == 0 {
		return nil, errors.New("version is required and cannot be 0")
	}

	condition := &app.Condition{
		ID:         cr.ID,
		Version:    cr.Version,
		PlaybookID: cr.PlaybookID,
		RunID:      cr.RunID,
		CreateAt:   cr.CreateAt,
		UpdateAt:   cr.UpdateAt,
	}

	// ConditionExpr is required
	if cr.ConditionExpr == nil || string(cr.ConditionExpr) == "null" {
		return nil, errors.New("condition_expr is required and cannot be null")
	}

	// Handle versioned condition expression
	switch condition.Version {
	case 1:
		var exprV1 app.ConditionExprV1
		if err := json.Unmarshal(cr.ConditionExpr, &exprV1); err != nil {
			return nil, errors.Wrap(err, "failed to unmarshal condition expression v1")
		}
		condition.ConditionExpr = &exprV1
	default:
		return nil, errors.Errorf("unsupported condition version: %d", condition.Version)
	}

	return condition, nil
}
