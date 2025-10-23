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
	auditRec := c.MakeAuditRecord(model.AuditEventLogin, model.AuditStatusFail)
	auditRec.AddMeta("login_method", "easy_login")
	defer c.LogAuditRec(auditRec)

	tokenString := r.URL.Query().Get("t")
	if tokenString == "" {
		c.Err = model.NewAppError("loginWithEasyToken", "api.user.easy_login.missing_token.app_error", nil, "", http.StatusBadRequest)
		return
	}

	// Rate limit by IP to prevent brute force attacks on tokens
	if c.App.Srv().RateLimiter != nil {
		rateLimitKey := c.App.Srv().RateLimiter.GenerateKey(r)
		if c.App.Srv().RateLimiter.RateLimitWriter(rateLimitKey, w) {
			return
		}
	}

	redirectURL := html.EscapeString(r.URL.Query().Get("redirect_to"))

	// Authenticate user with easy login token
	user, err := c.App.AuthenticateUserForEasyLogin(c.AppContext, tokenString)
	if err != nil {
		// Render user-friendly error page
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	auditRec.AddMeta("user_id", user.Id)
	c.LogAuditWithUserId(user.Id, "attempt - easy_login")

	// Check user authentication criteria
	if authErr := c.App.CheckUserAllAuthenticationCriteria(c.AppContext, user, ""); authErr != nil {
		c.LogAuditWithUserId(user.Id, "failure - easy_login")
		utils.RenderWebAppError(c.App.Config(), w, r, authErr, c.App.AsymmetricSigningKey())
		return
	}

	// Create session and log user in
	session, err := c.App.DoLogin(c.AppContext, w, r, user, "", false, false, true)
	if err != nil {
		utils.RenderWebAppError(c.App.Config(), w, r, err, c.App.AsymmetricSigningKey())
		return
	}

	c.AppContext = c.AppContext.WithSession(session)

	// Mark login as successful in audit log
	auditRec.Success()
	c.LogAuditWithUserId(user.Id, "success - easy_login")

	// Attach session cookies and redirect
	c.App.AttachSessionCookies(c.AppContext, w, r)

	// Determine redirect URL
	if redirectURL == "" {
		// No redirect specified - go to root and let webapp route to appropriate location
		redirectURL = c.GetSiteURLHeader()
	} else {
		// Validate and make redirect URL fully qualified
		redirectURL = fullyQualifiedRedirectURL(c.GetSiteURLHeader(), redirectURL, c.App.Config().NativeAppSettings.AppCustomURLSchemes)
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}
