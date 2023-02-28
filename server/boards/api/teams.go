package api

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/services/audit"
	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

func (a *API) registerTeamsRoutes(r *mux.Router) {
	// Team APIs
	r.HandleFunc("/teams", a.sessionRequired(a.handleGetTeams)).Methods("GET")
	r.HandleFunc("/teams/{teamID}", a.sessionRequired(a.handleGetTeam)).Methods("GET")
	r.HandleFunc("/teams/{teamID}/users", a.sessionRequired(a.handleGetTeamUsers)).Methods("GET")
	r.HandleFunc("/teams/{teamID}/users", a.sessionRequired(a.handleGetTeamUsersByID)).Methods("POST")
	r.HandleFunc("/teams/{teamID}/archive/export", a.sessionRequired(a.handleArchiveExportTeam)).Methods("GET")
}

func (a *API) handleGetTeams(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /teams getTeams
	//
	// Returns information of all the teams
	//
	// ---
	// produces:
	// - application/json
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/Team"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	userID := getUserID(r)

	teams, err := a.app.GetTeamsForUser(userID)
	if err != nil {
		a.errorResponse(w, r, err)
	}

	auditRec := a.makeAuditRecord(r, "getTeams", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("teamCount", len(teams))

	data, err := json.Marshal(teams)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handleGetTeam(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /teams/{teamID} getTeam
	//
	// Returns information of the root team
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/Team"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	teamID := vars["teamID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	var team *model.Team
	var err error

	if a.MattermostAuth {
		team, err = a.app.GetTeam(teamID)
		if model.IsErrNotFound(err) {
			a.errorResponse(w, r, model.NewErrUnauthorized("invalid team"))
		}
		if err != nil {
			a.errorResponse(w, r, err)
		}
	} else {
		team, err = a.app.GetRootTeam()
		if err != nil {
			a.errorResponse(w, r, err)
			return
		}
	}

	auditRec := a.makeAuditRecord(r, "getTeam", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)
	auditRec.AddMeta("resultTeamID", team.ID)

	data, err := json.Marshal(team)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)
	auditRec.Success()
}

func (a *API) handlePostTeamRegenerateSignupToken(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /teams/{teamID}/regenerate_signup_token regenerateSignupToken
	//
	// Regenerates the signup token for the root team
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"
	if a.MattermostAuth {
		a.errorResponse(w, r, model.NewErrNotImplemented("not permitted in plugin mode"))
		return
	}

	team, err := a.app.GetRootTeam()
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "regenerateSignupToken", audit.Fail)
	defer a.audit.LogRecord(audit.LevelModify, auditRec)

	team.SignupToken = utils.NewID(utils.IDTypeToken)

	if err = a.app.UpsertTeamSignupToken(*team); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleGetTeamUsers(w http.ResponseWriter, r *http.Request) {
	// swagger:operation GET /teams/{teamID}/users getTeamUsers
	//
	// Returns team users
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// - name: search
	//   in: query
	//   description: string to filter users list
	//   required: false
	//   type: string
	// - name: exclude_bots
	//   in: query
	//   description: exclude bot users
	//   required: false
	//   type: boolean
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	vars := mux.Vars(r)
	teamID := vars["teamID"]
	userID := getUserID(r)
	query := r.URL.Query()
	searchQuery := query.Get("search")
	excludeBots := r.URL.Query().Get("exclude_bots") == True

	if !a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	auditRec := a.makeAuditRecord(r, "getUsers", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)

	isGuest, err := a.userIsGuest(userID)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}
	asGuestUser := ""
	if isGuest {
		asGuestUser = userID
	}

	users, err := a.app.SearchTeamUsers(teamID, searchQuery, asGuestUser, excludeBots)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	data, err := json.Marshal(users)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonBytesResponse(w, http.StatusOK, data)

	auditRec.AddMeta("userCount", len(users))
	auditRec.Success()
}

func (a *API) handleGetTeamUsersByID(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /teams/{teamID}/users getTeamUsersByID
	//
	// Returns a user[]
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: teamID
	//   in: path
	//   description: Team ID
	//   required: true
	//   type: string
	// - name: Body
	//   in: body
	//   description: []UserIDs to return
	//   required: true
	//   type: []string
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       type: array
	//       items:
	//         "$ref": "#/definitions/User"
	//   default:
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	requestBody, err := io.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	var userIDs []string
	if err = json.Unmarshal(requestBody, &userIDs); err != nil {
		a.errorResponse(w, r, err)
		return
	}

	auditRec := a.makeAuditRecord(r, "getTeamUsersByID", audit.Fail)
	defer a.audit.LogRecord(audit.LevelRead, auditRec)

	vars := mux.Vars(r)
	teamID := vars["teamID"]
	userID := getUserID(r)

	if !a.permissions.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
		a.errorResponse(w, r, model.NewErrPermission("access denied to team"))
		return
	}

	var users []*model.User
	var error error

	if len(userIDs) == 0 {
		a.errorResponse(w, r, model.NewErrBadRequest("User IDs are empty"))
		return
	}

	if userIDs[0] == model.SingleUser {
		ws, _ := a.app.GetRootTeam()
		now := utils.GetMillis()
		user := &model.User{
			ID:       model.SingleUser,
			Username: model.SingleUser,
			Email:    model.SingleUser,
			CreateAt: ws.UpdateAt,
			UpdateAt: now,
		}
		users = append(users, user)
	} else {
		users, error = a.app.GetUsersList(userIDs)
		if error != nil {
			a.errorResponse(w, r, error)
			return
		}

		for i, u := range users {
			if a.permissions.HasPermissionToTeam(u.ID, teamID, model.PermissionManageTeam) {
				users[i].Permissions = append(users[i].Permissions, model.PermissionManageTeam.Id)
			}
			if a.permissions.HasPermissionTo(u.ID, model.PermissionManageSystem) {
				users[i].Permissions = append(users[i].Permissions, model.PermissionManageSystem.Id)
			}
		}
	}

	usersList, err := json.Marshal(users)
	if err != nil {
		a.errorResponse(w, r, err)
		return
	}

	jsonStringResponse(w, http.StatusOK, string(usersList))
	auditRec.Success()
}
