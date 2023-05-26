// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/einterfaces/mocks"
)

func TestGetSamlMetadata(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	_, resp, err := client.GetSamlMetadata()
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)

	// Rest is tested by enterprise tests
}

func TestSamlCompleteCSRFPass(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	url := th.Client.URL + "/login/sso/saml"
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return
	}

	cookie1 := &http.Cookie{
		Name:  model.SessionCookieUser,
		Value: th.BasicUser.Username,
	}
	cookie2 := &http.Cookie{
		Name:  model.SessionCookieToken,
		Value: th.Client.AuthToken,
	}
	req.AddCookie(cookie1)
	req.AddCookie(cookie2)

	client := &http.Client{}
	resp, err := client.Do(req)
	require.NoError(t, err)
	require.NotEqual(t, http.StatusUnauthorized, resp.StatusCode)
	defer resp.Body.Close()
}

func TestSamlResetId(t *testing.T) {
	th := SetupEnterprise(t).InitBasic()
	defer th.TearDown()
	th.App.Channels().Saml = &mocks.SamlInterface{}

	user := th.BasicUser
	_, appErr := th.App.UpdateUserAuth(user.Id, &model.UserAuth{
		AuthData:    model.NewString(model.NewId()),
		AuthService: model.UserAuthServiceSaml,
	})
	require.Nil(t, appErr)

	_, resp, err := th.Client.ResetSamlAuthDataToEmail(false, false, nil)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	numAffected, resp, err := th.SystemAdminClient.ResetSamlAuthDataToEmail(false, false, nil)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Equal(t, int64(1), numAffected)
}
