// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	b64 "encoding/base64"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

func (w *Web) InitSaml() {
	w.MainRouter.Handle("/login/sso/saml", w.NewHandler(loginWithSaml)).Methods("GET")
	w.MainRouter.Handle("/login/sso/saml", w.NewHandler(completeSaml)).Methods("POST")
}

func loginWithSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := c.App.Saml

	if samlInterface == nil {
		c.Err = model.NewAppError("loginWithSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
		return
	}

	teamId, err := c.App.GetTeamIdFromQuery(r.URL.Query())
	if err != nil {
		c.Err = err
		return
	}
	action := r.URL.Query().Get("action")
	redirectTo := r.URL.Query().Get("redirect_to")
	extensionId := r.URL.Query().Get("extension_id")
	relayProps := map[string]string{}
	relayState := ""

	if len(action) != 0 {
		relayProps["team_id"] = teamId
		relayProps["action"] = action
		if action == model.OAUTH_ACTION_EMAIL_TO_SSO {
			relayProps["email"] = r.URL.Query().Get("email")
		}
	}

	if len(redirectTo) != 0 {
		relayProps["redirect_to"] = redirectTo
	}

	if len(extensionId) != 0 {
		relayProps["extension_id"] = extensionId
		err := c.App.ValidateExtension(extensionId)
		if err != nil {
			c.Err = err
			return
		}
	}

	if len(relayProps) > 0 {
		relayState = b64.StdEncoding.EncodeToString([]byte(model.MapToJson(relayProps)))
	}

	if data, err := samlInterface.BuildRequest(relayState); err != nil {
		c.Err = err
		return
	} else {
		w.Header().Set("Content-Type", "application/x-www-form-urlencoded")
		http.Redirect(w, r, data.URL, http.StatusFound)
	}
}

func completeSaml(c *Context, w http.ResponseWriter, r *http.Request) {
	samlInterface := c.App.Saml

	if samlInterface == nil {
		c.Err = model.NewAppError("completeSaml", "api.user.saml.not_available.app_error", nil, "", http.StatusFound)
		return
	}

	//Validate that the user is with SAML and all that
	encodedXML := r.FormValue("SAMLResponse")
	relayState := r.FormValue("RelayState")

	relayProps := make(map[string]string)
	if len(relayState) > 0 {
		stateStr := ""
		if b, err := b64.StdEncoding.DecodeString(relayState); err != nil {
			c.Err = model.NewAppError("completeSaml", "api.user.authorize_oauth_user.invalid_state.app_error", nil, err.Error(), http.StatusFound)
			return
		} else {
			stateStr = string(b)
		}
		relayProps = model.MapFromJson(strings.NewReader(stateStr))
	}

	action := relayProps["action"]
	if user, err := samlInterface.DoLogin(encodedXML, relayProps); err != nil {
		if action == model.OAUTH_ACTION_MOBILE {
			err.Translate(c.T)
			w.Write([]byte(err.ToJson()))
		} else {
			c.Err = err
			c.Err.StatusCode = http.StatusFound
		}
		return
	} else {
		if err := c.App.CheckUserAllAuthenticationCriteria(user, ""); err != nil {
			c.Err = err
			c.Err.StatusCode = http.StatusFound
			return
		}

		switch action {
		case model.OAUTH_ACTION_SIGNUP:
			teamId := relayProps["team_id"]
			if len(teamId) > 0 {
				c.App.Go(func() {
					if err := c.App.AddUserToTeamByTeamId(teamId, user); err != nil {
						mlog.Error(err.Error())
					} else {
						c.App.AddDirectChannels(teamId, user)
					}
				})
			}
		case model.OAUTH_ACTION_EMAIL_TO_SSO:
			if err := c.App.RevokeAllSessions(user.Id); err != nil {
				c.Err = err
				return
			}
			c.LogAuditWithUserId(user.Id, "Revoked all sessions for user")
			c.App.Go(func() {
				if err := c.App.SendSignInChangeEmail(user.Email, strings.Title(model.USER_AUTH_SERVICE_SAML)+" SSO", user.Locale, c.App.GetSiteURL()); err != nil {
					mlog.Error(err.Error())
				}
			})
		}

		session, err := c.App.DoLogin(w, r, user, "")
		if err != nil {
			c.Err = err
			return
		}

		c.Session = *session

		if val, ok := relayProps["redirect_to"]; ok {
			http.Redirect(w, r, c.GetSiteURLHeader()+val, http.StatusFound)
			return
		}

		if action == model.OAUTH_ACTION_MOBILE {
			ReturnStatusOK(w)
		} else if action == model.OAUTH_ACTION_CLIENT {
			err = c.App.SendMessageToExtension(w, relayProps["extension_id"], c.Session.Token)

			if err != nil {
				c.Err = err
				return
			}
		} else {
			http.Redirect(w, r, c.GetSiteURLHeader(), http.StatusFound)
		}
	}
}
