package app

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

type testWriter struct {
	write func(p []byte) (int, error)
}

func (tw testWriter) Write(p []byte) (int, error) {
	return tw.write(p)
}

func TestExportPermissions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	scheme, roles := th.CreateScheme()

	results := [][]byte{}

	tw := testWriter{
		write: func(p []byte) (int, error) {
			results = append(results, p)
			return len(p), nil
		},
	}

	err := th.App.ExportPermissions(tw)
	if err != nil {
		t.Error(err)
	}

	if len(results) == 0 {
		t.Error("Expected export to have returned something.")
	}

	firstResult := results[0]

	var row map[string]interface{}
	err = json.Unmarshal(firstResult, &row)
	if err != nil {
		t.Error(err)
	}

	getRoleByID := func(id string) string {
		for _, role := range roles {
			if role.Id == id {
				return role.Id
			}
		}
		return ""
	}

	expectations := map[string]func(str string) string{
		scheme.Name:                    func(str string) string { return row["name"].(string) },
		scheme.Description:             func(str string) string { return row["description"].(string) },
		scheme.Scope:                   func(str string) string { return row["scope"].(string) },
		scheme.DefaultTeamAdminRole:    func(str string) string { return getRoleByID(str) },
		scheme.DefaultTeamUserRole:     func(str string) string { return getRoleByID(str) },
		scheme.DefaultChannelAdminRole: func(str string) string { return getRoleByID(str) },
		scheme.DefaultChannelUserRole:  func(str string) string { return getRoleByID(str) },
	}

	for key, valF := range expectations {
		expected := key
		actual := valF(key)
		if actual != expected {
			t.Errorf("Expected %v but got %v.", expected, actual)
		}
	}

}

func TestImportPermissions(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	name := model.NewId()
	description := "my test description"
	scope := model.SCHEME_SCOPE_CHANNEL
	roleName1 := model.NewId()
	roleName2 := model.NewId()

	var appErr *model.AppError
	results, appErr := th.App.GetSchemes(scope, 0, 100)
	if appErr != nil {
		panic(appErr)
	}
	beforeCount := len(results)

	json := fmt.Sprintf(`{"name":"%v","description":"%v","scope":"%v","default_team_admin_role":"","default_team_user_role":"","default_channel_admin_role":"1x5nk4xxoinx88tynhe6f1fjeh","default_channel_user_role":"unuudyfc1jfwunznun5qx7m9br","roles":[{"id":"1x5nk4xxoinx88tynhe6f1fjeh","name":"%v","display_name":"Channel Admin Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502853,"update_at":1526078502853,"delete_at":0,"permissions":["manage_channel_roles"],"scheme_managed":true,"built_in":false},{"id":"unuudyfc1jfwunznun5qx7m9br","name":"%v","display_name":"Channel User Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502855,"update_at":1526078502855,"delete_at":0,"permissions":["read_channel","add_reaction","remove_reaction","manage_public_channel_members","upload_file","get_public_link","create_post","use_slash_commands","manage_private_channel_members","delete_post","edit_post"],"scheme_managed":true,"built_in":false}]}`, name, description, scope, roleName1, roleName2)
	r := strings.NewReader(json)

	err := th.App.ImportPermissions(r)
	if err != nil {
		t.Error(err)
	}

	results, appErr = th.App.GetSchemes(scope, 0, 100)
	if appErr != nil {
		panic(appErr)
	}

	actual := len(results)
	expected := beforeCount + 1
	if actual != expected {
		t.Errorf("Expected %v roles but got %v.", expected, actual)
	}

	newScheme := results[0]

	channelAdminRole, appErr := th.App.GetRole(newScheme.DefaultChannelAdminRole)
	if appErr != nil {
		t.Error(appErr)
	}

	channelUserRole, appErr := th.App.GetRole(newScheme.DefaultChannelUserRole)
	if appErr != nil {
		t.Error(appErr)
	}

	expectations := map[string]string{
		newScheme.Name:                 name,
		newScheme.Description:          description,
		newScheme.Scope:                scope,
		newScheme.DefaultTeamAdminRole: "",
		newScheme.DefaultTeamUserRole:  "",
		channelAdminRole.Name:          roleName1,
		channelUserRole.Name:           roleName2,
	}

	for actual, expected := range expectations {
		if actual != expected {
			t.Errorf("Expected %v but got %v.", expected, actual)
		}
	}

}

func TestImportPermissions_deletesOnFailure(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	name := model.NewId()
	description := "my test description"
	scope := model.SCHEME_SCOPE_CHANNEL
	roleName1 := model.NewId()
	roleName2 := model.NewId()

	json := fmt.Sprintf(`{"name":"%v","description":"%v","scope":"%v","default_team_admin_role":"","default_team_user_role":"","default_channel_admin_role":"1x5nk4xxoinx88tynhe6f1fjeh","default_channel_user_role":"unuudyfc1jfwunznun5qx7m9br","roles":[{"id":"1x5nk4xxoinx88tynhe6f1fjeh","name":"%v","display_name":"Channel Admin Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502853,"update_at":1526078502853,"delete_at":0,"permissions":["manage_channel_roles"],"scheme_managed":true,"built_in":false},{"id":"unuudyfc1jfwunznun5qx7m9br","name":"%v","display_name":"Channel User Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502855,"update_at":1526078502855,"delete_at":0,"permissions":["read_channel","add_reaction","remove_reaction","manage_public_channel_members","upload_file","get_public_link","create_post","use_slash_commands","manage_private_channel_members","delete_post","edit_post"],"scheme_managed":true,"built_in":false}]}
{"name":"a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"scheme test description 1526078503","scope":"channel","default_team_admin_role":"","default_team_user_role":"","default_channel_admin_role":"1x5nk4xxoinx88tynhe6f1fjeh","default_channel_user_role":"unuudyfc1jfwunznun5qx7m9br","roles":[{"id":"1x5nk4xxoinx88tynhe6f1fjeh","name":"ju5guemb3td47ny3e14tihoyqy","display_name":"Channel Admin Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502853,"update_at":1526078502853,"delete_at":0,"permissions":["manage_channel_roles"],"scheme_managed":true,"built_in":false},{"id":"unuudyfc1jfwunznun5qx7m9br","name":"6kwp5utosidwmpamw87xrrt9fe","display_name":"Channel User Role for Scheme a7c1ae93-e6a7-48f7-abb0-1e13fbda97ae","description":"","create_at":1526078502855,"update_at":1526078502855,"delete_at":0,"permissions":["read_channel","add_reaction","remove_reaction","manage_public_channel_members","upload_file","get_public_link","create_post","use_slash_commands","manage_private_channel_members","delete_post","edit_post"],"scheme_managed":true,"built_in":false}]}`, name, description, scope, roleName1, roleName2)
	jsonl := strings.Repeat(json+"\n", 2)
	r := strings.NewReader(jsonl)

	var appErr *model.AppError
	results, appErr := th.App.GetSchemes(model.SCHEME_SCOPE_CHANNEL, 0, 100)
	if appErr != nil {
		panic(appErr)
	}
	expected := len(results)

	err := th.App.ImportPermissions(r)
	if err == nil {
		t.Error(err)
	}

	results, appErr = th.App.GetSchemes(model.SCHEME_SCOPE_CHANNEL, 0, 100)
	if appErr != nil {
		panic(appErr)
	}
	actual := len(results)

	if expected != actual {
		t.Errorf("Expected count to be %v but got %v", expected, actual)
	}

}
