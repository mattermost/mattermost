package api4

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestGetTermsOfService(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, err := th.App.CreateTermsOfService("abc", th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	termsOfService, resp := Client.GetTermsOfService("")
	CheckNoError(t, resp)

	assert.NotNil(t, termsOfService)
	assert.Equal(t, "abc", termsOfService.Text)
	assert.NotEmpty(t, termsOfService.Id)
	assert.NotEmpty(t, termsOfService.CreateAt)
}

func TestCreateTermsOfService(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	termsOfService, resp := Client.CreateTermsOfService("terms of service new", th.BasicUser.Id)
	CheckErrorMessage(t, resp, "api.create_terms_of_service.custom_terms_of_service_disabled.app_error")

	// TODO refactor this to be terms of service
	th.App.SetLicense(model.NewTestLicense("EnableCustomTermsOfService"))

	termsOfService, resp = Client.CreateTermsOfService("terms of service new", th.BasicUser.Id)
	CheckNoError(t, resp)
	assert.NotEmpty(t, termsOfService.Id)
	assert.NotEmpty(t, termsOfService.CreateAt)
	assert.Equal(t, "terms of service new", termsOfService.Text)
	assert.Equal(t, th.BasicUser.Id, termsOfService.UserId)
}
