package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/audit"
	"github.com/mattermost/focalboard/server/services/auth"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	MinimumPasswordLength = 8
)

type ParamError struct {
	msg string
}

func (pe ParamError) Error() string {
	return pe.msg
}

// LoginRequest is a login request
// swagger:model
type LoginRequest struct {
	// Type of login, currently must be set to "normal"
	// required: true
	Type string `json:"type"`

	// If specified, login using username
	// required: false
	Username string `json:"username"`

	// If specified, login using email
	// required: false
	Email string `json:"email"`

	// Password
	// required: true
	Password string `json:"password"`

	// MFA token
	// required: false
	// swagger:ignore
	MfaToken string `json:"mfa_token"`
}

// LoginResponse is a login response
// swagger:model
type LoginResponse struct {
	// Session token
	// required: true
	Token string `json:"token"`
}

func LoginResponseFromJSON(data io.Reader) (*LoginResponse, error) {
	var resp LoginResponse
	if err := json.NewDecoder(data).Decode(&resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// RegisterRequest is a user registration request
// swagger:model
type RegisterRequest struct {
	// User name
	// required: true
	Username string `json:"username"`

	// User's email
	// required: true
	Email string `json:"email"`

	// Password
	// required: true
	Password string `json:"password"`

	// Registration authorization token
	// required: true
	Token string `json:"token"`
}

func (rd *RegisterRequest) IsValid() error {
	if strings.TrimSpace(rd.Username) == "" {
		return ParamError{"username is required"}
	}
	if strings.TrimSpace(rd.Email) == "" {
		return ParamError{"email is required"}
	}
	if !auth.IsEmailValid(rd.Email) {
		return ParamError{"invalid email format"}
	}
	if rd.Password == "" {
		return ParamError{"password is required"}
	}
	return isValidPassword(rd.Password)
}

// ChangePasswordRequest is a user password change request
// swagger:model
type ChangePasswordRequest struct {
	// Old password
	// required: true
	OldPassword string `json:"oldPassword"`

	// New password
	// required: true
	NewPassword string `json:"newPassword"`
}

// IsValid validates a password change request.
func (rd *ChangePasswordRequest) IsValid() error {
	if rd.OldPassword == "" {
		return ParamError{"old password is required"}
	}
	if rd.NewPassword == "" {
		return ParamError{"new password is required"}
	}
	return isValidPassword(rd.NewPassword)
}

func isValidPassword(password string) error {
	if len(password) < MinimumPasswordLength {
		return ParamError{fmt.Sprintf("password must be at least %d characters", MinimumPasswordLength)}
	}
	return nil
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/login login
	//
	// Login user
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: body
	//   in: body
	//   description: Login request
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/LoginRequest"
	// responses:
	//   '200':
	//     description: success
	//     schema:
	//       "$ref": "#/definitions/LoginResponse"
	//   '401':
	//     description: invalid login
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"
	//   '500':
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	if len(a.singleUserToken) > 0 {
		// Not permitted in single-user mode
		a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "not permitted in single-user mode", nil)
		return
	}

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	var loginData LoginRequest
	err = json.Unmarshal(requestBody, &loginData)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	auditRec := a.makeAuditRecord(r, "login", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("username", loginData.Username)
	auditRec.AddMeta("type", loginData.Type)

	if loginData.Type == "normal" {
		token, err := a.app.Login(loginData.Username, loginData.Email, loginData.Password, loginData.MfaToken)
		if err != nil {
			a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "incorrect login", err)
			return
		}
		json, err := json.Marshal(LoginResponse{Token: token})
		if err != nil {
			a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
			return
		}

		jsonBytesResponse(w, http.StatusOK, json)
		auditRec.Success()
		return
	}

	a.errorResponse(w, r.URL.Path, http.StatusBadRequest, "invalid login type", nil)
}

func (a *API) handleRegister(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/register register
	//
	// Register new user
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: body
	//   in: body
	//   description: Register request
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/RegisterRequest"
	// responses:
	//   '200':
	//     description: success
	//   '401':
	//     description: invalid registration token
	//   '500':
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	if len(a.singleUserToken) > 0 {
		// Not permitted in single-user mode
		a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "not permitted in single-user mode", nil)
		return
	}

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	var registerData RegisterRequest
	err = json.Unmarshal(requestBody, &registerData)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	// Validate token
	if len(registerData.Token) > 0 {
		workspace, err2 := a.app.GetRootWorkspace()
		if err2 != nil {
			a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err2)
			return
		}

		if registerData.Token != workspace.SignupToken {
			a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "invalid token", nil)
			return
		}
	} else {
		// No signup token, check if no active users
		userCount, err2 := a.app.GetRegisteredUserCount()
		if err2 != nil {
			a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err2)
			return
		}
		if userCount > 0 {
			a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "no sign-up token and user(s) already exist", nil)
			return
		}
	}

	if err = registerData.IsValid(); err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusBadRequest, err.Error(), err)
		return
	}

	auditRec := a.makeAuditRecord(r, "register", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)
	auditRec.AddMeta("username", registerData.Username)

	err = a.app.RegisterUser(registerData.Username, registerData.Email, registerData.Password)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusBadRequest, err.Error(), err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) handleChangePassword(w http.ResponseWriter, r *http.Request) {
	// swagger:operation POST /api/v1/users/{userID}/changepassword changePassword
	//
	// Change a user's password
	//
	// ---
	// produces:
	// - application/json
	// parameters:
	// - name: userID
	//   in: path
	//   description: User ID
	//   required: true
	//   type: string
	// - name: body
	//   in: body
	//   description: Change password request
	//   required: true
	//   schema:
	//     "$ref": "#/definitions/ChangePasswordRequest"
	// security:
	// - BearerAuth: []
	// responses:
	//   '200':
	//     description: success
	//   '400':
	//     description: invalid request
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"
	//   '500':
	//     description: internal error
	//     schema:
	//       "$ref": "#/definitions/ErrorResponse"

	if len(a.singleUserToken) > 0 {
		// Not permitted in single-user mode
		a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "not permitted in single-user mode", nil)
		return
	}

	vars := mux.Vars(r)
	userID := vars["userID"]

	requestBody, err := ioutil.ReadAll(r.Body)
	if err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	var requestData ChangePasswordRequest
	if err = json.Unmarshal(requestBody, &requestData); err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusInternalServerError, "", err)
		return
	}

	if err = requestData.IsValid(); err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusBadRequest, err.Error(), err)
		return
	}

	auditRec := a.makeAuditRecord(r, "changePassword", audit.Fail)
	defer a.audit.LogRecord(audit.LevelAuth, auditRec)

	if err = a.app.ChangePassword(userID, requestData.OldPassword, requestData.NewPassword); err != nil {
		a.errorResponse(w, r.URL.Path, http.StatusBadRequest, err.Error(), err)
		return
	}

	jsonStringResponse(w, http.StatusOK, "{}")
	auditRec.Success()
}

func (a *API) sessionRequired(handler func(w http.ResponseWriter, r *http.Request)) func(w http.ResponseWriter, r *http.Request) {
	return a.attachSession(handler, true)
}

func (a *API) attachSession(handler func(w http.ResponseWriter, r *http.Request), required bool) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		token, _ := auth.ParseAuthTokenFromRequest(r)

		a.logger.Debug(`attachSession`, mlog.Bool("single_user", len(a.singleUserToken) > 0))
		if len(a.singleUserToken) > 0 {
			if required && (token != a.singleUserToken) {
				a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "invalid single user token", nil)
				return
			}

			now := time.Now().Unix()
			session := &model.Session{
				ID:          SingleUser,
				Token:       token,
				UserID:      SingleUser,
				AuthService: a.authService,
				Props:       map[string]interface{}{},
				CreateAt:    now,
				UpdateAt:    now,
			}
			ctx := context.WithValue(r.Context(), sessionContextKey, session)
			handler(w, r.WithContext(ctx))
			return
		}

		if a.MattermostAuth && r.Header.Get("Mattermost-User-Id") != "" {
			userID := r.Header.Get("Mattermost-User-Id")
			now := time.Now().Unix()
			session := &model.Session{
				ID:          userID,
				Token:       userID,
				UserID:      userID,
				AuthService: a.authService,
				Props:       map[string]interface{}{},
				CreateAt:    now,
				UpdateAt:    now,
			}
			ctx := context.WithValue(r.Context(), sessionContextKey, session)
			handler(w, r.WithContext(ctx))
			return
		}

		session, err := a.app.GetSession(token)
		if err != nil {
			if required {
				a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "", err)
				return
			}

			handler(w, r)
			return
		}

		authService := session.AuthService
		if authService != a.authService {
			a.logger.Error(`Session authService mismatch`,
				mlog.String("sessionID", session.ID),
				mlog.String("want", a.authService),
				mlog.String("got", authService),
			)
			a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "", err)
			return
		}

		ctx := context.WithValue(r.Context(), sessionContextKey, session)
		handler(w, r.WithContext(ctx))
	}
}

func (a *API) adminRequired(handler func(w http.ResponseWriter, r *http.Request)) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		// Currently, admin APIs require local unix connections
		conn := GetContextConn(r)
		if _, isUnix := conn.(*net.UnixConn); !isUnix {
			a.errorResponse(w, r.URL.Path, http.StatusUnauthorized, "not a local unix connection", nil)
			return
		}

		handler(w, r)
	}
}
