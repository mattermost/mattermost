package api4

import (
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
