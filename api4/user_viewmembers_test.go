package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestResctrictedSearchUsers(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	testCases := []struct {
		Name                  string
		Restrictions          *model.ViewUsersRestrictions
		SearchParam           string
		SearchExpectedResults []string
	}{
		{
			"without restrictions",
			nil,
			"test",
			[]string{"123", "456"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
		})
	}
}
