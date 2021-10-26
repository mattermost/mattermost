// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package teams

import "errors"

var (
	AcceptedDomainError        = errors.New("the user cannot be added as the domain associated with the account is not permitted")
	MemberCountError           = errors.New("unable to count the team members")
	MaxMemberCountError        = errors.New("reached to the maximum number of allowed accounts")
	NotTeamMemberError         = errors.New("not a team member")
	RoleNotFoundError          = errors.New("role could not be found with the given role name")
	UserGuestRoleConflictError = errors.New("a user cannot be a guest and a user at the same time")
	UpdateGuestRoleError       = errors.New("cannot add or remove the guest role manually")
)

type DomainError struct {
	Domain string
}

func (DomainError) Error() string {
	return "restricting team to the domain, it is not allowed by the system config"
}

type ManagedRoleApplyError struct {
	role string
}

func (e *ManagedRoleApplyError) Error() string {
	return "role_name=" + e.role
}
