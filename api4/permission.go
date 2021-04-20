package api4

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitPermissions() {
	api.BaseRoutes.Permissions.Handle("/ancillary_permissions", api.ApiSessionRequired(getAncillaryPermissions)).Methods("GET")
}

func getAncillaryPermissions(c *Context, w http.ResponseWriter, r *http.Request) {
	keys, ok := r.URL.Query()["subsection_permissions"]

	if !ok || len(keys[0]) < 1 {
		c.SetInvalidUrlParam("subsection_permissions")
		return
	}

	permissions := strings.Split(keys[0], ",")
	ancillaryPermissions := model.AddAncillaryPermissions(permissions)
	b, err := json.Marshal(ancillaryPermissions)
	if err != nil {
		c.SetJSONEncodingError()
		return
	}
	w.Write(b)
}
