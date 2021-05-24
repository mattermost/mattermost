// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"strings"

	"github.com/mattermost/mattermost-server/v5/model"
)

// checkUserDomain checks that a user's email domain matches a list of space-delimited domains as a string.
func checkUserDomain(user *model.User, domains string) bool {
	return checkEmailDomain(user.Email, domains)
}

// checkEmailDomain checks that an email domain matches a list of space-delimited domains as a string.
func checkEmailDomain(email string, domains string) bool {
	if domains == "" {
		return true
	}

	domainArray := strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))

	for _, d := range domainArray {
		if strings.HasSuffix(strings.ToLower(email), "@"+d) {
			return true
		}
	}

	return false
}
