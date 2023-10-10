// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

func (a *App) CreateCodeChallengeToken(codeChallenge string) (*model.Token, *model.AppError) {
	extraProps, extraErr := json.Marshal(map[string]string{"code_challenge": codeChallenge})
	if extraErr != nil {
		return nil, model.NewAppError("App.CreateCodeChallengeToken", "api.oauth.store_code_challenge", nil, "", http.StatusInternalServerError).Wrap(extraErr)
	}
	token := model.NewToken("code_challenge", string(extraProps))
	if err := a.Srv().Store().Token().Save(token); err != nil {
		var appErr *model.AppError
		switch {
		case errors.As(err, &appErr):
			return nil, model.NewAppError("App.CreateCodeChallengeToken", "api.oauth.store_code_challenge", nil, "", http.StatusInternalServerError).Wrap(appErr)
		default:
			return nil, model.NewAppError("App.CreateCodeChallengeToken", "api.oauth.store_code_challenge", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return token, nil
}

func (a *App) UpdateCodeChallengeToken(codeChallengeToken string, session *model.Session) *model.AppError {
	token, err := a.Srv().Store().Token().GetByCodeChallengeToken(codeChallengeToken)
	if err != nil {
		return model.NewAppError("App.UpdateCodeChallengeToken", "api.oauth.store_code_challenge", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var extraMap = map[string]string{}
	if err := json.Unmarshal([]byte(token.Extra), &extraMap); err != nil {
		return model.NewAppError("App.UpdateCodeChallengeToken", "api.oauth.store_code_challenge_session", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	extraMap["token"] = session.Token
	extraMap["csrf"] = session.GetCSRF()
	extraProps, extraErr := json.Marshal(extraMap)
	if extraErr != nil {
		return model.NewAppError("Api4.completeOAuth", "api.oauth.store_code_challenge_session", nil, "", http.StatusInternalServerError).Wrap(extraErr)
	}

	if err := a.Srv().Store().Token().UpdateExtra(token.Token, string(extraProps)); err != nil {
		return model.NewAppError("Api4.completeOAuth", "api.oauth.store_code_challenge_session", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func (a *App) VerifyCodeChallengeTokenAndGetSessionToken(codeChallengeToken, codeVerifier string) (map[string]string, *model.AppError) {
	codeChallenge := codeChallengeFromCodeVerifier(codeVerifier)

	token, err := a.Srv().Store().Token().GetByCodeChallengeToken(codeChallengeToken)
	if err != nil {
		return nil, model.NewAppError("App.VerifyCodeChallengeTokenAndGetSessionToken", "api.oauth.verify_code_challenge", nil, "", http.StatusBadRequest).Wrap(err)
	}

	var extraMap = map[string]string{}
	if err := json.Unmarshal([]byte(token.Extra), &extraMap); err != nil {
		return nil, model.NewAppError("App.VerifyCodeChallengeTokenAndGetSessionToken", "api.oauth.verify_code_challenge", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if subtle.ConstantTimeCompare([]byte(codeChallenge), []byte(extraMap["code_challenge"])) == 0 {
		return nil, model.NewAppError("App.VerifyCodeChallengeTokenAndGetSessionToken", "api.oauth.verify_code_challenge", nil, "", http.StatusBadRequest)
	}

	delete(extraMap, "code_challenge")

	return extraMap, nil
}

func codeChallengeFromCodeVerifier(codeVerifier string) string {
	hash := sha256.New()
	hash.Write([]byte(codeVerifier))
	return base64.StdEncoding.EncodeToString([]byte(hex.EncodeToString(hash.Sum(nil))))
}
