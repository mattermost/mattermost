// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/client"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/bot"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/config"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/playbooks"
)

// PlaybookRunHandler is the API handler.
type PlaybookRunHandler struct {
	*ErrorHandler
	config             config.Service
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	permissions        *app.PermissionsService
	licenseChecker     app.LicenseChecker
	api                playbooks.ServicesAPI
	poster             bot.Poster
}

// NewPlaybookRunHandler Creates a new Plugin API handler.
func NewPlaybookRunHandler(
	router *mux.Router,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	permissions *app.PermissionsService,
	licenseChecker app.LicenseChecker,
	api playbooks.ServicesAPI,
	poster bot.Poster,
	configService config.Service,
) *PlaybookRunHandler {
	handler := &PlaybookRunHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		api:                api,
		poster:             poster,
		config:             configService,
		permissions:        permissions,
		licenseChecker:     licenseChecker,
	}

	playbookRunsRouter := router.PathPrefix("/runs").Subrouter()
	playbookRunsRouter.HandleFunc("", withContext(handler.getPlaybookRuns)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("", withContext(handler.createPlaybookRunFromPost)).Methods(http.MethodPost)

	playbookRunsRouter.HandleFunc("/dialog", withContext(handler.createPlaybookRunFromDialog)).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/add-to-timeline-dialog", withContext(handler.addToTimelineDialog)).Methods(http.MethodPost)
	playbookRunsRouter.HandleFunc("/owners", withContext(handler.getOwners)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/channels", withContext(handler.getChannels)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete", withContext(handler.getChecklistAutocomplete)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/checklist-autocomplete-item", withContext(handler.getChecklistAutocompleteItem)).Methods(http.MethodGet)
	playbookRunsRouter.HandleFunc("/runs-autocomplete", withContext(handler.getChannelRunsAutocomplete)).Methods(http.MethodGet)

	playbookRunRouter := playbookRunsRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	playbookRunRouter.HandleFunc("", withContext(handler.getPlaybookRun)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/metadata", withContext(handler.getPlaybookRunMetadata)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/status-updates", withContext(handler.getStatusUpdates)).Methods(http.MethodGet)
	playbookRunRouter.HandleFunc("/request-update", withContext(handler.requestUpdate)).Methods(http.MethodPost)
	playbookRunRouter.HandleFunc("/request-join-channel", withContext(handler.requestJoinChannel)).Methods(http.MethodPost)

	playbookRunRouterAuthorized := playbookRunRouter.PathPrefix("").Subrouter()
	playbookRunRouterAuthorized.Use(handler.checkEditPermissions)
	playbookRunRouterAuthorized.HandleFunc("", withContext(handler.updatePlaybookRun)).Methods(http.MethodPatch)
	playbookRunRouterAuthorized.HandleFunc("/owner", withContext(handler.changeOwner)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/status", withContext(handler.status)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/finish", withContext(handler.finish)).Methods(http.MethodPut)
	playbookRunRouterAuthorized.HandleFunc("/finish-dialog", withContext(handler.finishDialog)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/update-status-dialog", withContext(handler.updateStatusDialog)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder/button-update", withContext(handler.reminderButtonUpdate)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/reminder", withContext(handler.reminderReset)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/no-retrospective-button", withContext(handler.noRetrospectiveButton)).Methods(http.MethodPost)
	playbookRunRouterAuthorized.HandleFunc("/timeline/{eventID:[A-Za-z0-9]+}", withContext(handler.removeTimelineEvent)).Methods(http.MethodDelete)
	playbookRunRouterAuthorized.HandleFunc("/restore", withContext(handler.restore)).Methods(http.MethodPut)
	playbookRunRouterAuthorized.HandleFunc("/status-update-enabled", withContext(handler.toggleStatusUpdates)).Methods(http.MethodPut)

	channelRouter := playbookRunsRouter.PathPrefix("/channel/{channel_id:[A-Za-z0-9]+}").Subrouter()
	channelRouter.HandleFunc("", withContext(handler.getPlaybookRunByChannel)).Methods(http.MethodGet)
	channelRouter.HandleFunc("/runs", withContext(handler.getPlaybookRunsForChannelByUser)).Methods(http.MethodGet)

	checklistsRouter := playbookRunRouterAuthorized.PathPrefix("/checklists").Subrouter()
	checklistsRouter.HandleFunc("", withContext(handler.addChecklist)).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move", withContext(handler.moveChecklist)).Methods(http.MethodPost)
	checklistsRouter.HandleFunc("/move-item", withContext(handler.moveChecklistItem)).Methods(http.MethodPost)

	checklistRouter := checklistsRouter.PathPrefix("/{checklist:[0-9]+}").Subrouter()
	checklistRouter.HandleFunc("", withContext(handler.removeChecklist)).Methods(http.MethodDelete)
	checklistRouter.HandleFunc("/add", withContext(handler.addChecklistItem)).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/rename", withContext(handler.renameChecklist)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/add-dialog", withContext(handler.addChecklistItemDialog)).Methods(http.MethodPost)
	checklistRouter.HandleFunc("/skip", withContext(handler.checklistSkip)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/restore", withContext(handler.checklistRestore)).Methods(http.MethodPut)
	checklistRouter.HandleFunc("/duplicate", withContext(handler.duplicateChecklist)).Methods(http.MethodPost)

	checklistItem := checklistRouter.PathPrefix("/item/{item:[0-9]+}").Subrouter()
	checklistItem.HandleFunc("", withContext(handler.itemDelete)).Methods(http.MethodDelete)
	checklistItem.HandleFunc("", withContext(handler.itemEdit)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/skip", withContext(handler.itemSkip)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/restore", withContext(handler.itemRestore)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/state", withContext(handler.itemSetState)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/assignee", withContext(handler.itemSetAssignee)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/command", withContext(handler.itemSetCommand)).Methods(http.MethodPut)
	checklistItem.HandleFunc("/run", withContext(handler.itemRun)).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duplicate", withContext(handler.itemDuplicate)).Methods(http.MethodPost)
	checklistItem.HandleFunc("/duedate", withContext(handler.itemSetDueDate)).Methods(http.MethodPut)

	retrospectiveRouter := playbookRunRouterAuthorized.PathPrefix("/retrospective").Subrouter()
	retrospectiveRouter.HandleFunc("", withContext(handler.updateRetrospective)).Methods(http.MethodPost)
	retrospectiveRouter.HandleFunc("/publish", withContext(handler.publishRetrospective)).Methods(http.MethodPost)

	followersRouter := playbookRunRouter.PathPrefix("/followers").Subrouter()
	followersRouter.HandleFunc("", withContext(handler.follow)).Methods(http.MethodPut)
	followersRouter.HandleFunc("", withContext(handler.unfollow)).Methods(http.MethodDelete)
	followersRouter.HandleFunc("", withContext(handler.getFollowers)).Methods(http.MethodGet)

	return handler
}

func (h *PlaybookRunHandler) checkEditPermissions(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := getLogger(r)
		vars := mux.Vars(r)
		userID := r.Header.Get("Mattermost-User-ID")

		playbookRun, err := h.playbookRunService.GetPlaybookRun(vars["id"])
		if err != nil {
			h.HandleError(w, logger, err)
			return
		}

		if !h.PermissionsCheck(w, logger, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
			return
		}

		next.ServeHTTP(w, r)
	})
}

// createPlaybookRunFromPost handles the POST /runs endpoint
func (h *PlaybookRunHandler) createPlaybookRunFromPost(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var playbookRunCreateOptions client.PlaybookRunCreateOptions
	if err := json.NewDecoder(r.Body).Decode(&playbookRunCreateOptions); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode playbook run create options", err)
		return
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: playbookRunCreateOptions.OwnerUserID,
			TeamID:      playbookRunCreateOptions.TeamID,
			ChannelID:   playbookRunCreateOptions.ChannelID,
			Name:        playbookRunCreateOptions.Name,
			Summary:     playbookRunCreateOptions.Description,
			PostID:      playbookRunCreateOptions.PostID,
			PlaybookID:  playbookRunCreateOptions.PlaybookID,
			Type:        playbookRunCreateOptions.Type,
		},
		userID,
		playbookRunCreateOptions.CreatePublicRun,
		app.RunSourcePost,
	)
	if errors.Is(err, app.ErrNoPermissions) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "unable to create playbook run", err)
		return
	}

	if errors.Is(err, app.ErrMalformedPlaybookRun) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to create playbook run", err)
		return
	}

	if err != nil {
		h.HandleError(w, c.logger, errors.Wrapf(err, "unable to create playbook run"))
		return
	}

	h.poster.PublishWebsocketEventToUser(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
		"playbook_run": playbookRun,
	}, userID)

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	ReturnJSON(w, &playbookRun, http.StatusCreated)
}

// Note that this currently does nothing. This is temporary given the removal of stages. Will be used by status.
func (h *PlaybookRunHandler) updatePlaybookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]

	oldPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	var updates app.UpdateOptions
	if err = json.NewDecoder(r.Body).Decode(&updates); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	updatedPlaybookRun := oldPlaybookRun

	ReturnJSON(w, updatedPlaybookRun, http.StatusOK)
}

// createPlaybookRunFromDialog handles the interactive dialog submission when a user presses confirm on
// the create playbook run dialog.
func (h *PlaybookRunHandler) createPlaybookRunFromDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var state app.DialogState
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	var playbookID, name string
	if rawPlaybookID, ok := request.Submission[app.DialogFieldPlaybookIDKey].(string); ok {
		playbookID = rawPlaybookID
	}
	if rawName, ok := request.Submission[app.DialogFieldNameKey].(string); ok {
		name = rawName
	}

	playbook, err := h.playbookService.Get(playbookID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to get playbook", err)
		return
	}

	playbookRun, err := h.createPlaybookRun(
		app.PlaybookRun{
			OwnerUserID: request.UserId,
			TeamID:      request.TeamId,
			ChannelID:   playbook.GetRunChannelID(),
			Name:        name,
			PostID:      state.PostID,
			PlaybookID:  playbookID,
			Type:        app.RunTypePlaybook,
		},
		request.UserId,
		nil,
		app.RunSourceDialog,
	)
	if err != nil {
		if errors.Is(err, app.ErrMalformedPlaybookRun) {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to create playbook run", err)
			return
		}

		if errors.Is(err, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "not authorized to make runs from this playbook", err)
			return
		}

		var msg string

		if errors.Is(err, app.ErrChannelDisplayNameInvalid) {
			msg = "The name is invalid or too long. Please use a valid name with fewer than 64 characters."
		}

		if msg != "" {
			resp := &model.SubmitDialogResponse{
				Errors: map[string]string{
					app.DialogFieldNameKey: msg,
				},
			}
			respBytes, _ := json.Marshal(resp)
			_, _ = w.Write(respBytes)
			return
		}

		h.HandleError(w, c.logger, err)
		return
	}

	channel, err := h.api.GetChannelByID(playbookRun.ChannelID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to get new channel", err)
		return
	}

	// Delay sending the websocket message because the front end may try to change to the newly created
	// channel, and the server may respond with a "channel not found" error. This happens in e2e tests,
	// and possibly in the wild.
	go func() {
		time.Sleep(1 * time.Second) // arbitrary 1 second magic number

		h.poster.PublishWebsocketEventToUser(app.PlaybookRunCreatedWSEvent, map[string]interface{}{
			"client_id":    state.ClientID,
			"playbook_run": playbookRun,
			"channel_name": channel.Name,
		}, request.UserId)
	}()

	if err := h.postPlaybookRunCreatedMessage(playbookRun, request.ChannelId); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.Header().Add("Location", fmt.Sprintf("/api/v0/runs/%s", playbookRun.ID))
	w.WriteHeader(http.StatusCreated)
}

// addToTimelineDialog handles the interactive dialog submission when a user clicks the
// corresponding post action.
func (h *PlaybookRunHandler) addToTimelineDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.TimelineAllowed() {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "timeline feature is not covered by current server license", nil)
		return
	}

	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var playbookRunID, summary string
	if rawPlaybookRunID, ok := request.Submission[app.DialogFieldPlaybookRunKey].(string); ok {
		playbookRunID = rawPlaybookRunID
	}
	if rawSummary, ok := request.Submission[app.DialogFieldSummary].(string); ok {
		summary = rawSummary
	}

	playbookRun, incErr := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if incErr != nil {
		h.HandleError(w, c.logger, incErr)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
		return
	}

	var state app.DialogStateAddToTimeline
	err = json.Unmarshal([]byte(request.State), &state)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal dialog state", err)
		return
	}

	if err = h.playbookRunService.AddPostToTimeline(playbookRunID, userID, state.PostID, summary); err != nil {
		h.HandleError(w, c.logger, errors.Wrap(err, "failed to add post to timeline"))
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) createPlaybookRun(playbookRun app.PlaybookRun, userID string, createPublicRun *bool, source string) (*app.PlaybookRun, error) {
	// Validate initial data
	if playbookRun.ID != "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run already has an id")
	}

	if playbookRun.CreateAt != 0 {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook run channel already has created at date")
	}

	if playbookRun.TeamID == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "must provide team or channel to create playbook run")
	}

	if playbookRun.OwnerUserID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing owner user id of playbook run")
	}

	if strings.TrimSpace(playbookRun.Name) == "" && playbookRun.ChannelID == "" {
		return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "missing name of playbook run")
	}

	// Retrieve channel if needed and validate it
	// If a channel is specified, ensure it's from the given team (if one provided), or
	// just grab the team for that channel.
	var channel *model.Channel
	var err error
	if playbookRun.ChannelID != "" {
		channel, err = h.api.GetChannelByID(playbookRun.ChannelID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get channel")
		}

		if playbookRun.TeamID == "" {
			playbookRun.TeamID = channel.TeamId
		} else if channel.TeamId != playbookRun.TeamID {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "channel not in given team")
		}
	}

	// Copy data from playbook if needed
	public := true
	if createPublicRun != nil {
		public = *createPublicRun
	}

	var playbook *app.Playbook
	if playbookRun.PlaybookID != "" {
		var pb app.Playbook
		pb, err = h.playbookService.Get(playbookRun.PlaybookID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook")
		}
		playbook = &pb

		if playbook.DeleteAt != 0 {
			return nil, errors.New("playbook is archived, cannot create a new run using an archived playbook")
		}

		if err = h.permissions.RunCreate(userID, *playbook); err != nil {
			return nil, err
		}

		if source == "dialog" && playbook.ChannelMode == app.PlaybookRunLinkExistingChannel && playbookRun.ChannelID == "" {
			return nil, errors.Wrap(app.ErrMalformedPlaybookRun, "playbook is configured to be linked to existing channel but no channel is configured. Run can not be created from dialog")
		}

		if createPublicRun == nil {
			public = pb.CreatePublicPlaybookRun
		}

		playbookRun.SetChecklistFromPlaybook(*playbook)
		playbookRun.SetConfigurationFromPlaybook(*playbook, source)
	}

	// Check the permissions on the channel: the user must be able to create it or,
	// if one's already provided, they need to be able to manage it.
	if channel == nil {
		permission := model.PermissionCreatePrivateChannel
		permissionMessage := "You are not able to create a private channel"
		if public {
			permission = model.PermissionCreatePublicChannel
			permissionMessage = "You are not able to create a public channel"
		}
		if !h.api.HasPermissionToTeam(userID, playbookRun.TeamID, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	} else {
		permission := model.PermissionManagePublicChannelProperties
		permissionMessage := "You are not able to manage public channel properties"
		if channel.Type == model.ChannelTypePrivate {
			permission = model.PermissionManagePrivateChannelProperties
			permissionMessage = "You are not able to manage private channel properties"
		} else if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
			permission = model.PermissionReadChannel
			permissionMessage = "You do not have access to this channel"
		}

		if !h.api.HasPermissionToChannel(userID, channel.Id, permission) {
			return nil, errors.Wrap(app.ErrNoPermissions, permissionMessage)
		}
	}

	// Check the permissions on the provided post: the user must have access to the post's channel
	if playbookRun.PostID != "" {
		var post *model.Post
		post, err = h.api.GetPost(playbookRun.PostID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get playbook run original post")
		}
		if !h.api.HasPermissionToChannel(userID, post.ChannelId, model.PermissionReadChannel) {
			return nil, errors.New("user does not have access to the channel containing the playbook run's original post")
		}
	}

	playbookRunReturned, err := h.playbookRunService.CreatePlaybookRun(&playbookRun, playbook, userID, public)
	if err != nil {
		return nil, err
	}

	// force database retrieval to ensure all data is processed correctly (i.e participantIds)
	return h.playbookRunService.GetPlaybookRun(playbookRunReturned.ID)

}

func (h *PlaybookRunHandler) getRequesterInfo(userID string) (app.RequesterInfo, error) {
	return app.GetRequesterInfo(userID, h.api)
}

// getPlaybookRuns handles the GET /runs endpoint.
func (h *PlaybookRunHandler) getPlaybookRuns(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	results, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, results, http.StatusOK)
}

// getPlaybookRun handles the /runs/{id} endpoint.
func (h *PlaybookRunHandler) getPlaybookRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRunToGet, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, playbookRunToGet, http.StatusOK)
}

// getPlaybookRunMetadata handles the /runs/{id}/metadata endpoint.
func (h *PlaybookRunHandler) getPlaybookRunMetadata(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	playbookRunMetadata, err := h.playbookRunService.GetPlaybookRunMetadata(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, playbookRunMetadata, http.StatusOK)
}

// getPlaybookRunByChannel handles the /runs/channel/{channel_id} endpoint.
// Notice that it returns both playbook runs as well as channel checklists
func (h *PlaybookRunHandler) getPlaybookRunByChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	// get playbook runs for the specific channel and user
	playbookRunsResult, err := h.playbookRunService.GetPlaybookRuns(
		app.RequesterInfo{
			UserID: userID,
		},

		app.PlaybookRunFilterOptions{
			ChannelID: channelID,
			Page:      0,
			PerPage:   2,
		},
	)

	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
	playbookRuns := playbookRunsResult.Items
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	if len(playbookRuns) > 1 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "multiple runs in the channel", nil)
		return
	}

	playbookRun := playbookRuns[0]
	ReturnJSON(w, &playbookRun, http.StatusOK)
}

// getOwners handles the /runs/owners api endpoint.
func (h *PlaybookRunHandler) getOwners(c *Context, w http.ResponseWriter, r *http.Request) {
	teamID := r.URL.Query().Get("team_id")

	userID := r.Header.Get("Mattermost-User-ID")
	options := app.PlaybookRunFilterOptions{
		TeamID: teamID,
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	owners, err := h.playbookRunService.GetOwners(requesterInfo, options)
	if err != nil {
		h.HandleError(w, c.logger, errors.Wrapf(err, "failed to get owners"))
		return
	}

	if owners == nil {
		owners = []app.OwnerInfo{}
	}

	ReturnJSON(w, owners, http.StatusOK)
}

func (h *PlaybookRunHandler) getChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "Bad parameter", err)
		return
	}

	requesterInfo, err := h.getRequesterInfo(userID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	playbookRuns, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, *filterOptions)
	if err != nil {
		h.HandleError(w, c.logger, errors.Wrapf(err, "failed to get playbookRuns"))
		return
	}

	channelIds := make([]string, 0, len(playbookRuns.Items))
	for _, playbookRun := range playbookRuns.Items {
		channelIds = append(channelIds, playbookRun.ChannelID)
	}

	ReturnJSON(w, channelIds, http.StatusOK)
}

// changeOwner handles the /runs/{id}/change-owner api endpoint.
func (h *PlaybookRunHandler) changeOwner(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		OwnerID string `json:"owner_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "could not decode request body", err)
		return
	}

	if err := h.playbookRunService.ChangeOwner(vars["id"], userID, params.OwnerID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

// updateStatusD handles the POST /runs/{id}/status endpoint, user has edit permissions
func (h *PlaybookRunHandler) status(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var options app.StatusUpdateOptions
	if err := json.NewDecoder(r.Body).Decode(&options); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode body into StatusUpdateOptions", err)
		return
	}

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options); internalErr != nil {
		if errors.Is(internalErr, app.ErrNoPermissions) {
			h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, publicMsg, internalErr)
		} else {
			h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, publicMsg, internalErr)
		}
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// updateStatus returns a publicMessage and an internal error
func (h *PlaybookRunHandler) updateStatus(playbookRunID, userID string, options app.StatusUpdateOptions) (string, error) {

	// user must be a participant to be able to post an update
	if err := h.permissions.RunManageProperties(userID, playbookRunID); err != nil {
		return "Not authorized", err
	}

	options.Message = strings.TrimSpace(options.Message)
	if options.Message == "" {
		return "message must not be empty", errors.New("message field empty")
	}

	if options.Reminder <= 0 && !options.FinishRun {
		return "the reminder must be set and not 0", errors.New("reminder was 0")
	}
	if options.Reminder < 0 || options.FinishRun {
		options.Reminder = 0
	}
	options.Reminder = options.Reminder * time.Second

	if err := h.playbookRunService.UpdateStatus(playbookRunID, userID, options); err != nil {
		return "An internal error has occurred. Check app server logs for details.", err
	}

	if options.FinishRun {
		if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
			return "An internal error has occurred. Check app server logs for details.", err
		}
	}

	return "", nil
}

// updateStatusD handles the POST /runs/{id}/finish endpoint, user has edit permissions
func (h *PlaybookRunHandler) finish(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// getStatusUpdates handles the GET /runs/{id}/status endpoint
//
// Our goal is to deliver status updates to any user (when playbook is public) or
// any playbook member (when playbook is private). To do that we need to bypass the
// permissions system and avoid checking channel membership.
//
// This approach will be deprecated as a step towards channel-playbook decoupling.
func (h *PlaybookRunHandler) getStatusUpdates(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "not authorized to get status updates", nil)
		return
	}

	playbookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	posts := make([]*app.StatusPostComplete, 0)
	for _, p := range playbookRun.StatusPosts {
		post, err := h.api.GetPost(p.ID)
		if err != nil {
			c.logger.WithError(err).WithField("post_id", p.ID).Error("statusUpdates: can not retrieve post")
			continue
		}

		// Given the fact that we are bypassing some permissions,
		// an additional check is added to limit the risk
		if post.Type == "custom_run_update" {
			posts = append(posts, app.NewStatusPostComplete(post))
		}
	}

	// sort by creation date, so that the first element is the newest post
	sort.Slice(posts, func(i, j int) bool {
		return posts[i].CreateAt > posts[j].CreateAt
	})

	ReturnJSON(w, posts, http.StatusOK)
}

// restore "un-finishes" a playbook run
func (h *PlaybookRunHandler) restore(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestorePlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

// requestUpdate posts a status update request message in the run's channel
func (h *PlaybookRunHandler) requestUpdate(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "not authorized to post update request", nil)
		return
	}

	if err := h.playbookRunService.RequestUpdate(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
}

// requestJoinChannel posts a channel-join request message in the run's channel
func (h *PlaybookRunHandler) requestJoinChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	// user must be a participant to be able to request to join the channel
	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRunID)) {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "not authorized to request join channel", nil)
		return
	}

	if err := h.playbookRunService.RequestJoinChannel(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
}

// updateStatusDialog handles the POST /runs/{id}/finish-dialog endpoint, called when a
// user submits the Finish Run dialog.
func (h *PlaybookRunHandler) finishDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRun, incErr := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if incErr != nil {
		h.HandleError(w, c.logger, incErr)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRun.ID)) {
		return
	}

	if err := h.playbookRunService.FinishPlaybookRun(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}
}

func (h *PlaybookRunHandler) toggleStatusUpdates(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var payload struct {
		StatusEnabled bool `json:"status_enabled"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if err := h.playbookRunService.ToggleStatusUpdates(playbookRunID, userID, payload.StatusEnabled); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"success": true}, http.StatusOK)

}

// updateStatusDialog handles the POST /runs/{id}/update-status-dialog endpoint, called when a
// user submits the Update Status dialog.
func (h *PlaybookRunHandler) updateStatusDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var request *model.SubmitDialogRequest
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	var options app.StatusUpdateOptions
	if message, ok := request.Submission[app.DialogFieldMessageKey]; ok {
		options.Message = message.(string)
	}

	if reminderI, ok := request.Submission[app.DialogFieldReminderInSecondsKey]; ok {
		var reminder int
		reminder, err = strconv.Atoi(reminderI.(string))
		if err != nil {
			h.HandleError(w, c.logger, err)
			return
		}
		options.Reminder = time.Duration(reminder)
	}

	if finishB, ok := request.Submission[app.DialogFieldFinishRun]; ok {
		var finish bool
		if finish, ok = finishB.(bool); ok {
			options.FinishRun = finish
		}
	}

	if publicMsg, internalErr := h.updateStatus(playbookRunID, userID, options); internalErr != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, publicMsg, internalErr)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// reminderButtonUpdate handles the POST /runs/{id}/reminder/button-update endpoint, called when a
// user clicks on the reminder interactive button
func (h *PlaybookRunHandler) reminderButtonUpdate(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	var requestData *model.PostActionIntegrationRequest
	err := json.NewDecoder(r.Body).Decode(&requestData)
	if err != nil || requestData == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "missing request data", nil)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(requestData.UserId, playbookRunID)) {
		return
	}

	if err = h.playbookRunService.OpenUpdateStatusDialog(playbookRunID, requestData.UserId, requestData.TriggerId); err != nil {
		h.HandleError(w, c.logger, errors.New("reminderButtonUpdate failed to open update status dialog"))
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// reminderReset handles the POST /runs/{id}/reminder endpoint, called when a
// user clicks on the reminder custom_update_status time selector
func (h *PlaybookRunHandler) reminderReset(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	var payload struct {
		NewReminderSeconds int `json:"new_reminder_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if payload.NewReminderSeconds <= 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "new_reminder_seconds must be > 0", errors.New("new_reminder_seconds was <= 0"))
		return
	}

	storedPlaybookRun, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		err = errors.Wrapf(err, "reminderReset: no playbook run for path's playbookRunID: %s", playbookRunID)
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "no playbook run for path's playbookRunID", err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, storedPlaybookRun.ID)) {
		return
	}

	if err = h.playbookRunService.ResetReminder(playbookRunID, time.Duration(payload.NewReminderSeconds)*time.Second); err != nil {
		err = errors.Wrapf(err, "reminderReset: error setting new reminder for playbookRunID %s", playbookRunID)
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "error removing reminder post", err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) noRetrospectiveButton(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRunToCancelRetro, err := h.playbookRunService.GetPlaybookRun(playbookRunID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunManageProperties(userID, playbookRunToCancelRetro.ID)) {
		return
	}

	if err := h.playbookRunService.CancelRetrospective(playbookRunToCancelRetro.ID, userID); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to cancel retrospective", err)
		return
	}

	ReturnJSON(w, nil, http.StatusOK)
}

// removeTimelineEvent handles the DELETE /runs/{id}/timeline/{eventID} endpoint.
// User has been authenticated to edit the playbook run.
func (h *PlaybookRunHandler) removeTimelineEvent(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")
	eventID := vars["eventID"]

	if err := h.playbookRunService.RemoveTimelineEvent(id, userID, eventID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) getChecklistAutocompleteItem(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetChecklistItemAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getChecklistAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetChecklistAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getChannelRunsAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	channelID := query.Get("channel_id")
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}
	if len(playbookRuns) == 0 {
		h.HandleErrorWithCode(w, c.logger, http.StatusNotFound, "Not found",
			errors.Errorf("playbook run for channel id %s not found", channelID))
		return
	}

	data, err := h.playbookRunService.GetRunsAutocomplete(playbookRuns)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, data, http.StatusOK)
}

func (h *PlaybookRunHandler) getPlaybookRunsForChannelByUser(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	channelID := vars["channel_id"]
	userID := r.Header.Get("Mattermost-User-ID")

	playbookRuns, err := h.playbookRunService.GetPlaybookRunsForChannelByUser(channelID, userID)
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError,
			fmt.Sprintf("unable to retrieve runs for channel id %s", channelID), err)
		return
	}

	ReturnJSON(w, playbookRuns, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetState(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		NewState string `json:"new_state"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if !app.IsValidChecklistItemState(params.NewState) {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter new state", nil)
		return
	}

	if err := h.playbookRunService.ModifyCheckedState(id, userID, params.NewState, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetAssignee(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		AssigneeID string `json:"assignee_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetAssignee(id, userID, params.AssigneeID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetDueDate(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.licenseChecker.ChecklistItemDueDateAllowed() {
		h.HandleErrorWithCode(w, c.logger, http.StatusForbidden, "checklist item due date feature is not covered by current server license", nil)
		return
	}

	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		DueDate int64 `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetDueDate(id, userID, params.DueDate, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemSetCommand(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Command string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal", err)
		return
	}

	if err := h.playbookRunService.SetCommandToChecklistItem(id, userID, checklistNum, itemNum, params.Command); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	triggerID, err := h.playbookRunService.RunChecklistItemSlashCommand(playbookRunID, userID, checklistNum, itemNum)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, map[string]interface{}{"trigger_id": triggerID}, http.StatusOK)
}

func (h *PlaybookRunHandler) itemDuplicate(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.DuplicateChecklistItem(playbookRunID, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var checklist app.Checklist
	if err := json.NewDecoder(r.Body).Decode(&checklist); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode Checklist", err)
		return
	}

	checklist.Title = strings.TrimSpace(checklist.Title)
	if checklist.Title == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklist(id, userID, checklist); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) removeChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) duplicateChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.DuplicateChecklist(playbookRunID, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PlaybookRunHandler) addChecklistItem(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var checklistItem app.ChecklistItem
	if err := json.NewDecoder(r.Body).Decode(&checklistItem); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode ChecklistItem", err)
		return
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(id, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// addChecklistItemDialog handles the interactive dialog submission when a user clicks add new task
func (h *PlaybookRunHandler) addChecklistItemDialog(c *Context, w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}

	var request *model.SubmitDialogRequest
	err = json.NewDecoder(r.Body).Decode(&request)
	if err != nil || request == nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to decode SubmitDialogRequest", err)
		return
	}

	if userID != request.UserId {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "interactive dialog's userID must be the same as the requester's userID", nil)
		return
	}

	var name, description string
	if rawName, ok := request.Submission[app.DialogFieldItemNameKey].(string); ok {
		name = rawName
	}
	if rawDescription, ok := request.Submission[app.DialogFieldItemDescriptionKey].(string); ok {
		description = rawDescription
	}

	checklistItem := app.ChecklistItem{
		Title:       name,
		Description: description,
	}

	checklistItem.Title = strings.TrimSpace(checklistItem.Title)
	if checklistItem.Title == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist item title",
			errors.New("checklist item title must not be blank"))
		return
	}

	if err := h.playbookRunService.AddChecklistItem(playbookRunID, userID, checklistNum, checklistItem); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)

}

func (h *PlaybookRunHandler) itemDelete(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RemoveChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistSkip(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) checklistRestore(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklist(id, userID, checklistNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemSkip(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.SkipChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemRestore(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.RestoreChecklistItem(id, userID, checklistNum, itemNum); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PlaybookRunHandler) itemEdit(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	itemNum, err := strconv.Atoi(vars["item"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse item", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		Title       string `json:"title"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params state", err)
		return
	}

	if err := h.playbookRunService.EditChecklistItem(id, userID, checklistNum, itemNum, params.Title, params.Command, params.Description); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) renameChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	checklistNum, err := strconv.Atoi(vars["checklist"])
	if err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to parse checklist", err)
		return
	}
	userID := r.Header.Get("Mattermost-User-ID")

	var modificationParams struct {
		NewTitle string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&modificationParams); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal new title", err)
		return
	}

	if modificationParams.NewTitle == "" {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "bad parameter: checklist title",
			errors.New("checklist title must not be blank"))
		return
	}

	if err := h.playbookRunService.RenameChecklist(id, userID, checklistNum, modificationParams.NewTitle); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklist(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklist(id, userID, params.SourceChecklistIdx, params.DestChecklistIdx); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) moveChecklistItem(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var params struct {
		SourceChecklistIdx int `json:"source_checklist_idx"`
		SourceItemIdx      int `json:"source_item_idx"`
		DestChecklistIdx   int `json:"dest_checklist_idx"`
		DestItemIdx        int `json:"dest_item_idx"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "failed to unmarshal edit params", err)
		return
	}

	if err := h.playbookRunService.MoveChecklistItem(id, userID, params.SourceChecklistIdx, params.SourceItemIdx, params.DestChecklistIdx, params.DestItemIdx); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) postPlaybookRunCreatedMessage(playbookRun *app.PlaybookRun, channelID string) error {
	channel, err := h.api.GetChannelByID(playbookRun.ChannelID)
	if err != nil {
		return err
	}

	post := &model.Post{
		Message: fmt.Sprintf("Playbook run %s started in ~%s", playbookRun.Name, channel.Name),
	}
	h.poster.EphemeralPost(playbookRun.OwnerUserID, channelID, post)

	return nil
}

func (h *PlaybookRunHandler) updateRetrospective(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.UpdateRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to update retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) publishRetrospective(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookRunID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var retroUpdate app.RetrospectiveUpdate

	if err := json.NewDecoder(r.Body).Decode(&retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusBadRequest, "unable to decode payload", err)
		return
	}

	if err := h.playbookRunService.PublishRetrospective(playbookRunID, userID, retroUpdate); err != nil {
		h.HandleErrorWithCode(w, c.logger, http.StatusInternalServerError, "unable to publish retrospective", err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) follow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	if err := h.playbookRunService.Follow(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) unfollow(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if err := h.playbookRunService.Unfollow(playbookRunID, userID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PlaybookRunHandler) getFollowers(c *Context, w http.ResponseWriter, r *http.Request) {
	playbookRunID := mux.Vars(r)["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	if !h.PermissionsCheck(w, c.logger, h.permissions.RunView(userID, playbookRunID)) {
		return
	}

	var followers []string
	var err error
	if followers, err = h.playbookRunService.GetFollowers(playbookRunID); err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	ReturnJSON(w, followers, http.StatusOK)
}

// parsePlaybookRunsFilterOptions is only for parsing. Put validation logic in app.validateOptions.
func parsePlaybookRunsFilterOptions(u *url.URL, currentUserID string) (*app.PlaybookRunFilterOptions, error) {
	teamID := u.Query().Get("team_id")

	pageParam := u.Query().Get("page")
	if pageParam == "" {
		pageParam = "0"
	}
	page, err := strconv.Atoi(pageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'page'")
	}

	perPageParam := u.Query().Get("per_page")
	if perPageParam == "" {
		perPageParam = "0"
	}
	perPage, err := strconv.Atoi(perPageParam)
	if err != nil {
		return nil, errors.Wrapf(err, "bad parameter 'per_page'")
	}

	sort := u.Query().Get("sort")
	direction := u.Query().Get("direction")

	// Parse statuses= query string parameters as an array.
	statuses := u.Query()["statuses"]

	ownerID := u.Query().Get("owner_user_id")
	if ownerID == client.Me {
		ownerID = currentUserID
	}

	searchTerm := u.Query().Get("search_term")

	participantID := u.Query().Get("participant_id")
	if participantID == client.Me {
		participantID = currentUserID
	}

	participantOrFollowerID := u.Query().Get("participant_or_follower_id")
	if participantOrFollowerID == client.Me {
		participantOrFollowerID = currentUserID
	}

	playbookID := u.Query().Get("playbook_id")

	activeGTEParam := u.Query().Get("active_gte")
	if activeGTEParam == "" {
		activeGTEParam = "0"
	}
	activeGTE, _ := strconv.ParseInt(activeGTEParam, 10, 64)

	activeLTParam := u.Query().Get("active_lt")
	if activeLTParam == "" {
		activeLTParam = "0"
	}
	activeLT, _ := strconv.ParseInt(activeLTParam, 10, 64)

	startedGTEParam := u.Query().Get("started_gte")
	if startedGTEParam == "" {
		startedGTEParam = "0"
	}
	startedGTE, _ := strconv.ParseInt(startedGTEParam, 10, 64)

	startedLTParam := u.Query().Get("started_lt")
	if startedLTParam == "" {
		startedLTParam = "0"
	}
	startedLT, _ := strconv.ParseInt(startedLTParam, 10, 64)

	// Parse types= query string parameters as an array.
	types := u.Query()["types"]

	options := app.PlaybookRunFilterOptions{
		TeamID:                  teamID,
		Page:                    page,
		PerPage:                 perPage,
		Sort:                    app.SortField(sort),
		Direction:               app.SortDirection(direction),
		Statuses:                statuses,
		OwnerID:                 ownerID,
		SearchTerm:              searchTerm,
		ParticipantID:           participantID,
		ParticipantOrFollowerID: participantOrFollowerID,
		PlaybookID:              playbookID,
		ActiveGTE:               activeGTE,
		ActiveLT:                activeLT,
		StartedGTE:              startedGTE,
		StartedLT:               startedLT,
		Types:                   types,
	}

	options, err = options.Validate()
	if err != nil {
		return nil, err
	}

	return &options, nil
}
