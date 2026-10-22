// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTeamIsValid(t *testing.T) {
	o := Team{}

	appErr := o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.Id = NewId()
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.CreateAt = GetMillis()
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.UpdateAt = GetMillis()
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.Email = strings.Repeat("01234567890", 20)
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.Email = "corey+test@hulen.com"
	o.DisplayName = strings.Repeat("01234567890", 20)
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.DisplayName = "1234"
	o.Name = "ZZZZZZZ"
	appErr = o.IsValid()
	require.NotNil(t, appErr, "should be invalid")

	o.Name = "zzzzz"
	o.Type = TeamOpen
	o.InviteId = NewId()
	appErr = o.IsValid()
	require.Nil(t, appErr, appErr)
}

func TestTeamPreSave(t *testing.T) {
	o := Team{DisplayName: "test"}
	o.PreSave()
	o.Etag()
}

func TestTeamPreUpdate(t *testing.T) {
	o := Team{DisplayName: "test"}
	o.PreUpdate()
}

var domains = []struct {
	value    string
	expected bool
}{
	{"spin-punch", true},
	{"-spin-punch", false},
	{"spin-punch-", false},
	{"spin_punch", false},
	{"a", false},
	{"aa", true},
	{"aaa", true},
	{"aaa-999b", true},
	{"b00b", true},
	{"b)", false},
	{"test", true},
}

func TestValidTeamName(t *testing.T) {
	for _, v := range domains {
		actual := IsValidTeamName(v.value)
		assert.Equal(t, v.expected, actual)
	}
}

var tReservedDomains = []struct {
	value    string
	expected bool
}{
	{"admin", true},
	{"Admin-punch", true},
	{"spin-punch-admin", false},
	{"playbooks", true},
	{"boards", true},
}

func TestReservedTeamName(t *testing.T) {
	for _, v := range tReservedDomains {
		actual := IsReservedTeamName(v.value)
		assert.Equal(t, v.expected, actual)
	}
}

func TestCleanTeamName(t *testing.T) {
	actual := CleanTeamName("Jimbo's Admin")
	require.Equal(t, "jimbos-admin", actual, "didn't clean name properly")

	actual = CleanTeamName("Admin Really cool")
	require.Equal(t, "really-cool", actual, "didn't clean name properly")

	actual = CleanTeamName("super-duper-guys")
	require.Equal(t, "super-duper-guys", actual, "didn't clean name properly")
}

func TestTeamPatch(t *testing.T) {
	p := &TeamPatch{
		DisplayName:      new(string),
		Description:      new(string),
		CompanyName:      new(string),
		AllowedDomains:   new(string),
		AllowOpenInvite:  new(bool),
		GroupConstrained: new(bool),
	}

	*p.DisplayName = NewId()
	*p.Description = NewId()
	*p.CompanyName = NewId()
	*p.AllowedDomains = NewId()
	*p.AllowOpenInvite = true
	*p.GroupConstrained = true

	o := Team{Id: NewId()}
	o.Patch(p)

	require.Equal(t, *p.DisplayName, o.DisplayName, "DisplayName did not update")
	require.Equal(t, *p.Description, o.Description, "Description did not update")
	require.Equal(t, *p.CompanyName, o.CompanyName, "CompanyName did not update")
	require.Equal(t, *p.AllowedDomains, o.AllowedDomains, "AllowedDomains did not update")
	require.Equal(t, *p.AllowOpenInvite, o.AllowOpenInvite, "AllowOpenInvite did not update")
	require.Equal(t, *p.GroupConstrained, *o.GroupConstrained)
}

func TestTeamHasPolicyAction(t *testing.T) {
	t.Run("nil team returns false", func(t *testing.T) {
		var team *Team
		require.False(t, team.HasPolicyAction("membership"))
		require.False(t, team.HasMembershipPolicyAction())
	})

	t.Run("nil PolicyActions map returns false", func(t *testing.T) {
		team := &Team{}
		require.False(t, team.HasPolicyAction("membership"))
		require.False(t, team.HasMembershipPolicyAction())
	})

	t.Run("empty PolicyActions map returns false", func(t *testing.T) {
		team := &Team{PolicyActions: map[string]bool{}}
		require.False(t, team.HasPolicyAction("membership"))
		require.False(t, team.HasMembershipPolicyAction())
	})

	t.Run("membership=true returns true", func(t *testing.T) {
		team := &Team{PolicyActions: map[string]bool{"membership": true}}
		require.True(t, team.HasPolicyAction("membership"))
		require.True(t, team.HasMembershipPolicyAction())
	})

	t.Run("membership=false returns false", func(t *testing.T) {
		team := &Team{PolicyActions: map[string]bool{"membership": false}}
		require.False(t, team.HasPolicyAction("membership"))
		require.False(t, team.HasMembershipPolicyAction())
	})
}

func TestTeamSanitizePreservesPolicyEnforced(t *testing.T) {
	t.Run("PolicyEnforced is preserved after Sanitize", func(t *testing.T) {
		team := &Team{
			Id:             NewId(),
			Email:          "test@example.com",
			InviteId:       NewId(),
			PolicyEnforced: true,
		}
		team.Sanitize()
		require.True(t, team.PolicyEnforced, "PolicyEnforced must survive Sanitize")
	})

	t.Run("Email and InviteId are stripped by Sanitize (regression)", func(t *testing.T) {
		team := &Team{
			Id:       NewId(),
			Email:    "test@example.com",
			InviteId: NewId(),
		}
		team.Sanitize()
		require.Empty(t, team.Email, "Email must be cleared by Sanitize")
		require.Empty(t, team.InviteId, "InviteId must be cleared by Sanitize")
	})
}
