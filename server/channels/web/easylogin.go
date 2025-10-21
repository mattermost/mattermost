// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"html"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (w *Web) InitEasyLogin() {
	w.MainRouter.Handle("/login/sso/easy", w.APIHandler(loginWithEasyToken)).Methods(http.MethodGet)
}

func loginWithEasyToken(c *Context, w http.ResponseWriter, r *http.Request) {
	tokenString := r.URL.Query().Get("t")
	if tokenString == "" {
		c.Err = model.NewAppError("loginWithEasyToken", "api.user.easy_login.missing_token.app_error", nil, "", http.StatusBadRequest)
		return
	}

	redirectURL := html.EscapeString(r.URL.Query().Get("redirect_to"))
	isMobile := r.URL.Query().Get("mobile") == "true"

	// Authenticate user with easy login token
	user, err := c.App.AuthenticateUserForEasyLogin(c.AppContext, tokenString)
	if err != nil {
		// Render user-friendly error page
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	// Check user authentication criteria
	if err := c.App.CheckUserAllAuthenticationCriteria(c.AppContext, user, ""); err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	// Create session and log user in
	session, err := c.App.DoLogin(c.AppContext, w, r, user, "", isMobile, false, true)
	if err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	c.AppContext = c.AppContext.WithSession(session)
	c.App.AttachSessionCookies(c.AppContext, w, r)

	// Determine redirect URL
	if redirectURL == "" {
		// Redirect to the first channel the guest has access to
		// Get user's team memberships
		teamMembers, teamErr := c.App.GetTeamMembersForUser(c.AppContext, user.Id, "", false)
		if teamErr == nil && len(teamMembers) > 0 {
			// Get channels for the user
			channels, chanErr := c.App.GetChannelsForUser(c.AppContext, user.Id, false, 0, 100, "")
			if chanErr == nil && len(channels) > 0 {
				// Redirect to first channel in the first team
				redirectURL = c.GetSiteURLHeader() + "/" + teamMembers[0].TeamId + "/channels/" + channels[0].Name
			}
		}
	} else {
		// Validate and make redirect URL fully qualified
		redirectURL = fullyQualifiedRedirectURL(c.GetSiteURLHeader(), redirectURL, c.App.Config().NativeAppSettings.AppCustomURLSchemes)
	}

	// Default fallback
	if redirectURL == "" {
		redirectURL = c.GetSiteURLHeader()
	}

	// Redirect to destination
	if isMobile {
		utils.RenderMobileAuthComplete(w, redirectURL)
	} else {
		http.Redirect(w, r, redirectURL, http.StatusFound)
	}
}
