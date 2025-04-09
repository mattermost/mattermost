// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestImportValidateSchemeImportData(t *testing.T) {
	// Test with minimum required valid properties and team scope.
	data := SchemeImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Scope:       model.NewPointer("team"),
		DefaultTeamAdminRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
		DefaultTeamUserRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
		DefaultTeamGuestRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
		DefaultChannelAdminRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
		DefaultChannelUserRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
		DefaultChannelGuestRole: &RoleImportData{
			Name:        model.NewPointer("name"),
			DisplayName: model.NewPointer("display name"),
			Permissions: &[]string{"invite_user"},
		},
	}

	err := ValidateSchemeImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with various invalid names.
	data.Name = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	// Test with empty string
	data.Name = model.NewPointer("")
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	// Test with numbers
	data.Name = model.NewPointer(strings.Repeat("1234567890", 100))
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	data.Name = model.NewPointer("name")

	// Test with invalid display name.
	data.DisplayName = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	// Test with display name.
	data.DisplayName = model.NewPointer("")
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	// Test display name with numbers
	data.DisplayName = model.NewPointer(strings.Repeat("1234567890", 100))
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	data.DisplayName = model.NewPointer("display name")

	// Test with various missing roles.
	data.DefaultTeamAdminRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing role.")

	data.DefaultTeamAdminRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}

	data.DefaultTeamUserRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing role.")

	data.DefaultTeamUserRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}
	data.DefaultChannelAdminRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing role.")

	data.DefaultChannelAdminRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}
	data.DefaultChannelUserRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing role.")

	data.DefaultChannelUserRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}

	// Test with various invalid roles.
	data.DefaultTeamAdminRole.Name = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid role.")

	data.DefaultTeamAdminRole.Name = model.NewPointer("name")
	data.DefaultTeamUserRole.Name = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid role.")

	data.DefaultTeamUserRole.Name = model.NewPointer("name")
	data.DefaultChannelAdminRole.Name = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid role.")

	data.DefaultChannelAdminRole.Name = model.NewPointer("name")
	data.DefaultChannelUserRole.Name = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid role.")

	data.DefaultChannelUserRole.Name = model.NewPointer("name")

	// Change to a Channel scope role, and check with missing or extra roles again.
	data.Scope = model.NewPointer("channel")
	data.DefaultTeamAdminRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to spurious role.")

	data.DefaultTeamAdminRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}
	data.DefaultTeamUserRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to spurious role.")

	data.DefaultTeamUserRole = &RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
		Permissions: &[]string{"invite_user"},
	}
	data.DefaultTeamGuestRole = nil
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to spurious role.")

	data.DefaultTeamGuestRole = nil
	data.DefaultTeamUserRole = nil
	data.DefaultTeamAdminRole = nil
	err = ValidateSchemeImportData(&data)
	require.Nil(t, err, "Should have succeeded.")

	// Test with all combinations of optional parameters.
	data.Description = model.NewPointer(strings.Repeat("1234567890", 1024))
	err = ValidateSchemeImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid description.")

	data.Description = model.NewPointer("description")
	err = ValidateSchemeImportData(&data)
	require.Nil(t, err, "Should have succeeded.")
}

func TestImportValidateRoleImportData(t *testing.T) {
	// Test with minimum required valid properties.
	data := RoleImportData{
		Name:        model.NewPointer("name"),
		DisplayName: model.NewPointer("display name"),
	}
	err := ValidateRoleImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with various invalid names.
	data.Name = nil
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	data.Name = model.NewPointer("")
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	data.Name = model.NewPointer(strings.Repeat("1234567890", 100))
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	data.Name = model.NewPointer("name")

	// Test with invalid display name.
	data.DisplayName = nil
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	data.DisplayName = model.NewPointer("")
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	data.DisplayName = model.NewPointer(strings.Repeat("1234567890", 100))
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid display name.")

	data.DisplayName = model.NewPointer("display name")

	// Test with various valid/invalid permissions.
	data.Permissions = &[]string{}
	err = ValidateRoleImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	data.Permissions = &[]string{"invite_user", "add_user_to_team"}
	err = ValidateRoleImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	data.Permissions = &[]string{"invite_user", "add_user_to_team", "derp"}
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid permission.")

	data.Permissions = &[]string{"invite_user", "add_user_to_team"}

	// Test with various valid/invalid descriptions.
	data.Description = model.NewPointer(strings.Repeat("1234567890", 1024))
	err = ValidateRoleImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid description.")

	data.Description = model.NewPointer("description")
	err = ValidateRoleImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")
}

func TestImportValidateTeamImportData(t *testing.T) {
	// Test with minimum required valid properties.
	data := TeamImportData{
		Name:        model.NewPointer("teamname"),
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}
	err := ValidateTeamImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with various invalid names.
	data = TeamImportData{
		DisplayName: model.NewPointer("Display Name"),
		Type:        model.NewPointer("O"),
	}
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing name.")

	data.Name = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long name.")

	data.Name = model.NewPointer("login")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to reserved word in name.")

	data.Name = model.NewPointer("Test::''ASD")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to non alphanum characters in name.")

	data.Name = model.NewPointer("A")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to short name.")

	// Test team various invalid display names.
	data = TeamImportData{
		Name: model.NewPointer("teamname"),
		Type: model.NewPointer("O"),
	}
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing display_name.")

	data.DisplayName = model.NewPointer("")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to empty display_name.")

	data.DisplayName = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long display_name.")

	// Test with various valid and invalid types.
	data = TeamImportData{
		Name:        model.NewPointer("teamname"),
		DisplayName: model.NewPointer("Display Name"),
	}
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing type.")

	data.Type = model.NewPointer("A")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid type.")

	data.Type = model.NewPointer("I")
	err = ValidateTeamImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid type.")

	// Test with all the combinations of optional parameters.
	data = TeamImportData{
		Name:            model.NewPointer("teamname"),
		DisplayName:     model.NewPointer("Display Name"),
		Type:            model.NewPointer("O"),
		Description:     model.NewPointer("The team description."),
		AllowOpenInvite: model.NewPointer(true),
	}
	err = ValidateTeamImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid optional properties.")

	data.AllowOpenInvite = model.NewPointer(false)
	err = ValidateTeamImportData(&data)
	require.Nil(t, err, "Should have succeeded with allow open invites false.")

	data.Description = model.NewPointer(strings.Repeat("abcdefghij ", 26))
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long description.")

	// Test with an empty scheme name.
	data.Description = model.NewPointer("abcdefg")
	data.Scheme = model.NewPointer("")
	err = ValidateTeamImportData(&data)
	require.NotNil(t, err, "Should have failed due to empty scheme name.")

	// Test with a valid scheme name.
	data.Scheme = model.NewPointer("abcdefg")
	err = ValidateTeamImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid scheme name.")
}

func TestImportValidateChannelImportData(t *testing.T) {
	// Test with minimum required valid properties.
	chanTypeOpen := model.ChannelTypeOpen
	data := ChannelImportData{
		Team:        model.NewPointer("teamname"),
		Name:        model.NewPointer("channelname"),
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}
	err := ValidateChannelImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with missing team.
	data = ChannelImportData{
		Name:        model.NewPointer("channelname"),
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing team.")

	// Test with various invalid names.
	data = ChannelImportData{
		Team:        model.NewPointer("teamname"),
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
	}
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing name.")

	data.Name = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long name.")

	data.Name = model.NewPointer("Test::''ASD")
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to non alphanum characters in name.")

	data.Name = model.NewPointer("A")
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should not have failed due to uppercased name.")

	// Test team various invalid display names.
	data = ChannelImportData{
		Team: model.NewPointer("teamname"),
		Name: model.NewPointer("channelname"),
		Type: &chanTypeOpen,
	}
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should have accepted having an empty display_name.")
	require.Equal(t, data.Name, data.DisplayName, "Name and DisplayName should be the same if DisplayName is missing")

	data.DisplayName = model.NewPointer("")
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should have accepted having an empty display_name.")
	require.Equal(t, data.Name, data.DisplayName, "Name and DisplayName should be the same if DisplayName is missing")

	data.DisplayName = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long display_name.")

	// Test with various valid and invalid types.
	data = ChannelImportData{
		Team:        model.NewPointer("teamname"),
		Name:        model.NewPointer("channelname"),
		DisplayName: model.NewPointer("Display Name"),
	}
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to missing type.")

	invalidType := model.ChannelType("A")
	data.Type = &invalidType
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid type.")

	chanTypePr := model.ChannelTypePrivate
	data.Type = &chanTypePr
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid type.")

	// Test with all the combinations of optional parameters.
	data = ChannelImportData{
		Team:        model.NewPointer("teamname"),
		Name:        model.NewPointer("channelname"),
		DisplayName: model.NewPointer("Display Name"),
		Type:        &chanTypeOpen,
		Header:      model.NewPointer("Channel Header Here"),
		Purpose:     model.NewPointer("Channel Purpose Here"),
	}
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid optional properties.")

	data.Header = model.NewPointer(strings.Repeat("abcdefghij ", 103))
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long header.")

	data.Header = model.NewPointer("Channel Header Here")
	data.Purpose = model.NewPointer(strings.Repeat("abcdefghij ", 26))
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long purpose.")

	// Test with an empty scheme name.
	data.Purpose = model.NewPointer("abcdefg")
	data.Scheme = model.NewPointer("")
	err = ValidateChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to empty scheme name.")

	// Test with a valid scheme name.
	data.Scheme = model.NewPointer("abcdefg")
	err = ValidateChannelImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid scheme name.")
}

func TestImportValidateUserImportData(t *testing.T) {
	// Test with minimum required valid properties.
	data := UserImportData{
		Username: model.NewPointer("bob"),
		Email:    model.NewPointer("bob@example.com"),
	}
	err := ValidateUserImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Invalid Usernames.
	data.Username = nil
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to nil Username.")

	data.Username = model.NewPointer("")
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to 0 length Username.")

	data.Username = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long Username.")

	data.Username = model.NewPointer("i am a username with spaces and !!!")
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid characters in Username.")

	data.Username = model.NewPointer("bob")

	// Unexisting Picture Image
	data.ProfileImage = model.NewPointer("not-existing-file")
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to not existing profile image file.")

	data.ProfileImage = nil

	// Invalid Emails
	data.Email = nil
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to nil Email.")

	data.Email = model.NewPointer("")
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to 0 length Email.")

	data.Email = model.NewPointer(strings.Repeat("abcdefghij", 13))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long Email.")

	data.Email = model.NewPointer("bob@example.com")

	// Empty AuthService indicates user/password auth.
	data.AuthService = model.NewPointer("")
	checkNoError(t, ValidateUserImportData(&data))

	data.AuthService = model.NewPointer("saml")
	data.AuthData = model.NewPointer(strings.Repeat("abcdefghij", 15))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long auth data.")

	data.AuthData = model.NewPointer("bobbytables")
	err = ValidateUserImportData(&data)
	require.Nil(t, err, "Validation should have succeeded with valid auth service and auth data.")

	// Test a valid User with all fields populated.
	testsDir, _ := fileutils.FindDir("tests")
	data = UserImportData{
		Avatar: Avatar{
			ProfileImage: model.NewPointer(filepath.Join(testsDir, "test.png")),
		},
		Username:    model.NewPointer("bob"),
		Email:       model.NewPointer("bob@example.com"),
		AuthService: model.NewPointer("ldap"),
		AuthData:    model.NewPointer("bob"),
		Nickname:    model.NewPointer("BobNick"),
		FirstName:   model.NewPointer("Bob"),
		LastName:    model.NewPointer("Blob"),
		Position:    model.NewPointer("The Boss"),
		Roles:       model.NewPointer("system_user"),
		Locale:      model.NewPointer("en"),
	}
	err = ValidateUserImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with not-all lowercase username
	data.Username = model.NewPointer("Bob")
	err = ValidateUserImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid even the username has uppercase letters.")

	// Test various invalid optional field values.
	data.Nickname = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long Nickname.")

	data.Nickname = model.NewPointer("BobNick")

	data.FirstName = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long First Name.")

	data.FirstName = model.NewPointer("Bob")

	data.LastName = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long Last name.")

	data.LastName = model.NewPointer("Blob")

	data.Position = model.NewPointer(strings.Repeat("abcdefghij", 13))
	err = ValidateUserImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to too long Position.")

	data.Position = model.NewPointer("The Boss")

	data.Roles = nil
	err = ValidateUserImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	data.Roles = model.NewPointer("")
	err = ValidateUserImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	data.Roles = model.NewPointer("system_user")

	// Try various valid/invalid notify props.
	data.NotifyProps = &UserNotifyPropsImportData{}

	data.NotifyProps.Desktop = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.Desktop = model.NewPointer(model.UserNotifyAll)
	data.NotifyProps.DesktopSound = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.DesktopSound = model.NewPointer("true")
	data.NotifyProps.Email = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.Email = model.NewPointer("true")
	data.NotifyProps.Mobile = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.Mobile = model.NewPointer(model.UserNotifyAll)
	data.NotifyProps.MobilePushStatus = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.MobilePushStatus = model.NewPointer(model.StatusOnline)
	data.NotifyProps.ChannelTrigger = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.ChannelTrigger = model.NewPointer("true")
	data.NotifyProps.CommentsTrigger = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.NotifyProps.CommentsTrigger = model.NewPointer(model.CommentsNotifyRoot)
	data.NotifyProps.MentionKeys = model.NewPointer("valid")
	checkNoError(t, ValidateUserImportData(&data))

	//Test the email batching interval validators
	//Happy paths
	data.EmailInterval = model.NewPointer("immediately")
	checkNoError(t, ValidateUserImportData(&data))

	data.EmailInterval = model.NewPointer("fifteen")
	checkNoError(t, ValidateUserImportData(&data))

	data.EmailInterval = model.NewPointer("hour")
	checkNoError(t, ValidateUserImportData(&data))

	//Invalid values
	data.EmailInterval = model.NewPointer("invalid")
	checkError(t, ValidateUserImportData(&data))

	data.EmailInterval = model.NewPointer("")
	checkError(t, ValidateUserImportData(&data))
}

func TestImportValidateUserAuth(t *testing.T) {
	tests := []struct {
		authService *string
		authData    *string
		isValid     bool
	}{
		{nil, nil, true},
		{model.NewPointer(""), model.NewPointer(""), true},
		{model.NewPointer("foo"), model.NewPointer("foo"), false},
		{nil, model.NewPointer(""), true},
		{model.NewPointer(""), nil, true},
		{model.NewPointer(model.ServiceOpenid), model.NewPointer("foo@bar.baz"), true},

		{model.NewPointer("foo"), nil, false},
		{model.NewPointer("foo"), model.NewPointer(""), false},
		{nil, model.NewPointer("foo"), false},
		{model.NewPointer(""), model.NewPointer("foo"), false},
	}

	for _, test := range tests {
		data := UserImportData{
			Username:    model.NewPointer("bob"),
			Email:       model.NewPointer("bob@example.com"),
			AuthService: test.authService,
			AuthData:    test.authData,
		}
		err := ValidateUserImportData(&data)

		if test.isValid {
			require.Nil(t, err, fmt.Sprintf("authService: %v, authData: %v", test.authService, test.authData))
		} else {
			require.NotNil(t, err, fmt.Sprintf("authService: %v, authData: %v", test.authService, test.authData))
		}
	}
}

func TestImportValidateBotImportData(t *testing.T) {
	// Test with minimum required valid properties.
	data := BotImportData{
		Username:    model.NewPointer("bob"),
		DisplayName: model.NewPointer("Display Name"),
		Owner:       model.NewPointer("owner"),
	}
	err := ValidateBotImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with not-all lowercase username
	data.Username = model.NewPointer("Bob")
	err = ValidateBotImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid even the username has uppercase letters.")

	// Test with various invalid names.
	data.Username = nil
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to nil Username.")

	data.Username = model.NewPointer("")
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to 0 length Username.")

	data.Username = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long Username.")

	data.Username = model.NewPointer("i am a username with spaces and !!!")
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid characters in Username.")

	data.Username = model.NewPointer("bob")

	// Invalid Display Name.
	data.DisplayName = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long DisplayName.")

	data.DisplayName = model.NewPointer("Display Name")

	// Invalid Owner Name.
	data.Owner = nil
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long DisplayName.")

	data.Owner = model.NewPointer("")
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long DisplayName.")

	data.Owner = model.NewPointer(strings.Repeat("abcdefghij", 7))
	err = ValidateBotImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long OwnerID.")
}

func TestImportValidateUserTeamsImportData(t *testing.T) {
	// Invalid Name.
	data := []UserTeamImportData{
		{
			Roles: model.NewPointer("team_admin team_user"),
		},
	}
	err := ValidateUserTeamsImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")

	data[0].Name = model.NewPointer("teamname")

	// Valid (nil roles)
	data[0].Roles = nil
	err = ValidateUserTeamsImportData(&data)
	require.Nil(t, err, "Should have succeeded with empty roles.")

	// Valid (empty roles)
	data[0].Roles = model.NewPointer("")
	err = ValidateUserTeamsImportData(&data)
	require.Nil(t, err, "Should have succeeded with empty roles.")

	// Valid (with roles)
	data[0].Roles = model.NewPointer("team_admin team_user")
	err = ValidateUserTeamsImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid roles.")

	// Valid (with JSON string of theme)
	data[0].Theme = model.NewPointer(`{"awayIndicator":"#DBBD4E","buttonBg":"#23A1FF","buttonColor":"#FFFFFF","centerChannelBg":"#ffffff","centerChannelColor":"#333333","codeTheme":"github","image":"/static/files/a4a388b38b32678e83823ef1b3e17766.png","linkColor":"#2389d7","mentionBg":"#2389d7","mentionColor":"#ffffff","mentionHighlightBg":"#fff2bb","mentionHighlightLink":"#2f81b7","newMessageSeparator":"#FF8800","onlineIndicator":"#7DBE00","sidebarBg":"#fafafa","sidebarHeaderBg":"#3481B9","sidebarHeaderTextColor":"#ffffff","sidebarText":"#333333","sidebarTextActiveBorder":"#378FD2","sidebarTextActiveColor":"#111111","sidebarTextHoverBg":"#e6f2fa","sidebarUnreadText":"#333333","type":"Mattermost"}`)
	err = ValidateUserTeamsImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid theme.")

	// Invalid (invalid JSON string of theme)
	data[0].Theme = model.NewPointer(`This is the invalid string which cannot be marshalled to JSON object :) + {"#DBBD4E","buttonBg", "#23A1FF", buttonColor`)
	err = ValidateUserTeamsImportData(&data)
	require.NotNil(t, err, "Should have fail with invalid JSON string of theme.")

	// Invalid (valid JSON but invalid theme description)
	data[0].Theme = model.NewPointer(`{"somekey": 25, "json_obj1": {"color": "#DBBD4E","buttonBg": "#23A1FF"}}`)
	err = ValidateUserTeamsImportData(&data)
	require.NotNil(t, err, "Should have fail with valid JSON which contains invalid string of theme description.")

	data[0].Theme = nil
}

func TestImportValidateUserChannelsImportData(t *testing.T) {
	// Invalid Name.
	data := []UserChannelImportData{
		{
			Roles: model.NewPointer("channel_admin channel_user"),
		},
	}
	err := ValidateUserChannelsImportData(&data)
	require.NotNil(t, err, "Should have failed due to invalid name.")
	data[0].Name = model.NewPointer("channelname")

	// Valid (nil roles)
	data[0].Roles = nil
	err = ValidateUserChannelsImportData(&data)
	require.Nil(t, err, "Should have succeeded with empty roles.")

	// Valid (empty roles)
	data[0].Roles = model.NewPointer("")
	err = ValidateUserChannelsImportData(&data)
	require.Nil(t, err, "Should have succeeded with empty roles.")

	// Valid (with roles)
	data[0].Roles = model.NewPointer("channel_admin channel_user")
	err = ValidateUserChannelsImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid roles.")

	// Empty notify props.
	data[0].NotifyProps = &UserChannelNotifyPropsImportData{}
	err = ValidateUserChannelsImportData(&data)
	require.Nil(t, err, "Should have succeeded with empty notify props.")

	// Invalid desktop notify props.
	data[0].NotifyProps.Desktop = model.NewPointer("invalid")
	err = ValidateUserChannelsImportData(&data)
	require.NotNil(t, err, "Should have failed with invalid desktop notify props.")

	// Invalid mobile notify props.
	data[0].NotifyProps.Desktop = model.NewPointer("mention")
	data[0].NotifyProps.Mobile = model.NewPointer("invalid")
	err = ValidateUserChannelsImportData(&data)
	require.NotNil(t, err, "Should have failed with invalid mobile notify props.")

	// Invalid mark_unread notify props.
	data[0].NotifyProps.Mobile = model.NewPointer("mention")
	data[0].NotifyProps.MarkUnread = model.NewPointer("invalid")
	err = ValidateUserChannelsImportData(&data)
	require.NotNil(t, err, "Should have failed with invalid mark_unread notify props.")

	// Valid notify props.
	data[0].NotifyProps.MarkUnread = model.NewPointer("mention")
	err = ValidateUserChannelsImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid notify props.")
}

func TestImportValidateReactionImportData(t *testing.T) {
	// Test with minimum required valid properties.
	parentCreateAt := model.GetMillis() - 100
	data := ReactionImportData{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer("emoji"),
		CreateAt:  model.NewPointer(model.GetMillis()),
	}
	err := ValidateReactionImportData(&data, parentCreateAt)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with missing required properties.
	data = ReactionImportData{
		EmojiName: model.NewPointer("emoji"),
		CreateAt:  model.NewPointer(model.GetMillis()),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = ReactionImportData{
		User:     model.NewPointer("username"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = ReactionImportData{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer("emoji"),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	// Test with invalid emoji name.
	data = ReactionImportData{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer(strings.Repeat("1234567890", 500)),
		CreateAt:  model.NewPointer(model.GetMillis()),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due to too long emoji name.")

	// Test with invalid CreateAt
	data = ReactionImportData{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer("emoji"),
		CreateAt:  model.NewPointer(int64(0)),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due to 0 create-at value.")

	data = ReactionImportData{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer("emoji"),
		CreateAt:  model.NewPointer(parentCreateAt - 100),
	}
	err = ValidateReactionImportData(&data, parentCreateAt)
	require.NotNil(t, err, "Should have failed due parent with newer create-at value.")
}

func TestImportValidateReplyImportData(t *testing.T) {
	// Test with minimum required valid properties.
	parentCreateAt := model.GetMillis() - 100
	maxPostSize := 10000
	data := ReplyImportData{
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err := ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with missing required properties.
	data = ReplyImportData{
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = ReplyImportData{
		User:     model.NewPointer("username"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = ReplyImportData{
		User:    model.NewPointer("username"),
		Message: model.NewPointer("message"),
	}
	err = ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	// Test with invalid message.
	data = ReplyImportData{
		User:     model.NewPointer("username"),
		Message:  model.NewPointer(strings.Repeat("0", maxPostSize+1)),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.NotNil(t, err, "Should have failed due to too long message.")

	// Test with invalid CreateAt
	data = ReplyImportData{
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(int64(0)),
	}
	err = ValidateReplyImportData(&data, parentCreateAt, maxPostSize)
	require.NotNil(t, err, "Should have failed due to 0 create-at value.")
}

func TestImportValidatePostImportData(t *testing.T) {
	maxPostSize := 10000

	t.Run("Test with minimum required valid properties", func(t *testing.T) {
		data := PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.Nil(t, err, "Validation failed but should have been valid.")
	})

	t.Run("Test with missing required properties", func(t *testing.T) {
		data := PostImportData{
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to missing required property.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.team_missing.error")

		data = PostImportData{
			Team:     model.NewPointer("teamname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err = ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to missing required property.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.channel_missing.error")

		data = PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err = ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to missing required property.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.user_missing.error")

		data = PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err = ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to missing required property.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.message_missing.error")

		data = PostImportData{
			Team:    model.NewPointer("teamname"),
			Channel: model.NewPointer("channelname"),
			User:    model.NewPointer("username"),
			Message: model.NewPointer("message"),
		}
		err = ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to missing required property.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.create_at_missing.error")
	})

	t.Run("Test with invalid message", func(t *testing.T) {
		data := PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer(strings.Repeat("0", maxPostSize+1)),
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to too long message.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.message_length.error")
	})

	t.Run("Test with invalid CreateAt", func(t *testing.T) {
		data := PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(int64(0)),
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to 0 create-at value.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.create_at_zero.error")
	})

	t.Run("Test with valid all optional parameters", func(t *testing.T) {
		postCreateAt := model.GetMillis()
		repliesCreateAt := postCreateAt + 1
		reactionsCreateAt := postCreateAt + 2

		reactions := []ReactionImportData{{
			User:      model.NewPointer("username"),
			EmojiName: model.NewPointer("emoji"),
			CreateAt:  model.NewPointer(reactionsCreateAt),
		}}

		replies := []ReplyImportData{{
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			CreateAt: model.NewPointer(repliesCreateAt),
		}}

		data := PostImportData{
			Team:      model.NewPointer("teamname"),
			Channel:   model.NewPointer("channelname"),
			User:      model.NewPointer("username"),
			Message:   model.NewPointer("message"),
			CreateAt:  model.NewPointer(postCreateAt),
			Reactions: &reactions,
			Replies:   &replies,
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.Nil(t, err, "Should have succeeded.")
	})

	t.Run("Test with props too large", func(t *testing.T) {
		props := model.StringInterface{
			"attachment": strings.Repeat("a", model.PostPropsMaxRunes),
		}

		data := PostImportData{
			Team:     model.NewPointer("teamname"),
			Channel:  model.NewPointer("channelname"),
			User:     model.NewPointer("username"),
			Message:  model.NewPointer("message"),
			Props:    &props,
			CreateAt: model.NewPointer(model.GetMillis()),
		}
		err := ValidatePostImportData(&data, maxPostSize)
		require.NotNil(t, err, "Should have failed due to long props.")
		assert.Equal(t, err.Id, "app.import.validate_post_import_data.props_too_large.error")
	})
}

func TestImportValidateDirectChannelImportData(t *testing.T) {
	// Test with valid number of members for direct message.
	data := DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
	}
	err := ValidateDirectChannelImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with valid number of members for group message.
	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
	}
	err = ValidateDirectChannelImportData(&data)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with all the combinations of optional parameters.
	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
		Header: model.NewPointer("Channel Header Here"),
	}
	err = ValidateDirectChannelImportData(&data)
	require.Nil(t, err, "Should have succeeded with valid optional properties.")

	// Test with invalid Header.
	data.Header = model.NewPointer(strings.Repeat("abcdefghij ", 103))
	err = ValidateDirectChannelImportData(&data)
	require.NotNil(t, err, "Should have failed due to too long header.")

	// Test with different combinations of invalid member counts.
	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{},
	}
	err = ValidateDirectChannelImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid number of members.")

	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
	}
	err = ValidateDirectChannelImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid number of members.")

	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
	}
	err = ValidateDirectChannelImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to invalid number of members.")

	// Test with invalid FavoritedBy
	member1 := model.NewId()
	member2 := model.NewId()
	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(model.NewId()),
			},
			{
				Username: model.NewPointer(model.NewId()),
			},
		},
		FavoritedBy: &[]string{
			member1,
			model.NewId(),
		},
	}
	err = ValidateDirectChannelImportData(&data)
	require.NotNil(t, err, "Validation should have failed due to non-member favorited.")

	// Test with valid FavoritedBy
	data = DirectChannelImportData{
		Participants: []*DirectChannelMemberImportData{
			{
				Username: model.NewPointer(member1),
			},
			{
				Username: model.NewPointer(member2),
			},
		},
		FavoritedBy: &[]string{
			member1,
			member2,
		},
	}
	err = ValidateDirectChannelImportData(&data)
	require.Nil(t, err, "Validation should succeed with valid favorited member")
}

func TestImportValidateDirectPostImportData(t *testing.T) {
	maxPostSize := 10000

	// Test with minimum required valid properties.
	data := DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err := ValidateDirectPostImportData(&data, maxPostSize)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with missing required properties.
	data = DirectPostImportData{
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:    model.NewPointer("username"),
		Message: model.NewPointer("message"),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to missing required property.")

	// Test with invalid numbers of channel members.
	data = DirectPostImportData{
		ChannelMembers: &[]string{},
		User:           model.NewPointer("username"),
		Message:        model.NewPointer("message"),
		CreateAt:       model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to unsuitable number of members.")

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to unsuitable number of members.")

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to unsuitable number of members.")

	// Test with group message number of members.
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.Nil(t, err, "Validation failed but should have been valid.")

	// Test with invalid message.
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer(strings.Repeat("0", maxPostSize+1)),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to too long message.")

	// Test with invalid CreateAt
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			model.NewId(),
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(int64(0)),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Should have failed due to 0 create-at value.")

	// Test with invalid FlaggedBy
	member1 := model.NewId()
	member2 := model.NewId()
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			member1,
			member2,
		},
		FlaggedBy: &[]string{
			member1,
			model.NewId(),
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.NotNil(t, err, "Validation should have failed due to non-member flagged.")

	// Test with valid FlaggedBy
	data = DirectPostImportData{
		ChannelMembers: &[]string{
			member1,
			member2,
		},
		FlaggedBy: &[]string{
			member1,
			member2,
		},
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}
	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.Nil(t, err, "Validation should succeed with post flagged by members")

	// Test with valid all optional parameters.
	reactions := []ReactionImportData{{
		User:      model.NewPointer("username"),
		EmojiName: model.NewPointer("emoji"),
		CreateAt:  model.NewPointer(model.GetMillis()),
	}}

	replies := []ReplyImportData{{
		User:     model.NewPointer("username"),
		Message:  model.NewPointer("message"),
		CreateAt: model.NewPointer(model.GetMillis()),
	}}

	data = DirectPostImportData{
		ChannelMembers: &[]string{
			member1,
			member2,
		},
		FlaggedBy: &[]string{
			member1,
			member2,
		},
		User:      model.NewPointer("username"),
		Message:   model.NewPointer("message"),
		CreateAt:  model.NewPointer(model.GetMillis()),
		Reactions: &reactions,
		Replies:   &replies,
	}

	err = ValidateDirectPostImportData(&data, maxPostSize)
	require.Nil(t, err, "Validation should succeed with valid optional parameters")
}

func TestImportValidateEmojiImportData(t *testing.T) {
	var testCases = []struct {
		testName          string
		name              *string
		image             *string
		expectError       bool
		expectSystemEmoji bool
	}{
		{"success", model.NewPointer("parrot2"), model.NewPointer("/path/to/image"), false, false},
		{"system emoji", model.NewPointer("smiley"), model.NewPointer("/path/to/image"), true, true},
		{"empty name", model.NewPointer(""), model.NewPointer("/path/to/image"), true, false},
		{"empty image", model.NewPointer("parrot2"), model.NewPointer(""), true, false},
		{"empty name and image", model.NewPointer(""), model.NewPointer(""), true, false},
		{"nil name", nil, model.NewPointer("/path/to/image"), true, false},
		{"nil image", model.NewPointer("parrot2"), nil, true, false},
		{"nil name and image", nil, nil, true, false},
	}

	for _, tc := range testCases {
		t.Run(tc.testName, func(t *testing.T) {
			data := EmojiImportData{
				Name:  tc.name,
				Image: tc.image,
			}

			err := ValidateEmojiImportData(&data)
			if tc.expectError {
				require.NotNil(t, err)
				assert.Equal(t, tc.expectSystemEmoji, err.Id == "model.emoji.system_emoji_name.app_error")
			} else {
				assert.Nil(t, err)
			}
		})
	}
}

func checkError(t *testing.T, err *model.AppError) {
	require.NotNil(t, err, "Should have returned an error.")
}

func checkNoError(t *testing.T, err *model.AppError) {
	require.Nil(t, err, "Unexpected Error: %v", err)
}

func TestIsValidGuestRoles(t *testing.T) {
	var testCases = []struct {
		name     string
		input    UserImportData
		expected bool
	}{
		{
			name: "Valid case: User is a guest in all places",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemGuestRoleId),
				Teams: &[]UserTeamImportData{
					{
						Roles: model.NewPointer(model.TeamGuestRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelGuestRoleId)},
						},
					},
				},
			},
			expected: true,
		},
		{
			name: "Invalid case: User is a guest in a team but not in another team",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemGuestRoleId),
				Teams: &[]UserTeamImportData{
					{
						Roles: model.NewPointer(model.TeamGuestRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelGuestRoleId)},
						},
					},
					{
						Roles: model.NewPointer(model.TeamUserRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelUserRoleId)},
						},
					},
				},
			},
			expected: false,
		},
		{
			name: "Invalid case: User is a guest in a team but not in another team and has no channel membership",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemGuestRoleId),
				Teams: &[]UserTeamImportData{
					{
						Roles: model.NewPointer(model.TeamGuestRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelGuestRoleId)},
						},
					},
					{
						Roles:    model.NewPointer(model.TeamUserRoleId),
						Channels: &[]UserChannelImportData{},
					},
				},
			},
			expected: false,
		},
		{
			name: "Invalid case: User is system guest but not guest in team and channel",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemGuestRoleId),
			},
			expected: false,
		},
		{
			name: "Invalid case: User has mixed roles",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemGuestRoleId),
				Teams: &[]UserTeamImportData{
					{
						Roles: model.NewPointer(model.TeamUserRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelGuestRoleId)},
						},
					},
				},
			},
			expected: false,
		},
		{
			name:     "Valid case: User does not have any role defined in any place",
			input:    UserImportData{},
			expected: true,
		},
		{
			name: "Valid case: User is not a guest in any place",
			input: UserImportData{
				Roles: model.NewPointer(model.SystemUserRoleId),
				Teams: &[]UserTeamImportData{
					{
						Roles: model.NewPointer(model.TeamAdminRoleId),
						Channels: &[]UserChannelImportData{
							{Roles: model.NewPointer(model.ChannelAdminRoleId)},
						},
					},
				},
			},
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := isValidGuestRoles(tc.input)
			assert.Equal(t, tc.expected, result, tc.name)
		})
	}
}
