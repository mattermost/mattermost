package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/actionitem"
	"github.com/mattermost/mattermost-server/v5/model"
)

type APIActionItemProvider struct {
	actionitem.Provider
	Types []actionitem.Type `json:"types"`
}

func (api *API) InitActionItems() {
	api.BaseRoutes.ActionItems.Handle("/items", api.ApiSessionRequired(getActionItems)).Methods("GET")
	api.BaseRoutes.ActionItems.Handle("/counts", api.ApiSessionRequired(getActionItemCounts)).Methods("GET")
	api.BaseRoutes.ActionItems.Handle("/notify", api.ApiSessionRequired(notify)).Methods("PUT")

	api.BaseRoutes.ActionItems.Handle("/registry", api.ApiSessionRequired(getRegistry)).Methods("GET")

	api.BaseRoutes.ActionItems.Handle("/providers", api.ApiSessionRequired(registerProvider)).Methods("POST")
	//api.BaseRoutes.ActionItems.Handle("/providers", api.ApiSessionRequired(unregister)).Methods("DELETE")

	api.BaseRoutes.ActionItems.Handle("/types", api.ApiSessionRequired(registerType)).Methods("POST")
	//api.BaseRoutes.ActionItems.Handle("/types", api.ApiSessionRequired(unregister)).Methods("DELETE")

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

func getRegistry(c *Context, w http.ResponseWriter, r *http.Request) {
	providers, err := c.App.GetActionItemProviders()
	if err != nil {
		c.Err = model.NewAppError("Api4.getRegistry", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	types, err := c.App.GetActionItemTypes()
	if err != nil {
		c.Err = model.NewAppError("Api4.getRegistry", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	result := make([]APIActionItemProvider, 0, len(providers))
	for _, provider := range providers {
		providerTypes := []actionitem.Type{}
		for _, t := range types {
			if t.ProviderName == provider.Name {
				providerTypes = append(providerTypes, t)
			}
		}
		result = append(result, APIActionItemProvider{
			Provider: provider,
			Types:    providerTypes,
		})
	}

	json, err := json.Marshal(result)
	if err != nil {
		c.Err = model.NewAppError("Api4.getRegistry", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(json)
}

func registerProvider(c *Context, w http.ResponseWriter, r *http.Request) {
	var item actionitem.Provider
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		c.Err = model.NewAppError("Api4.registerProvider", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := c.App.RegisterActionItemProvider(item); err != nil {
		c.Err = model.NewAppError("Api4.registerProvider", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func registerType(c *Context, w http.ResponseWriter, r *http.Request) {
	var item actionitem.Type
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		c.Err = model.NewAppError("Api4.registerType", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := c.App.RegisterActionItemType(item); err != nil {
		c.Err = model.NewAppError("Api4.registerType", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
