// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	UserAuthServiceLdap       = "ldap"
	LdapPublicCertificateName = "ldap-public.crt"
	LdapPrivateKeyName        = "ldap-private.key"
)

type LdapUser struct {
	Id             string
	Username       string
	Email          string
	FirstName      string
	LastName       string
	Nickname       string
	Position       string
	LoginID        string
	ProfilePicture string
}

func (u *LdapUser) Groups() []*LdapGroup {
	return []*LdapGroup{}
}

type LdapGroup struct {
	Id              string
	DisplayName     string
	MattermostGroup *Group
}

func (g *LdapGroup) Members() []*LdapUser {
	return []*LdapUser{}
}

type LdapSettingsInput struct {
	LdapServer                  *string
	LdapPort                    *int
	ConnectionSecurity          *string
	BaseDN                      *string
	BindUsername                *string
	BindPassword                *string
	UserFilter                  *string
	GroupFilter                 *string
	GuestFilter                 *string
	AdminFilter                 *string
	GroupDisplayNameAttribute   *string
	GroupIDAttribute            *string
	FirstNameAttribute          *string
	LastNameAttribute           *string
	EmailAttribute              *string
	UsernameAttribute           *string
	NicknameAttribute           *string
	IdAttribute                 *string
	PositionAttribute           *string
	LoginIdAttribute            *string
	PictureAttribute            *string
	SkipCertificateVerification *bool
	PublicCertificateFile       *string
	PrivateKeyFile              *string
	QueryTimeout                *int
	MaxPageSize                 *int
}

func (group *Group) Members() []*LdapUser {
	return []*LdapUser{}
}
