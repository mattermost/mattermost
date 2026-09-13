// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// PlaybookHandler is the API handler.
type PlaybookHandler struct {
	*ErrorHandler
	playbookService app.PlaybookService
	propertyService app.PropertyServiceReader
	pluginAPI       *pluginapi.Client
	config          config.Service
	permissions     *app.PermissionsService
	licenseChecker  app.LicenseChecker
}

const SettingsKey = "global_settings"
const maxPlaybooksToAutocomplete = 15

type PropertyOptionInput struct {
	ID    *string `json:"id"`
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

type PropertyFieldAttrsInput struct {
	Visibility string                `json:"visibility"`
	SortOrder  float64               `json:"sort_order"`
	Options    []PropertyOptionInput `json:"options"`
	ParentID   string                `json:"parent_id"`
	ValueType  string                `json:"value_type"`
}

type PropertyFieldRequest struct {
	Name  string                   `json:"name"`
	Type  string                   `json:"type"`
	Attrs *PropertyFieldAttrsInput `json:"attrs,omitempty"`
}

// NewPlaybookHandler returns a new playbook api handler
func NewPlaybookHandler(router *mux.Router, playbookService app.PlaybookService, propertyService app.PropertyServiceReader, api *pluginapi.Client, configService config.Service, permissions *app.PermissionsService, licenseChecker app.LicenseChecker) *PlaybookHandler {
	handler := &PlaybookHandler{
		ErrorHandler:    &ErrorHandler{},
		playbookService: playbookService,
		propertyService: propertyService,
		pluginAPI:       api,
		config:          configService,
		permissions:     permissions,
		licenseChecker:  licenseChecker,
	}

	playbooksRouter := router.PathPrefix("/playbooks").Subrouter()

	playbooksRouter.HandleFunc("", withContext(handler.createPlaybook)).Methods(http.MethodPost)

	playbooksRouter.HandleFunc("", withContext(handler.getPlaybooks)).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/autocomplete", withContext(handler.getPlaybooksAutoComplete)).Methods(http.MethodGet)
	playbooksRouter.HandleFunc("/import", withContext(handler.importPlaybook)).Methods(http.MethodPost)

	playbookRouter := playbooksRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRouter.HandleFunc("", withContext(handler.getPlaybook)).Methods(http.MethodGet)
	playbookRouter.HandleFunc("", withContext(handler.updatePlaybook)).Methods(http.MethodPut)
	playbookRouter.HandleFunc("", withContext(handler.archivePlaybook)).Methods(http.MethodDelete)
	playbookRouter.HandleFunc("/restore", withContext(handler.restorePlaybook)).Methods(http.MethodPut)
	playbookRouter.HandleFunc("/export", withContext(handler.exportPlaybook)).Methods(http.MethodGet)
	playbookRouter.HandleFunc("/duplicate", withContext(handler.duplicatePlaybook)).Methods(http.MethodPost)

	propertyFieldsRouter := playbookRouter.PathPrefix("/property_fields").Subrouter()
	propertyFieldsRouter.HandleFunc("", withContext(handler.getPlaybookPropertyFields)).Methods(http.MethodGet)
	propertyFieldsRouter.HandleFunc("", withContext(handler.createPlaybookPropertyField)).Methods(http.MethodPost)
	propertyFieldsRouter.HandleFunc("/reorder", withContext(handler.reorderPlaybookPropertyFields)).Methods(http.MethodPost)
	propertyFieldRouter := propertyFieldsRouter.PathPrefix("/{fieldID:[A-Za-z0-9]+}").Subrouter()
	propertyFieldRouter.HandleFunc("", withContext(handler.updatePlaybookPropertyField)).Methods(http.MethodPut)
	propertyFieldRouter.HandleFunc("", withContext(handler.deletePlaybookPropertyField)).Methods(http.MethodDelete)

	autoFollowsRouter := playbookRouter.PathPrefix("/autofollows").Subrouter()
	autoFollowsRouter.HandleFunc("", withContext(handler.getAutoFollows)).Methods(http.MethodGet)
	autoFollowRouter := autoFollowsRouter.PathPrefix("/{userID:[A-Za-z0-9]+}").Subrouter()
	autoFollowRouter.HandleFunc("", withContext(handler.autoFollow)).Methods(http.MethodPut)
	autoFollowRouter.HandleFunc("", withContext(handler.autoUnfollow)).Methods(http.MethodDelete)

	insightsRouter := playbooksRouter.PathPrefix("/insights").Subrouter()
	insightsRouter.HandleFunc("/user/me", withContext(handler.getTopPlaybooksForUser)).Methods(http.MethodGet)
	insightsRouter.HandleFunc("/teams/{teamID}", withContext(handler.getTopPlaybooksForTeam)).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookHandler) validPlaybook(w http.ResponseWriter, logger logrus.FieldLogger, playbook *app.Playbook) bool {
	if playbook.WebhookOnCreationEnabled {
		if err := app.ValidateWebhookURLs(playbook.WebhookOnCreationURLs); err != nil {
			h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
			return false
		}
	}

	if playbook.WebhookOnStatusUpdateEnabled {
		if err := app.ValidateWebhookURLs(playbook.WebhookOnStatusUpdateURLs); err != nil {
			h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
			return false
		}
	}

	if playbook.CategorizeChannelEnabled {
		if err := app.ValidateCategoryName(playbook.CategoryName); err != nil {
			h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "invalid category name", err)
			return false
		}
	}

	if len(playbook.SignalAnyKeywords) != 0 {
		playbook.SignalAnyKeywords = app.ProcessSignalAnyKeywords(playbook.SignalAnyKeywords)
	}

	if playbook.BroadcastEnabled { //nolint
		for _, channelID := range playbook.BroadcastChannelIDs {
			channel, err := h.pluginAPI.Channel.Get(channelID)
			if err != nil {
				h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "broadcasting to invalid channel ID", err)
				return false
			}
			// check if channel is archived
			if channel.DeleteAt != 0 {
				h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "broadcasting to archived channel", err)
				return false
			}
		}
	}
	for listIndex := range playbook.Checklists {
		for itemIndex := range playbook.Checklists[listIndex].Items {
			if err := validateTaskActions(playbook.Checklists[listIndex].Items[itemIndex].TaskActions); err != nil {
				h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "invalid task actions", err)
				return false
			}
		}
	}

	return true
}

func (h *PlaybookHandler) createPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	if playbook.ID != "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Playbook given already has ID", nil)
		return
	}

	if playbook.ReminderTimerDefaultSeconds <= 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "playbook ReminderTimerDefaultSeconds must be > 0", nil)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	// If not specified make the creator the sole admin
	if len(playbook.Members) == 0 {
		playbook.Members = []app.PlaybookMember{
			{
				UserID: userID,
				Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
			},
		}
	}

	if !h.validPlaybook(w, c.logger, &playbook) {
		return
	}

	if err := h.validateMetrics(playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid metrics configs", err)
		return
	}

	app.CleanUpChecklists(playbook.Checklists)

	if err := validatePreAssignment(playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Invalid pre-assignment", err)
		return
	}

	id, err := h.playbookService.Create(playbook, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s", id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) getPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, &playbook, http.StatusOK)
}

func (h *PlaybookHandler) updatePlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")
	var playbook app.Playbook
	if err := json.NewDecoder(r.Body).Decode(&playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode playbook", err)
		return
	}

	// Force parsed playbook id to be URL parameter id
	playbook.ID = vars["id"]
	oldPlaybook, err := h.playbookService.Get(playbook.ID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if err = h.validateMetrics(playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid metrics configs", err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookModifyWithFixes(userID, &playbook, oldPlaybook)) {
		return
	}

	if oldPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Playbook cannot be modified", fmt.Errorf("playbook with id '%s' cannot be modified because it is archived", playbook.ID))
		return
	}

	if !h.validPlaybook(w, c.logger, &playbook) {
		return
	}

	// Clean checklist IDs for incremental update compatibility
	if h.config.IsIncrementalUpdatesEnabled() {
		app.CleanChecklistIDs(playbook.Checklists, oldPlaybook.Checklists)
	}

	app.CleanUpChecklists(playbook.Checklists)

	if err = validatePreAssignment(playbook); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Invalid user pre-assignment", err)
		return
	}

	err = h.playbookService.Update(playbook, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func validatePreAssignment(pb app.Playbook) error {
	assignees := app.GetDistinctAssignees(pb.Checklists)
	return app.ValidatePreAssignment(assignees, pb.InvitedUserIDs, pb.InviteUsersEnabled)
}

// validateTaskActions validates the taskactions in the given checklist
// NOTE: Any changes to this function must be made to function 'validateUpdateTaskActions' for the GraphQL endpoint.
func validateTaskActions(taskActions []app.TaskAction) error {
	// Limit task actions to 10
	if len(taskActions) > 10 {
		return errors.Errorf("playbook cannot have more than 10 task actions")
	}

	for _, ta := range taskActions {
		if err := app.ValidateTrigger(ta.Trigger); err != nil {
			return err
		}
		for _, a := range ta.Actions {
			if err := app.ValidateAction(a); err != nil {
				return err
			}
		}
	}
	return nil
}

func (h *PlaybookHandler) archivePlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToArchive, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.DeletePlaybook(userID, playbookToArchive)) {
		return
	}

	err = h.playbookService.Archive(playbookToArchive, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) restorePlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookToRestore, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.DeletePlaybook(userID, playbookToRestore)) {
		return
	}

	err = h.playbookService.Restore(playbookToRestore, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookHandler) getPlaybooks(c *Context, w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	opts, err := parseGetPlaybooksOptions(r.URL)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, fmt.Sprintf("failed to get playbooks: %s", err.Error()), nil)
		return
	}

	if teamID != "" && !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookList(userID, teamID)) {
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsSystemAdmin(userID, h.pluginAPI),
	}

	isGuest, err := app.IsGuest(userID, h.pluginAPI)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "", err)
		return
	}

	if isGuest {
		opts.WithMembershipOnly = true
	}

	playbookResults, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, opts)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	filteredItems := h.permissions.FilterPlaybooksByViewPermission(userID, playbookResults.Items)
	preFilterCount := len(playbookResults.Items)

	// Update results with filtered items
	playbookResults.Items = filteredItems
	// Note: TotalCount from DB represents total before permission filtering.
	// We keep it as an upper bound since recalculating would require re-querying.
	// HasMore is based on pre-filter count: if the DB returned a full page, there may be more
	// (client can request next page; worst case it's empty). Using post-filter count would
	// set HasMore = false as soon as one item is filtered out, stopping pagination too early.
	if opts.PerPage > 0 && preFilterCount < opts.PerPage {
		playbookResults.HasMore = false
	}

	ReturnJSON(w, playbookResults, http.StatusOK)
}

func (h *PlaybookHandler) getPlaybooksAutoComplete(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	teamID := query.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookList(userID, teamID)) {
		return
	}

	requesterInfo := app.RequesterInfo{
		UserID:  userID,
		TeamID:  teamID,
		IsAdmin: app.IsSystemAdmin(userID, h.pluginAPI),
	}

	playbooksResult, err := h.playbookService.GetPlaybooksForTeam(requesterInfo, teamID, app.PlaybookFilterOptions{
		Page:         0,
		PerPage:      maxPlaybooksToAutocomplete,
		WithArchived: query.Get("with_archived") == "true",
	})
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	filteredItems := h.permissions.FilterPlaybooksByViewPermission(userID, playbooksResult.Items)

	list := make([]model.AutocompleteListItem, 0)

	for _, playbook := range filteredItems {
		list = append(list, model.AutocompleteListItem{
			Item:     playbook.ID,
			HelpText: playbook.Title,
		})
	}

	ReturnJSON(w, list, http.StatusOK)
}

func parseGetPlaybooksOptions(u *url.URL) (app.PlaybookFilterOptions, error) {
	params := u.Query()

	var sortField app.SortField
	param := strings.ToLower(params.Get("sort"))
	switch param {
	case "title", "":
		sortField = app.SortByTitle
	case "stages":
		sortField = app.SortByStages
	case "steps":
		sortField = app.SortBySteps
	case "runs":
		sortField = app.SortByRuns
	case "last_run_at":
		sortField = app.SortByLastRunAt
	case "active_runs":
		sortField = app.SortByActiveRuns
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'sort' (%s): it should be empty or one of 'title', 'stages', 'steps', 'runs', 'last_run_at'", param)
	}

	var sortDirection app.SortDirection
	param = strings.ToLower(params.Get("direction"))
	switch param {
	case "asc", "":
		sortDirection = app.DirectionAsc
	case "desc":
		sortDirection = app.DirectionDesc
	default:
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'direction' (%s): it should be empty or one of 'asc' or 'desc'", param)
	}

	pageParam := params.Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'page': it should be a number")
	}
	if page < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'page': it should be a positive number")
	}

	perPageParam := params.Get("per_page")
	if perPageParam == "" || perPageParam == "0" {
		perPageParam = "1000"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return app.PlaybookFilterOptions{}, errors.Wrapf(err, "bad parameter 'per_page': it should be a number")
	}
	if perPage < 0 {
		return app.PlaybookFilterOptions{}, errors.Errorf("bad parameter 'per_page': it should be a positive number")
	}

	searchTerm := u.Query().Get("search_term")

	withArchived, _ := strconv.ParseBool(u.Query().Get("with_archived"))

	return app.PlaybookFilterOptions{
		Sort:         sortField,
		Direction:    sortDirection,
		Page:         page,
		PerPage:      perPage,
		SearchTerm:   searchTerm,
		WithArchived: withArchived,
	}, nil
}

func (h *PlaybookHandler) autoFollow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")
	userID := mux.Vars(r)["userID"]

	if currentUserID != userID && !app.IsSystemAdmin(currentUserID, h.pluginAPI) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "User doesn't have permissions to make another user autofollow the playbook.", nil)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	if err := h.playbookService.AutoFollow(playbookID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookHandler) autoUnfollow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")
	userID := mux.Vars(r)["userID"]

	if currentUserID != userID && !app.IsSystemAdmin(currentUserID, h.pluginAPI) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "User doesn't have permissions to make another user autofollow the playbook.", nil)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(userID, playbookID)) {
		return
	}

	if err := h.playbookService.AutoUnfollow(playbookID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// getAutoFollows returns the list of users that have marked this playbook for auto-following runs
func (h *PlaybookHandler) getAutoFollows(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookID := mux.Vars(r)["id"]
	currentUserID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookView(currentUserID, playbookID)) {
		return
	}

	autoFollowers, err := h.playbookService.GetAutoFollows(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	ReturnJSON(w, autoFollowers, http.StatusOK)
}

func (h *PlaybookHandler) exportPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookViewWithPlaybook(userID, playbook)) {
		return
	}

	export, err := app.GeneratePlaybookExport(playbook)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(export)
}

func (h *PlaybookHandler) duplicatePlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookViewWithPlaybook(userID, playbook)) {
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	newPlaybookID, err := h.playbookService.Duplicate(playbook, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: newPlaybookID,
	}
	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) importPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	var importBlock struct {
		app.Playbook
		Version int `json:"version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&importBlock); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode playbook import", err)
		return
	}
	playbook := importBlock.Playbook

	if playbook.ID != "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "playbook import should not have ID field", nil)
		return
	}

	if importBlock.Version != app.CurrentPlaybookExportVersion {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Unsupported import version", nil)
		return
	}

	// Make the importer the sole admin of the playbook.
	playbook.Members = []app.PlaybookMember{
		{
			UserID: userID,
			Roles:  []string{app.PlaybookRoleMember, app.PlaybookRoleAdmin},
		},
	}

	// Force the imported playbook to be public to avoid licencing issues
	playbook.Public = true

	if teamID != "" {
		playbook.TeamID = teamID
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookCreate(userID, playbook)) {
		return
	}

	if !h.validPlaybook(w, c.logger, &playbook) {
		return
	}

	id, err := h.playbookService.Import(playbook, userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	result := struct {
		ID string `json:"id"`
	}{
		ID: id,
	}
	w.Header().Add("Location", makeAPIURL(h.pluginAPI, "playbooks/%s", id))

	ReturnJSON(w, &result, http.StatusCreated)
}

func (h *PlaybookHandler) validateMetrics(pb app.Playbook) error {
	if len(pb.Metrics) > app.MaxMetricsPerPlaybook {
		return errors.Errorf("playbook cannot have more than %d key metrics", app.MaxMetricsPerPlaybook)
	}

	//check if titles are unique
	titles := make(map[string]bool)
	for _, m := range pb.Metrics {
		if titles[m.Title] {
			return errors.Errorf("metrics names must be unique")
		}
		titles[m.Title] = true
	}
	return nil
}

func (h *PlaybookHandler) getTopPlaybooksForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	params := r.URL.Query()
	timeRange := params.Get("time_range")
	teamID := params.Get("team_id")
	if teamID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotImplemented, "invalid team_id parameter", errors.New("teamID cannot be empty"))
		return
	}
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookList(userID, teamID)) {
		return
	}

	page, err := strconv.Atoi(params.Get("page"))
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error converting page parameter to integer", err)
		return
	}
	perPage, err := strconv.Atoi(params.Get("per_page"))
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error converting per_page parameter to integer", err)
		return
	}

	// setting startTime as per user's location
	user, err := h.pluginAPI.User.Get(userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to get user", err)
		return
	}
	timezone := user.GetTimezoneLocation()

	// get unix time for duration
	startTime, err := GetStartOfDayForTimeRange(timeRange, timezone)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid time parameter", err)
		return
	}

	topPlaybooks, err := h.playbookService.GetTopPlaybooksForUser(teamID, userID, &app.InsightsOpts{
		StartUnixMilli: model.GetMillisForTime(*startTime),
		Page:           page,
		PerPage:        perPage,
	})
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	ReturnJSON(w, &topPlaybooks, http.StatusOK)
}

func (h *PlaybookHandler) getTopPlaybooksForTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	teamID := vars["teamID"]
	userID := r.Header.Get("Mattermost-User-ID")
	params := r.URL.Query()
	timeRange := params.Get("time_range")
	if teamID == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotImplemented, "invalid team_id parameter", errors.New("teamID cannot be empty"))
		return
	}
	if !h.PermissionsCheck(w, c.logger, h.permissions.PlaybookList(userID, teamID)) {
		return
	}
	page, err := strconv.Atoi(params.Get("page"))
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error converting page parameter to integer", err)
		return
	}
	perPage, err := strconv.Atoi(params.Get("per_page"))
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error converting per_page parameter to integer", err)
		return
	}

	// setting startTime as per user's location
	user, err := h.pluginAPI.User.Get(userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to get user", err)
		return
	}
	timezone := user.GetTimezoneLocation()

	// get unix time for duration
	startTime, err := GetStartOfDayForTimeRange(timeRange, timezone)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "invalid time parameter", err)
		return
	}

	topPlaybooks, err := h.playbookService.GetTopPlaybooksForTeam(teamID, userID, &app.InsightsOpts{
		StartUnixMilli: model.GetMillisForTime(*startTime),
		Page:           page,
		PerPage:        perPage,
	})
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	ReturnJSON(w, &topPlaybooks, http.StatusOK)
}

// Copied from https://github.com/mattermost/mattermost/blob/e37459cd000bbcea6f09675285e2fe080bd52605/server/public/model/insights.go
const (
	TimeRangeToday string = "today"
	TimeRange7Day  string = "7_day"
	TimeRange28Day string = "28_day"
)

// GetStartOfDayForTimeRange gets the unix start time in milliseconds from the given time range.
// Time range can be one of: "today", "7_day", or "28_day".
//
// Copied from https://github.com/mattermost/mattermost/blob/e37459cd000bbcea6f09675285e2fe080bd52605/server/public/model/insights.go
func GetStartOfDayForTimeRange(timeRange string, location *time.Location) (*time.Time, error) {
	now := time.Now().In(location)
	resultTime := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	switch timeRange {
	case TimeRangeToday:
	case TimeRange7Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-144))
	case TimeRange28Day:
		resultTime = resultTime.Add(time.Hour * time.Duration(-648))
	default:
		return nil, errors.New("Invalid time range")
	}
	return &resultTime, nil
}

func (h *PlaybookHandler) getPlaybookPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	logger := c.logger.WithField("playbook_id", playbookID)

	if !h.licenseChecker.PlaybookAttributesAllowed() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.permissions.PlaybookView(userID, playbookID); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "not authorized", err)
		return
	}

	// Parse optional updated_since query parameter
	var updatedSince int64 = 0
	if updatedSinceStr := r.URL.Query().Get("updated_since"); updatedSinceStr != "" {
		parsed, err := strconv.ParseInt(updatedSinceStr, 10, 64)
		if err != nil {
			h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "invalid updated_since parameter", err)
			return
		}
		updatedSince = parsed
	}

	propertyFields, err := h.propertyService.GetPropertyFieldsSince(playbookID, updatedSince)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	ReturnJSON(w, propertyFields, http.StatusOK)
}

func (h *PlaybookHandler) createPlaybookPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	logger := c.logger.WithField("playbook_id", playbookID)

	if !h.licenseChecker.PlaybookAttributesAllowed() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if err := h.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "not authorized", err)
		return
	}

	if currentPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "archived playbooks cannot be modified", errors.New("archived playbooks cannot be modified"))
		return
	}

	var request PropertyFieldRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	propertyField := convertRequestToPropertyField(request)

	createdField, err := h.playbookService.CreatePropertyField(playbookID, *propertyField)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	ReturnJSON(w, createdField, http.StatusCreated)
}

func (h *PlaybookHandler) updatePlaybookPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	fieldID := vars["fieldID"]
	logger := c.logger.WithFields(logrus.Fields{"playbook_id": playbookID, "field_id": fieldID})

	if !h.licenseChecker.PlaybookAttributesAllowed() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if err := h.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "not authorized", err)
		return
	}

	if currentPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "archived playbooks cannot be modified", errors.New("archived playbooks cannot be modified"))
		return
	}

	existingField, err := h.propertyService.GetPropertyField(fieldID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if existingField.TargetID != playbookID {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "property field does not belong to the specified playbook", errors.New("property field does not belong to the specified playbook"))
		return
	}

	var request PropertyFieldRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "unable to decode request body", err)
		return
	}

	propertyField := convertRequestToPropertyField(request)
	propertyField.ID = fieldID

	updatedField, err := h.playbookService.UpdatePropertyField(playbookID, *propertyField)
	if err != nil {
		if errors.Is(err, app.ErrPropertyOptionsInUse) {
			h.HandleErrorWithCode(w, logger, http.StatusConflict, err.Error(), err)
			return
		}
		if errors.Is(err, app.ErrPropertyFieldTypeChangeNotAllowed) {
			h.HandleErrorWithCode(w, logger, http.StatusConflict, err.Error(), err)
			return
		}
		h.HandleError(w, logger, err)
		return
	}

	ReturnJSON(w, updatedField, http.StatusOK)
}

func (h *PlaybookHandler) deletePlaybookPropertyField(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	fieldID := vars["fieldID"]
	logger := c.logger.WithFields(logrus.Fields{"playbook_id": playbookID, "field_id": fieldID})

	if !h.licenseChecker.PlaybookAttributesAllowed() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if err := h.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "not authorized", err)
		return
	}

	if currentPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "archived playbooks cannot be modified", errors.New("archived playbooks cannot be modified"))
		return
	}

	existingField, err := h.propertyService.GetPropertyField(fieldID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if existingField.TargetID != playbookID {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "property field does not belong to the specified playbook", errors.New("property field does not belong to the specified playbook"))
		return
	}

	if err := h.playbookService.DeletePropertyField(playbookID, fieldID); err != nil {
		if errors.Is(err, app.ErrPropertyFieldInUse) {
			h.HandleErrorWithCode(w, logger, http.StatusConflict, err.Error(), err)
			return
		}
		h.HandleError(w, logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type ReorderPropertyFieldsRequest struct {
	FieldID        string `json:"field_id"`
	TargetPosition int    `json:"target_position"`
}

func (h *PlaybookHandler) reorderPlaybookPropertyFields(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	logger := c.logger.WithFields(logrus.Fields{"playbook_id": playbookID})

	if !h.licenseChecker.PlaybookAttributesAllowed() {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "playbook attributes feature is not covered by current server license", app.ErrLicensedFeature)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	currentPlaybook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	if err := h.permissions.PlaybookManageProperties(userID, currentPlaybook); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "not authorized", err)
		return
	}

	if currentPlaybook.DeleteAt != 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "archived playbooks cannot be modified", errors.New("archived playbooks cannot be modified"))
		return
	}

	var request ReorderPropertyFieldsRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "unable to decode request", err)
		return
	}

	if request.FieldID == "" {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "field_id is required", errors.New("missing required field"))
		return
	}

	if request.TargetPosition < 0 {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "target_position must be non-negative", errors.New("invalid target position"))
		return
	}

	reorderedFields, err := h.playbookService.ReorderPropertyFields(playbookID, request.FieldID, request.TargetPosition)
	if err != nil {
		h.HandleError(w, logger, err)
		return
	}

	ReturnJSON(w, reorderedFields, http.StatusOK)
}

func convertRequestToPropertyField(request PropertyFieldRequest) *app.PropertyField {
	propertyField := &app.PropertyField{
		PropertyField: model.PropertyField{
			Name: request.Name,
			Type: model.PropertyFieldType(request.Type),
		},
	}

	if request.Attrs != nil {
		attrs := app.Attrs{
			Visibility: request.Attrs.Visibility,
			SortOrder:  request.Attrs.SortOrder,
			ParentID:   request.Attrs.ParentID,
			ValueType:  request.Attrs.ValueType,
		}

		if request.Attrs.Visibility == "" {
			attrs.Visibility = app.PropertyFieldVisibilityDefault
		}

		if request.Attrs.Options != nil {
			options := make(model.PropertyOptions[*model.PluginPropertyOption], 0, len(request.Attrs.Options))
			for _, opt := range request.Attrs.Options {
				var id string
				if opt.ID != nil {
					id = *opt.ID
				}
				option := model.NewPluginPropertyOption(id, opt.Name)
				if opt.Color != nil {
					option.SetValue("color", *opt.Color)
				}
				options = append(options, option)
			}
			attrs.Options = options
		}

		propertyField.Attrs = attrs
	} else {
		propertyField.Attrs = app.Attrs{
			Visibility: app.PropertyFieldVisibilityDefault,
		}
	}

	return propertyField
}
