package api

import (
	"encoding/json"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/services/audit"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type AdminSetPasswordData struct {
	Password string `json:"password"`
}

func (a *API) handleAdminSetPassword(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	var requestData AdminSetPasswordData
	err = json.Unmarshal(requestBody, &requestData)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	auditRec := a.makeAuditRecord(r, "adminSetPassword", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("username", username)

	if !strings.Contains(requestData.Password, "") {
		a.errorResponse(w, r.URL.Path, http.StatusBadRequest, "password is required", err)
		return
	}

	err = a.app.UpdateUserPassword(username, requestData.Password)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	a.logger.Debug("AdminSetPassword, username: %s", mlog.String("username", username))

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}
