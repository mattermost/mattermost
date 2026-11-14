// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/sirupsen/logrus"
)

const (
	MicrosoftTeamsAppDomain = "https://playbooks.integrations.mattermost.com"
	ExpectedAudience        = "api://playbooks.integrations.mattermost.com/8f7d5beb-ed24-4d95-aa31-c26298d5a982"
)

// TabAppHandler is the API handler.
type TabAppHandler struct {
	*ErrorHandler
	config             config.Service
	playbookRunService app.PlaybookRunService
	pluginAPI          *pluginapi.Client
	getJWTKeyFunc      func() keyfunc.Keyfunc
}

// NewTabAppHandler Creates a new Plugin API handler.
func NewTabAppHandler(
	apiHandler *Handler,
	playbookRunService app.PlaybookRunService,
	api *pluginapi.Client,
	configService config.Service,
	getJWTKeyFunc func() keyfunc.Keyfunc,
) *TabAppHandler {
	handler := &TabAppHandler{
		ErrorHandler:       &ErrorHandler{},
		playbookRunService: playbookRunService,
		pluginAPI:          api,
		config:             configService,
		getJWTKeyFunc:      getJWTKeyFunc,
	}

	// Regiter the tab app on the root, which doesn't require Mattermost user authentication.
	tabAppRouter := apiHandler.root.PathPrefix("/tabapp/").Subrouter()
	tabAppRouter.HandleFunc("/runs", withContext(handler.getPlaybookRuns)).Methods(http.MethodOptions, http.MethodGet)

	return handler
}

// limitedUser returns the minimum amount of user data needed for the app.
type limitedUser struct {
	UserID    string `json:"user_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// limitedUser returns the minimum amount of post data needed for the app.
type limitedPost struct {
	Message  string `json:"message"`
	CreateAt int64  `json:"create_at"`
	UserID   string `json:"user_id"`
}

type tabAppResults struct {
	TotalCount int                    `json:"total_count"`
	PageCount  int                    `json:"page_count"`
	PerPage    int                    `json:"per_page"`
	HasMore    bool                   `json:"has_more"`
	Items      []app.PlaybookRun      `json:"items"`
	Users      map[string]limitedUser `json:"users"`
	Posts      map[string]limitedPost `json:"posts"`
}

func (r tabAppResults) Clone() tabAppResults {
	newTabAppResults := r

	newTabAppResults.Items = make([]app.PlaybookRun, 0, len(r.Items))
	for _, i := range r.Items {
		newTabAppResults.Items = append(newTabAppResults.Items, *i.Clone())
	}

	return newTabAppResults
}

func (r tabAppResults) MarshalJSON() ([]byte, error) {
	type Alias tabAppResults

	old := Alias(r.Clone())

	// replace nils with empty slices for the frontend
	if old.Items == nil {
		old.Items = []app.PlaybookRun{}
	}

	return json.Marshal(old)
}

type validationError struct {
	StatusCode int
	Message    string
	Err        error
}

func (ve validationError) Error() string {
	return ve.Message
}

// validateToken validates the token in the given http.Request.
//
// A valid token is one that's been signed by Microsoft, has an `aud` claim that matches
// our known app, and has an `tid` claim that matches one of the configured tenants.
//
// In developer mode, we relax these constraints. First, we skip validation if an empty
// token is provided. This allows the developer to test the user interface and backend
// outside of Teams. Second, we skip checking the `aud` claim, allowing the token to match
// a developer app. If a token is provided, it must always be signed and match the
// configured tenant.
func validateToken(jwtKeyFunc keyfunc.Keyfunc, r *http.Request, expectedTenantIDs []string, enableDeveloper bool) *validationError {
	token := r.Header.Get("Authorization")
	if token == "" && enableDeveloper {
		logrus.Warn("Skipping token validation check for empty token since developer mode enabled")
		return nil
	}

	if jwtKeyFunc == nil {
		return &validationError{
			StatusCode: http.StatusInternalServerError,
			Message:    "Failed to initialize token validation",
		}
	}

	options := []jwt.ParserOption{
		// See https://golang-jwt.github.io/jwt/usage/signing_methods/ -- this is effectively all
		// asymetric signing methods so that we exclude both the symmetric signing methods as
		// well as the "none" algorithm.
		//
		// In practice, the upstream library already chokes on the HMAC validate method expecting
		// a []byte but getting a public key object, but this is more explicit.
		jwt.WithValidMethods([]string{
			jwt.SigningMethodES256.Alg(),
			jwt.SigningMethodES384.Alg(),
			jwt.SigningMethodES512.Alg(),
			jwt.SigningMethodRS256.Alg(),
			jwt.SigningMethodRS384.Alg(),
			jwt.SigningMethodRS512.Alg(),
			jwt.SigningMethodPS256.Alg(),
			jwt.SigningMethodPS384.Alg(),
			jwt.SigningMethodPS512.Alg(),
			jwt.SigningMethodEdDSA.Alg(),
		}),
		// Require iat claim, and verify the token is not used before issue.
		jwt.WithIssuedAt(),
		// Require the exp claim: the library always verifies if the claim is present.
		jwt.WithExpirationRequired(),
		// There's no WithNotBefore() helper, but the library always verifies if the claim is present.
	}

	// Verify that this token was signed for the expected app, unless developer mode is enabled.
	if enableDeveloper {
		logrus.Warn("Skipping aud claim check for token since developer mode enabled")
	} else {
		options = append(options, jwt.WithAudience(ExpectedAudience))
	}

	parsed, err := jwt.Parse(
		token,
		jwtKeyFunc.Keyfunc,
		options...,
	)
	if err != nil {
		logrus.WithError(err).Warn("Rejected invalid token")

		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Failed to parse token",
			Err:        err,
		}
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		logrus.Warn("Validated token, but failed to parse claims")

		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Unexpected claims",
		}
	}

	logger := logrus.WithFields(logrus.Fields{
		"aud":                 claims["aud"],
		"tid":                 claims["tid"],
		"oid":                 claims["oid"],
		"expected_tenant_ids": expectedTenantIDs,
	})

	// Verify the iat was present. The library is configured above to check
	// its value is not in the future if present, but doesn't enforce its
	// presence.
	if iat, _ := parsed.Claims.GetIssuedAt(); iat == nil {
		logger.Warn("Validated token, but rejected request on missing iat")
		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Unexpected claims",
		}
	}

	// Verify the nbp was present. The library is configured above to check
	// its value is not in the future if present, but doesn't enforce its
	// presence.
	if nbf, _ := parsed.Claims.GetNotBefore(); nbf == nil {
		logger.Warn("Validated token, but rejected request on missing nbf")
		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Unexpected claims",
		}
	}

	// Verify the tid is a GUID
	if tid, ok := claims["tid"].(string); !ok {
		logger.Warn("Validated token, but rejected request on missing tid")
		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Unexpected claims",
		}
	} else if _, err = uuid.Parse(tid); err != nil {
		logger.Warn("Validated token, but rejected request on non-GUID tid")
		return &validationError{
			StatusCode: http.StatusUnauthorized,
			Message:    "Unexpected claims",
		}
	}

	for _, expectedTenantID := range expectedTenantIDs {
		if claims["tid"] == expectedTenantID {
			logger.Info("Validated token, and authorized request from matching tenant")
			return nil

		} else if enableDeveloper && expectedTenantID == "*" {
			logger.Warn("Validated token, but authorized request from wildcard tenant since developer mode enabled")
			return nil
		}
	}

	logger.Warn("Validated token, but rejected request on tenant mismatch")
	return &validationError{
		StatusCode: http.StatusUnauthorized,
		Message:    "Unexpected claims",
	}
}

func (h *TabAppHandler) getLimitedUser(userID string, showFullName bool) (limitedUser, error) {
	user, err := h.pluginAPI.User.Get(userID)
	if err != nil {
		return limitedUser{}, err
	}

	lUser := limitedUser{
		UserID: user.Id,
	}
	if showFullName {
		lUser.FirstName = user.FirstName
		lUser.LastName = user.LastName
	} else {
		lUser.FirstName = user.Username
	}

	return lUser, nil
}

// getPlaybookRuns handles the GET /tabapp/runs endpoint.
//
// It returns certain runs and associated users and status posts in support of
// a Microsoft Teams app backed by a Mattermost domain.
//
// Only runs with the @msteams as a participant are returned, though this can
// this can be automated by automatically inviting said bot to new runs via the
// playbook configuration.
//
// A Mattermost account is not required: rather the caller must prove
// themselves to belong to the configured Microsoft Teams tenant by passing a
// Microsoft Entra ID token in the Authorization header. The signature of this
// JWT is verified against known Microsoft signing keys, effectively allowing
// anyone with access to that tenant to access this endpoint.
func (h *TabAppHandler) getPlaybookRuns(c *Context, w http.ResponseWriter, r *http.Request) {
	// If not enabled, the client won't get this reply since we won't have sent
	// the CORS headers yet. This is no different than if Playbooks wasn't
	// installed, so the client has to handle this case anyway.
	if !h.config.GetConfiguration().EnableTeamsTabApp {
		logrus.Warn("Rejecting request for teams tab app since feature not enabled")
		handleResponseWithCode(w, http.StatusForbidden, "Tab app not enabled")
		return
	}

	// In development, allow CORS from any requestor. Specify the host given in the origin and
	// not the wildcard '*' to continue to allow exchange of authorization tokens. Otherwise,
	// in production, we require the app to originate from the known domain.
	config := h.pluginAPI.Configuration.GetConfig()
	enableDeveloperAndTesting := config.ServiceSettings.EnableDeveloper != nil && *config.ServiceSettings.EnableDeveloper &&
		config.ServiceSettings.EnableTesting != nil && *config.ServiceSettings.EnableTesting
	if enableDeveloperAndTesting {
		logrus.WithField("origin", r.Header.Get("Origin")).Warn("Setting custom CORS header to match developer origin")
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
	} else {
		w.Header().Set("Access-Control-Allow-Origin", MicrosoftTeamsAppDomain)
	}
	w.Header().Add("Access-Control-Allow-Headers", "Authorization")
	w.Header().Add("Access-Control-Allow-Methods", "OPTIONS,GET")

	// No payload needed to pre-flight the request.
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Validate the token in the request, handling all errors if invalid.
	expectedTenantIDs := strings.Split(h.config.GetConfiguration().TeamsTabAppTenantIDs, ",")
	if validationErr := validateToken(h.getJWTKeyFunc(), r, expectedTenantIDs, enableDeveloperAndTesting); validationErr != nil {
		h.HandleErrorWithCode(w, c.logger, validationErr.StatusCode, validationErr.Message, validationErr.Err)
		return
	}

	teamsTabAppBotUserID := h.config.GetConfiguration().TeamsTabAppBotUserID

	// Parse using the common filter options, but we only support a subset below.
	filterOptions, err := parsePlaybookRunsFilterOptions(r.URL, teamsTabAppBotUserID)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	// We'll only fetch runs of which the teams tab app bot is a participant.
	requesterInfo := app.RequesterInfo{
		UserID: teamsTabAppBotUserID,
	}
	limitedFilterOptions := app.PlaybookRunFilterOptions{
		Page:          filterOptions.Page,
		PerPage:       filterOptions.PerPage,
		ParticipantID: teamsTabAppBotUserID,
		Statuses:      []string{app.StatusInProgress},
		Sort:          app.SortByCreateAt,
		Direction:     app.DirectionDesc,
	}
	runResults, err := h.playbookRunService.GetPlaybookRuns(requesterInfo, limitedFilterOptions)
	if err != nil {
		h.HandleError(w, c.logger, err)
		return
	}

	showFullName := false
	if showFullNamePtr := h.pluginAPI.Configuration.GetConfig().PrivacySettings.ShowFullName; showFullNamePtr != nil && *showFullNamePtr {
		showFullName = true
	}

	// Collect all the users participating in the runs.
	users := make(map[string]limitedUser)
	for _, run := range runResults.Items {
		for _, participantID := range run.ParticipantIDs {
			if _, ok := users[participantID]; ok {
				continue
			}

			user, err := h.getLimitedUser(participantID, showFullName)
			if err != nil {
				logrus.WithField("user_id", participantID).WithError(err).Warn("Failed to get participant user")
				continue
			}

			users[participantID] = user
		}
	}

	// Collect all the status posts for the runs.
	posts := make(map[string]limitedPost)
	for _, run := range runResults.Items {
		for _, statusPost := range run.StatusPosts {
			if statusPost.DeleteAt > 0 {
				continue
			}

			post, err := h.pluginAPI.Post.GetPost(statusPost.ID)
			if err != nil {
				logrus.WithField("post_id", statusPost.ID).WithError(err).Warn("Failed to get status post")
				continue
			}
			posts[statusPost.ID] = limitedPost{
				Message:  post.Message,
				CreateAt: post.CreateAt,
				UserID:   post.UserId,
			}
		}
	}

	// Collect all the authors for the status posts in the runs.
	for _, statusPost := range posts {
		if _, ok := users[statusPost.UserID]; ok {
			continue
		}

		// TODO: We don't actually post as the author anymore, so this is really
		// only going to look up the single @playbooks user right now. Update this
		// to extract the username from the stauts post props and resolve that user
		// instead.
		user, err := h.getLimitedUser(statusPost.UserID, showFullName)
		if err != nil {
			logrus.WithField("user_id", statusPost.UserID).WithError(err).Warn("Failed to get status post user")
			continue
		}

		users[statusPost.UserID] = user
	}

	c.logger.WithField("total_count", runResults.TotalCount).Info("Handled request from tabapp client")

	results := tabAppResults{
		TotalCount: runResults.TotalCount,
		PageCount:  runResults.PageCount,
		PerPage:    runResults.PerPage,
		HasMore:    runResults.HasMore,
		Items:      runResults.Items,
		Users:      users,
		Posts:      posts,
	}

	ReturnJSON(w, results, http.StatusOK)
}
