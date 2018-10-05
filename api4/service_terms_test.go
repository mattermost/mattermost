package api4

import (
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"testing"
)

func TestGetServiceTerms(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, err := th.App.CreateServiceTerms("abc", th.BasicUser.Id)
	if err != nil {
		t.Fatal(err)
	}

	serviceTerms, resp := Client.GetServiceTerms("")
	CheckNoError(t, resp)

	assert.NotNil(t, serviceTerms)
	assert.Equal(t, "abc", serviceTerms.Text)
	assert.NotEmpty(t, serviceTerms.Id)
	assert.NotEmpty(t, serviceTerms.CreateAt)
}

func TestCreateServiceTerms(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.CreateServiceTerms("service terms new", th.BasicUser.Id)
	CheckErrorMessage(t, resp, "api.context.permissions.app_error")
}

func TestCreateServiceTermsAdminUser(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()
	Client := th.SystemAdminClient

	serviceTerms, resp := Client.CreateServiceTerms("service terms new", th.SystemAdminUser.Id)
	CheckErrorMessage(t, resp, "api.create_service_terms.custom_service_terms_disabled.app_error")

	th.App.SetLicense(model.NewTestLicense("EnableCustomServiceTerms"))

	serviceTerms, resp = Client.CreateServiceTerms("service terms new_2", th.SystemAdminUser.Id)
	CheckNoError(t, resp)
	assert.NotEmpty(t, serviceTerms.Id)
	assert.NotEmpty(t, serviceTerms.CreateAt)
	assert.Equal(t, "service terms new_2", serviceTerms.Text)
	assert.Equal(t, th.SystemAdminUser.Id, serviceTerms.UserId)
}
