// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/gorilla/mux"

	"github.com/mattermost/mattermost-server/server/v8/boards/app"
	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/audit"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

const (
	HeaderRequestedWith    = "X-Requested-With"
	HeaderRequestedWithXML = "XMLHttpRequest"
	UploadFormFileKey      = "file"
	True                   = "true"

	ErrorNoTeamCode    = 1000
	ErrorNoTeamMessage = "No team"
)

var (
	ErrHandlerPanic = errors.New("http handler panic")
)

// ----------------------------------------------------------------------------------------------------
// REST APIs

type API struct {
	app             *app.App
	authService     string
	permissions     permissions.PermissionsService
	singleUserToken string
	MattermostAuth  bool
	logger          mlog.LoggerIFace
	audit           *audit.Audit
	isPlugin        bool
}

func NewAPI(
	app *app.App,
	singleUserToken string,
	authService string,
	permissions permissions.PermissionsService,
	logger mlog.LoggerIFace,
	audit *audit.Audit,
	isPlugin bool,
) *API {
	return &API{
		app:             app,
		singleUserToken: singleUserToken,
		authService:     authService,
		permissions:     permissions,
		logger:          logger,
		audit:           audit,
		isPlugin:        isPlugin,
	}
}

func (a *API) RegisterRoutes(r *mux.Router) {
	apiv2 := r.PathPrefix("/api/v2").Subrouter()
	apiv2.Use(a.panicHandler)
	apiv2.Use(a.requireCSRFToken)

	/* ToDo:
	apiv3 := r.PathPrefix("/api/v3").Subrouter()
	apiv3.Use(a.panicHandler)
	apiv3.Use(a.requireCSRFToken)
	*/

	// V2 routes (ToDo: migrate these to V3 when ready to ship V3)
	a.registerUsersRoutes(apiv2)
	a.registerAuthRoutes(apiv2)
	a.registerMembersRoutes(apiv2)
	a.registerCategoriesRoutes(apiv2)
	a.registerSharingRoutes(apiv2)
	a.registerTeamsRoutes(apiv2)
	a.registerAchivesRoutes(apiv2)
	a.registerSubscriptionsRoutes(apiv2)
	a.registerFilesRoutes(apiv2)
	a.registerLimitsRoutes(apiv2)
	a.registerInsightsRoutes(apiv2)
	a.registerOnboardingRoutes(apiv2)
	a.registerSearchRoutes(apiv2)
	a.registerConfigRoutes(apiv2)
	a.registerBoardsAndBlocksRoutes(apiv2)
	a.registerChannelsRoutes(apiv2)
	a.registerTemplatesRoutes(apiv2)
	a.registerBoardsRoutes(apiv2)
	a.registerBlocksRoutes(apiv2)
	a.registerContentBlocksRoutes(apiv2)
	a.registerStatisticsRoutes(apiv2)
	a.registerComplianceRoutes(apiv2)

	// V3 routes
	a.registerCardsRoutes(apiv2)

	// System routes are outside the /api/v2 path
	a.registerSystemRoutes(r)
}

func (a *API) RegisterAdminRoutes(r *mux.Router) {
	r.HandleFunc("/api/v2/admin/users/{username}/password", a.adminRequired(a.handleAdminSetPassword)).Methods("POST")
}

func getUserID(r *http.Request) string {
	ctx := r.Context()
	session, ok := ctx.Value(sessionContextKey).(*model.Session)
	if !ok {
		return ""
	}
	return session.UserID
}

func (a *API) panicHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if p := recover(); p != nil {
				a.logger.Error("Http handler panic",
					mlog.Any("panic", p),
					mlog.String("stack", string(debug.Stack())),
					mlog.String("uri", r.URL.Path),
				)
				a.errorResponse(w, r, ErrHandlerPanic)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (a *API) requireCSRFToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.checkCSRFToken(r) {
			a.logger.Error("checkCSRFToken FAILED")
			a.errorResponse(w, r, model.NewErrBadRequest("checkCSRFToken FAILED"))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (a *API) checkCSRFToken(r *http.Request) bool {
	token := r.Header.Get(HeaderRequestedWith)
	return token == HeaderRequestedWithXML
}

func (a *API) hasValidReadTokenForBoard(r *http.Request, boardID string) bool {
	query := r.URL.Query()
	readToken := query.Get("read_token")

	if len(readToken) < 1 {
		return false
	}

	isValid, err := a.app.IsValidReadToken(boardID, readToken)
	if err != nil {
		a.logger.Error("IsValidReadTokenForBoard ERROR", mlog.Err(err))
		return false
	}

	return isValid
}

func (a *API) userIsGuest(userID string) (bool, error) {
	if a.singleUserToken != "" {
		return false, nil
	}
	return a.app.UserIsGuest(userID)
}

// Response helpers

func (a *API) errorResponse(w http.ResponseWriter, r *http.Request, err error) {
	a.logger.Error(err.Error())
	errorResponse := model.ErrorResponse{Error: err.Error()}

	switch {
	case model.IsErrBadRequest(err):
		errorResponse.ErrorCode = http.StatusBadRequest
	case model.IsErrUnauthorized(err):
		errorResponse.ErrorCode = http.StatusUnauthorized
	case model.IsErrForbidden(err):
		errorResponse.ErrorCode = http.StatusForbidden
	case model.IsErrNotFound(err):
		errorResponse.ErrorCode = http.StatusNotFound
	case model.IsErrRequestEntityTooLarge(err):
		errorResponse.ErrorCode = http.StatusRequestEntityTooLarge
	case model.IsErrNotImplemented(err):
		errorResponse.ErrorCode = http.StatusNotImplemented
	default:
		a.logger.Error("API ERROR",
			mlog.Int("code", http.StatusInternalServerError),
			mlog.Err(err),
			mlog.String("api", r.URL.Path),
		)
		errorResponse.Error = "internal server error"
		errorResponse.ErrorCode = http.StatusInternalServerError
	}

	setResponseHeader(w, "Content-Type", "application/json")
	data, err := json.Marshal(errorResponse)
	if err != nil {
		data = []byte("{}")
	}

	w.WriteHeader(errorResponse.ErrorCode)
	_, _ = w.Write(data)
}

func stringResponse(w http.ResponseWriter, message string) {
	setResponseHeader(w, "Content-Type", "text/plain")
	_, _ = fmt.Fprint(w, message)
}

func jsonStringResponse(w http.ResponseWriter, code int, message string) { //nolint:unparam
	setResponseHeader(w, "Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprint(w, message)
}

func jsonBytesResponse(w http.ResponseWriter, code int, json []byte) {
	setResponseHeader(w, "Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(json)
}

func setResponseHeader(w http.ResponseWriter, key string, value string) { //nolint:unparam
	header := w.Header()
	if header == nil {
		return
	}
	header.Set(key, value)
}
