// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package suite

import (
	"net/url"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
)

// By default the list will be (not necessarily in this order):
//
//	['town-square', 'off-topic']
//
// However, if TeamSettings.ExperimentalDefaultChannels contains a list of channels then that list will replace
// 'off-topic' and be included in the return results in addition to 'town-square'. For example:
//
//	['town-square', 'game-of-thrones', 'wow']
func (s *SuiteService) defaultChannelNames() []string {
	names := []string{"town-square"}

	if len(s.platform.Config().TeamSettings.ExperimentalDefaultChannels) == 0 {
		names = append(names, "off-topic")
	} else {
		seenChannels := map[string]bool{"town-square": true}
		for _, channelName := range s.platform.Config().TeamSettings.ExperimentalDefaultChannels {
			if !seenChannels[channelName] {
				names = append(names, channelName)
				seenChannels[channelName] = true
			}
		}
	}

	return names
}

func IsEmailAddressAllowed(email string, allowedDomains []string) bool {
	for _, restriction := range allowedDomains {
		domains := normalizeDomains(restriction)
		if len(domains) <= 0 {
			continue
		}
		matched := false
		for _, d := range domains {
			if strings.HasSuffix(email, "@"+d) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	return true
}

func (s *SuiteService) IsTeamEmailAllowed(user *model.User, team *model.Team) bool {
	if user.IsBot {
		return true
	}
	email := strings.ToLower(user.Email)
	allowedDomains := s.GetAllowedDomains(user, team)
	return IsEmailAddressAllowed(email, allowedDomains)
}

func (s *SuiteService) GetAllowedDomains(user *model.User, team *model.Team) []string {
	if user.IsGuest() {
		return []string{*s.platform.Config().GuestAccountsSettings.RestrictCreationToDomains}
	}
	// First check per team allowedDomains, then app wide restrictions
	return []string{team.AllowedDomains, *s.platform.Config().TeamSettings.RestrictCreationToDomains}
}

func (s *SuiteService) checkValidDomains(team *model.Team) error {
	validDomains := normalizeDomains(*s.platform.Config().TeamSettings.RestrictCreationToDomains)
	if len(validDomains) > 0 {
		for _, domain := range normalizeDomains(team.AllowedDomains) {
			matched := false
			for _, d := range validDomains {
				if domain == d {
					matched = true
					break
				}
			}
			if !matched {
				return &DomainError{Domain: domain}
			}
		}
	}

	return nil
}

func normalizeDomains(domains string) []string {
	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	return strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))
}

// UserIsInAdminRoleGroup returns true at least one of the user's groups are configured to set the members as
// admins in the given syncable.
func (s *SuiteService) userIsInAdminRoleGroup(userID, syncableID string, syncableType model.GroupSyncableType) (bool, error) {
	groupIDs, err := s.platform.Store.Group().AdminRoleGroupsForSyncableMember(userID, syncableID, syncableType)
	if err != nil {
		return false, err
	}

	if len(groupIDs) == 0 {
		return false, nil
	}

	return true, nil
}

func (s *SuiteService) GetSiteURL() string {
	return *s.platform.Config().ServiceSettings.SiteURL
}

// CheckUserDomain checks that a user's email domain matches a list of space-delimited domains as a string.
func CheckUserDomain(user *model.User, domains string) bool {
	return CheckEmailDomain(user.Email, domains)
}

// CheckEmailDomain checks that an email domain matches a list of space-delimited domains as a string.
func CheckEmailDomain(email string, domains string) bool {
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

func (s *SuiteService) sanitizeUserProfiles(users []*model.User, asAdmin bool) []*model.User {
	for _, u := range users {
		s.SanitizeProfile(u, asAdmin)
	}

	return users
}

func (s *SuiteService) SanitizeUserrofile(user *model.User, asAdmin bool) {
	options := s.GetSanitizeOptions(asAdmin)

	user.SanitizeProfile(options)
}

func (s *SuiteService) getUserSanitizeOptions(asAdmin bool) map[string]bool {
	options := s.platform.Config().GetSanitizeOptions()
	if asAdmin {
		options["email"] = true
		options["fullname"] = true
		options["authservice"] = true
	}
	return options
}

// IsUsernameTaken checks if the username is already used by another user. Return false if the username is invalid.
func (s *SuiteService) IsUsernameTaken(name string) bool {
	if !model.IsValidUsername(name) {
		return false
	}

	if _, err := s.platform.Store.User().GetByUsername(name); err != nil {
		return false
	}

	return true
}

func (s *SuiteService) GetCookieDomain() string {
	if *s.platform.Config().ServiceSettings.AllowCookiesForSubdomains {
		if siteURL, err := url.Parse(*s.platform.Config().ServiceSettings.SiteURL); err == nil {
			return siteURL.Hostname()
		}
	}
	return ""
}

type accessibleBounds struct {
	start int
	end   int
}

func (b accessibleBounds) allAccessible(lenPosts int) bool {
	return b.start == allAccessibleBounds(lenPosts).start && b.end == allAccessibleBounds(lenPosts).end
}

func (b accessibleBounds) noAccessible() bool {
	return b.start == noAccessibleBounds.start && b.end == noAccessibleBounds.end
}

// assumes checking was already performed that at least one post is inaccessible
func (b accessibleBounds) getInaccessibleRange(listLength int) (int, int) {
	var start, end int
	if b.start == 0 {
		start = b.end + 1
		end = listLength - 1
	} else {
		start = 0
		end = b.start - 1
	}
	return start, end
}

func max(a, b int64) int64 {
	if a < b {
		return b
	}
	return a
}

var noAccessibleBounds = accessibleBounds{start: -1, end: -1}
var allAccessibleBounds = func(lenPosts int) accessibleBounds { return accessibleBounds{start: 0, end: lenPosts - 1} }

// getTimeSortedPostAccessibleBounds returns what the boundaries are for accessible posts.
// It assumes that CreateAt time for posts is monotonically increasing or decreasing.
// It could be either because posts can be returned in ascending or descending time order.
// Special values (which can be checked with methods `allAccessible` and `allInaccessible`)
// denote if all or none of the posts are accessible.
func getTimeSortedPostAccessibleBounds(earliestAccessibleTime int64, lenPosts int, getCreateAt func(int) int64) accessibleBounds {
	if lenPosts == 0 {
		return allAccessibleBounds(lenPosts)
	}
	if lenPosts == 1 {
		if getCreateAt(0) >= earliestAccessibleTime {
			return allAccessibleBounds(lenPosts)
		}
		return noAccessibleBounds
	}

	ascending := getCreateAt(0) < getCreateAt(lenPosts-1)

	idx := sort.Search(lenPosts, func(i int) bool {
		if ascending {
			// Ascending order automatically picks the left most post(at idx),
			// in case multiple posts at idx, idx+1, idx+2... have the same time.
			return getCreateAt(i) >= earliestAccessibleTime
		}
		// Special case(subtracting 1) for descending order to include the right most post(at idx+k),
		// in case multiple posts at idx, idx+1, idx+2...idx+k have the same time.
		return getCreateAt(i) <= earliestAccessibleTime-1
	})

	if ascending {
		if idx == lenPosts {
			return noAccessibleBounds
		}
		return accessibleBounds{start: idx, end: lenPosts - 1}
	}

	if idx == 0 {
		return noAccessibleBounds
	}
	return accessibleBounds{start: 0, end: idx - 1}
}
