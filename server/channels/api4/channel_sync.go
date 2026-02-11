package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitChannelSync() {
	api.BaseRoutes.ChannelSync.Handle("/layout", api.APISessionRequired(getChannelSyncLayout)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelSync.Handle("/layout", api.APISessionRequired(saveChannelSyncLayout)).Methods(http.MethodPut)
	api.BaseRoutes.ChannelSync.Handle("/layout", api.APISessionRequired(deleteChannelSyncLayout)).Methods(http.MethodDelete)
	api.BaseRoutes.ChannelSync.Handle("/state", api.APISessionRequired(getChannelSyncState)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelSync.Handle("/channels", api.APISessionRequired(getChannelSyncEditorChannels)).Methods(http.MethodGet)
	api.BaseRoutes.ChannelSync.Handle("/dismiss", api.APISessionRequired(dismissQuickJoinChannel)).Methods(http.MethodPost)
	api.BaseRoutes.ChannelSyncGlobal.Handle("/should_sync", api.APISessionRequired(shouldSyncUser)).Methods(http.MethodGet)
}

// GET /api/v4/teams/{team_id}/channel_sync/layout
func getChannelSyncLayout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	layout, appErr := c.App.GetChannelSyncLayout(c.AppContext, c.Params.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if layout == nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if err := json.NewEncoder(w).Encode(layout); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

// PUT /api/v4/teams/{team_id}/channel_sync/layout
func saveChannelSyncLayout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	// Must be System Admin or Team Admin
	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageTeam)
			return
		}
	}

	var layout model.ChannelSyncLayout
	if err := json.NewDecoder(r.Body).Decode(&layout); err != nil {
		c.SetInvalidParamWithErr("layout", err)
		return
	}

	layout.TeamId = c.Params.TeamId

	saved, appErr := c.App.SaveChannelSyncLayout(c.AppContext, &layout, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(saved); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

// DELETE /api/v4/teams/{team_id}/channel_sync/layout
func deleteChannelSyncLayout(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	if appErr := c.App.DeleteChannelSyncLayout(c.AppContext, c.Params.TeamId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// GET /api/v4/teams/{team_id}/channel_sync/state
func getChannelSyncState(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	state, appErr := c.App.GetSyncedCategoriesForUser(c.AppContext, c.AppContext.Session().UserId, c.Params.TeamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(state); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

// GET /api/v4/teams/{team_id}/channel_sync/channels
func getChannelSyncEditorChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	isSystemAdmin := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !isSystemAdmin && !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return
	}

	channels, appErr := c.App.GetAllChannelsForLayoutEditor(c.AppContext, c.AppContext.Session().UserId, c.Params.TeamId, isSystemAdmin)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if err := json.NewEncoder(w).Encode(channels); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}

// POST /api/v4/teams/{team_id}/channel_sync/dismiss
func dismissQuickJoinChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), c.Params.TeamId, model.PermissionViewTeam) {
		c.SetPermissionError(model.PermissionViewTeam)
		return
	}

	var body struct {
		ChannelId string `json:"channel_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		c.SetInvalidParamWithErr("channel_id", err)
		return
	}
	if !model.IsValidId(body.ChannelId) {
		c.SetInvalidParam("channel_id")
		return
	}

	if appErr := c.App.DismissQuickJoinChannel(c.AppContext, c.AppContext.Session().UserId, body.ChannelId, c.Params.TeamId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

// GET /api/v4/channel_sync/should_sync
func shouldSyncUser(c *Context, w http.ResponseWriter, r *http.Request) {
	teamId := r.URL.Query().Get("team_id")
	if !model.IsValidId(teamId) {
		c.SetInvalidParam("team_id")
		return
	}

	shouldSync, appErr := c.App.ShouldSyncUser(c.AppContext, c.AppContext.Session().UserId, teamId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	resp := map[string]bool{"should_sync": shouldSync}
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		c.Logger.Warn("Error encoding response", mlog.Err(err))
	}
}
