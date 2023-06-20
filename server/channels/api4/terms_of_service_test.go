// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestGetTermsOfService(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	_, appErr := th.App.CreateTermsOfService("abc", th.BasicUser.Id)
	require.Nil(t, appErr)

	termsOfService, _, err := client.GetTermsOfService(context.Background(), "")
	require.NoError(t, err)

	assert.NotNil(t, termsOfService)
	assert.Equal(t, "abc", termsOfService.Text)
	assert.NotEmpty(t, termsOfService.Id)
	assert.NotEmpty(t, termsOfService.CreateAt)
}

func TestCreateTermsOfService(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.Client

	_, _, err := client.CreateTermsOfService(context.Background(), "terms of service new", th.BasicUser.Id)
	CheckErrorID(t, err, "api.context.permissions.app_error")
}

func TestCreateTermsOfServiceAdminUser(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	client := th.SystemAdminClient

	termsOfService, _, err := client.CreateTermsOfService(context.Background(), "terms of service new", th.SystemAdminUser.Id)
	CheckErrorID(t, err, "api.create_terms_of_service.custom_terms_of_service_disabled.app_error")
	assert.Nil(t, termsOfService)

	th.App.Srv().SetLicense(model.NewTestLicense("EnableCustomTermsOfService"))

	termsOfService, _, err = client.CreateTermsOfService(context.Background(), "terms of service new_2", th.SystemAdminUser.Id)
	require.NoError(t, err)
	assert.NotEmpty(t, termsOfService.Id)
	assert.NotEmpty(t, termsOfService.CreateAt)
	assert.Equal(t, "terms of service new_2", termsOfService.Text)
	assert.Equal(t, th.SystemAdminUser.Id, termsOfService.UserId)
}
