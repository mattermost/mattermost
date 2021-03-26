package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/actionitem"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitActionItems() {
	api.BaseRoutes.ActionItems.Handle("/items", api.ApiSessionRequired(getActionItems)).Methods("GET")
	api.BaseRoutes.ActionItems.Handle("/counts", api.ApiSessionRequired(getActionItemCounts)).Methods("GET")
	api.BaseRoutes.ActionItems.Handle("/notify", api.ApiSessionRequired(notify)).Methods("PUT")
}

func getActionItems(c *Context, w http.ResponseWriter, r *http.Request) {
	actionItems, err := c.App.GetActionItemsForUser(c.App.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getActionItems", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(actionItems)
	if err != nil {
		c.Err = model.NewAppError("Api4.getActionItems", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func getActionItemCounts(c *Context, w http.ResponseWriter, r *http.Request) {
	counts, err := c.App.GetCountsForUser(c.App.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("Api4.getActionItemCounts", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	json, err := json.Marshal(counts)
	if err != nil {
		c.Err = model.NewAppError("Api4.getActionItemCounts", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func notify(c *Context, w http.ResponseWriter, r *http.Request) {
	var notification actionitem.ExternalNotification
	if err := json.NewDecoder(r.Body).Decode(&notification); err != nil {
		c.Err = model.NewAppError("Api4.notify", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := c.App.RecieveNotification(notification); err != nil {
		c.Err = model.NewAppError("Api4.notify", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
