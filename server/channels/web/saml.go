// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	b64 "encoding/base64"
	"html"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const maxSAMLResponseSize = 2 * 1024 * 1024 // 2MB

func (w *Web) InitSaml() {
	w.MainRouter.Handle("/login/sso/saml", w.APIHandler(loginWithSaml)).Methods(http.MethodGet)
	w.MainRouter.Handle("/login/sso/saml", w.APIHandlerTrustRequester(completeSaml)).Methods(http.MethodPost)
}

func loginWithSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := c.App.Saml()

	if samlInterface == nil {
		c.Err = model.NewAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
		return
	}

	teamId, err := c.App.GetTeamIdFromQuery(c.AppContext, r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}
	action := r.URL.Query().Get("action")
	isMobile := action == model.OAuthActionMobile
	redirectURL := html.EscapeString(r.URL.Query().Get("redirect_to"))
	relayProps := map[string]string{}
	relayState := ""

	if action != "" {
		relayProps["team_id"] = teamId
		relayProps["action"] = action
		if action == model.OAuthActionEmailToSSO {
			relayProps["email_token"] = r.URL.Query().Get("email_token")
		}
	}

	if redirectURL != "" {
		if isMobile && !utils.IsValidMobileAuthRedirectURL(c.App.Config(), redirectURL) {
			invalidSchemeErr := model.NewAppError("loginWithOAuth", "api.invalid_custom_url_scheme", nil, "", http.StatusBadRequest)
			utils.RenderMobileError(c.App.Config(), w, invalidSchemeErr, redirectURL)
			return
		}
		relayProps["redirect_to"] = redirectURL
	}

	desktopToken := r.URL.Query().Get("desktop_token")
	if desktopToken != "" {
		relayProps["desktop_token"] = desktopToken
	}

	relayProps[model.UserAuthServiceIsMobile] = strconv.FormatBool(isMobile)

	if len(relayProps) > 0 {
		relayState = b64.StdEncoding.EncodeToString([]byte(model.MapToJSON(relayProps)))
	}

	data, err := samlInterface.BuildRequest(c.AppContext, relayState)
	if err != nil {
		c.Err = err
		return
	}
	w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
	http.Redirect(w, r, data.URL, http.StatusFound)
}

func completeSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := c.App.Saml()

	if samlInterface == nil {
		c.Err = model.NewAppError("completeSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
		return
	}

	//Validate that the user is with SAML and all that
	encodedXML := r.FormValue("SAMLResponse")
	relayState := r.FormValue("RelayState")

	relayProps := make(map[string]string)
	if relayState != "" {
		stateStr := ""
		b, err := b64.StdEncoding.DecodeString(relayState)
		if err != nil {
			c.Err = model.NewAppError("completeSaml", "api.user.authorize_oauth_user.invalid_state.app_error", nil, "", http.StatusFound).Wrap(err)
			return
		}
		stateStr = string(b)
		relayProps = model.MapFromJSON(strings.NewReader(stateStr))
	}

	auditRec := c.MakeAuditRecord("completeSaml", audit.Fail)
	defer c.LogAuditRec(auditRec)
	c.LogAudit("attempt")

	action := relayProps["action"]
	auditRec.AddMeta("action", action)

	isMobile := action == model.OAuthActionMobile
	redirectURL := ""
	hasRedirectURL := false
	if val, ok := relayProps["redirect_to"]; ok {
		redirectURL = val
		hasRedirectURL = val != ""
	}
	redirectURL = fullyQualifiedRedirectURL(c.GetSiteURLHeader(), redirectURL)

	handleError := func(err *model.AppError) {
		if isMobile && hasRedirectURL {
			err.Translate(c.AppContext.T)
			utils.RenderMobileError(c.App.Config(), w, err, redirectURL)
		} else {
			c.Err = err
			c.Err.StatusCode = http.StatusFound
		}
	}

	if len(encodedXML) > maxSAMLResponseSize {
		err := model.NewAppError("completeSaml", "api.user.authorize_oauth_user.saml_response_too_long.app_error", nil, "SAML response is too long", http.StatusBadRequest)
		handleError(err)
		return
	}

	user, err := samlInterface.DoLogin(c.AppContext, encodedXML, relayProps)
	if err != nil {
		c.LogAudit("fail")
		handleError(err)
		return
	}

	if err = c.App.CheckUserAllAuthenticationCriteria(c.AppContext, user, ""); err != nil {
		handleError(err)
		return
	}

	switch action {
	case model.OAuthActionSignup:
		if teamId := relayProps["team_id"]; teamId != "" {
			if err = c.App.AddUserToTeamByTeamId(c.AppContext, teamId, user); err != nil {
				c.LogErrorByCode(err)
				break
			}
			c.App.AddDirectChannels(c.AppContext, teamId, user)
		}
	case model.OAuthActionEmailToSSO:
		if err = c.App.RevokeAllSessions(c.AppContext, user.Id); err != nil {
			c.Err = err
			return
		}
		auditRec.AddMeta("revoked_user_id", user.Id)
		auditRec.AddMeta("revoked", "Revoked all sessions for user")

		c.LogAuditWithUserId(user.Id, "Revoked all sessions for user")
		c.App.Srv().Go(func() {
			if err := c.App.Srv().EmailService.SendSignInChangeEmail(user.Email, strings.Title(model.UserAuthServiceSaml)+" SSO", user.Locale, c.App.GetSiteURL()); err != nil {
				c.LogErrorByCode(model.NewAppError("SendSignInChangeEmail", "api.user.send_sign_in_change_email_and_forget.error", nil, "", http.StatusInternalServerError).Wrap(err))
			}
		})
	}

	auditRec.AddMeta("obtained_user_id", user.Id)
	c.LogAuditWithUserId(user.Id, "obtained user")

	desktopToken := relayProps["desktop_token"]

	// If it's a desktop login we generate a token and redirect to another endpoint to handle session creation
	if desktopToken != "" {
		serverToken, serverTokenErr := c.App.GenerateAndSaveDesktopToken(time.Now().Unix(), user)
		if serverTokenErr != nil {
			handleError(serverTokenErr)
			return
		}

		queryString := map[string]string{
			"client_token": desktopToken,
			"server_token": *serverToken,
		}
		if val, ok := relayProps["redirect_to"]; ok {
			queryString["redirect_to"] = val
		}
		if strings.HasPrefix(desktopToken, "dev-") {
			queryString["isDesktopDev"] = "true"
		}

		redirectURL = utils.AppendQueryParamsToURL(c.GetSiteURLHeader()+"/login/desktop", queryString)
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	// If it's not a desktop login we create a session for this SAML User that will be used in their browser or mobile app
	session, err := c.App.DoLogin(c.AppContext, w, r, user, "", isMobile, false, true)
	if err != nil {
		handleError(err)
		return
	}
	c.AppContext = c.AppContext.WithSession(session)

	auditRec.Success()
	c.LogAuditWithUserId(user.Id, "success")
	c.App.AttachSessionCookies(c.AppContext, w, r)

	if hasRedirectURL {
		if isMobile {
			// Mobile clients with redirect url support
			redirectURL = utils.AppendQueryParamsToURL(redirectURL, map[string]string{
				model.SessionCookieToken: c.AppContext.Session().Token,
				model.SessionCookieCsrf:  c.AppContext.Session().GetCSRF(),
			})
			utils.RenderMobileAuthComplete(w, redirectURL)
		} else {
			http.Redirect(w, r, redirectURL, http.StatusFound)
		}
		return
	}

	switch action {
	// Mobile clients with web view implementation
	case model.OAuthActionMobile:
		ReturnStatusOK(w)
	case model.OAuthActionEmailToSSO:
		http.Redirect(w, r, c.GetSiteURLHeader()+"/login?extra=signin_change", http.StatusFound)
	default:
		http.Redirect(w, r, c.GetSiteURLHeader(), http.StatusFound)
	}
}
