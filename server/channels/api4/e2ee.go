package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (api *API) InitE2EE() {
	api.BaseRoutes.E2EE.Handle("/devices", api.APISessionRequired(registerE2EEDevice)).Methods(http.MethodPost)
	api.BaseRoutes.E2EEPreKeys.Handle("/rotate_spk", api.APISessionRequired(rotateSignedPreKey)).Methods(http.MethodPost)
	api.BaseRoutes.E2EEPreKeys.Handle("/replenish_opks", api.APISessionRequired(replenishOneTimePreKeys)).Methods(http.MethodPost)
	api.BaseRoutes.E2EEBundle.Handle("", api.APISessionRequired(getPreKeyBundle)).Methods(http.MethodGet)
}

func registerE2EEDevice(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.E2EERegisterDeviceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}
	userId := c.AppContext.Session().UserId
	resp, appErr := c.App.RegisterDeviceWithKeys(c.AppContext, userId, &req)
	if appErr != nil {
		c.Err = appErr
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(resp)
}

func rotateSignedPreKey(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.E2EERotateSPKRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}
	if req.DeviceId == 0 {
		c.SetInvalidParam("DeviceId")
		return
	}
	userId := c.AppContext.Session().UserId
	if appErr := c.App.RotateSignedPreKey(c.AppContext, userId, req.DeviceId, req.SignedPreKey); appErr != nil {
		c.Err = appErr
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func replenishOneTimePreKeys(c *Context, w http.ResponseWriter, r *http.Request) {
	var req model.E2EEReplenishOPKsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		c.SetInvalidParamWithErr("body", err)
		return
	}
	if req.DeviceId == 0 {
		c.SetInvalidParam("DeviceId")
		return
	}
	userId := c.AppContext.Session().UserId
	saved, appErr := c.App.ReplenishOneTimePreKeys(c.AppContext, userId, req.DeviceId, req.OneTimePreKeys)
	if appErr != nil {
		c.Err = appErr
		return
	}
	_ = json.NewEncoder(w).Encode(saved)
}

func getPreKeyBundle(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	recipient := c.Params.UserId
	resp, appErr := c.App.GetPreKeyBundle(c.AppContext, recipient)
	if appErr != nil {
		c.Err = appErr
		return
	}
	_ = json.NewEncoder(w).Encode(resp)
}
