// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestSSOCodeChallenge(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	codeChallenge := "MWZhZmE2MGUwYWZjNDhiY2MwZDk1OTIwNWJlOTM3NmMxMTIwMjBlY2I0MTdjMzQ4M2MzYTJhN2U1NmIxYjM1Mg=="

	t.Run("Should create a SSO challenge token", func(t *testing.T) {
		token, err := th.App.CreateCodeChallengeToken(codeChallenge)
		assert.NoError(t, err)
		assert.NotNil(t, token)

		storedToken, storedErr := th.App.Srv().Store().Token().GetByToken(token.Token)
		assert.NoError(t, storedErr)
		assert.NotNil(t, storedToken)
	})

	t.Run("Should update a SSO token with session data", func(t *testing.T) {
		session := &model.Session{}
		session.PreSave()
		session.AddProp("csrf", model.NewId())
		token, _ := th.App.CreateCodeChallengeToken(codeChallenge)
		updatedErr := th.App.UpdateCodeChallengeToken(token.Token, session)
		assert.NoError(t, updatedErr)
	})

	t.Run("Should Verify the SSO token with the code verifier and return the session data", func(t *testing.T) {
		session := &model.Session{}
		session.PreSave()
		session.AddProp("csrf", model.NewId())
		codeVerifier := "ahSr2WU6srm7YMmQgRGQdtAAhCsjw0caFBxTfdfxckeHBtnlepANIebORcLkvitUxM8lDC71tnKFjaLM1SVsy2ZthajfiE8QPmus"
		token, _ := th.App.CreateCodeChallengeToken(codeChallenge)
		updatedErr := th.App.UpdateCodeChallengeToken(token.Token, session)
		assert.Nil(t, updatedErr)

		// Fail when verifier does not match
		failed, failedErr := th.App.VerifyCodeChallengeTokenAndGetSessionToken(token.Token, "codeVerifier")
		assert.Nil(t, failed)
		assert.Error(t, failedErr)

		sessionData, sessionErr := th.App.VerifyCodeChallengeTokenAndGetSessionToken(token.Token, codeVerifier)
		assert.NoError(t, sessionErr)
		assert.Contains(t, sessionData, "token")
		assert.Contains(t, sessionData, "csrf")
	})
}
