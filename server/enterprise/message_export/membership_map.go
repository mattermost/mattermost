// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

type MembershipMapUser struct {
	userId   string
	email    string
	username string
}

// Provides a clean interface for tracking the users that are present in any number of channels by channel id and user email
type MembershipMap map[string]map[string]MembershipMapUser

func (m *MembershipMap) init(channelId string) {
	if *m == nil {
		*m = make(map[string]map[string]MembershipMapUser)
	}
	if (*m)[channelId] == nil {
		(*m)[channelId] = make(map[string]MembershipMapUser)
	}
}

func (m *MembershipMap) AddUserToChannel(channelId string, user MembershipMapUser) {
	m.init(channelId)
	if !m.IsUserInChannel(channelId, user.email) {
		(*m)[channelId][user.email] = user
	}
}

func (m *MembershipMap) RemoveUserFromChannel(channelId string, userEmail string) {
	m.init(channelId)
	delete((*m)[channelId], userEmail)
}

func (m *MembershipMap) IsUserInChannel(channelId string, userEmail string) bool {
	m.init(channelId)
	_, exists := (*m)[channelId][userEmail]
	return exists
}

func (m *MembershipMap) GetUserEmailsInChannel(channelId string) []string {
	m.init(channelId)
	users := make([]string, 0, len((*m)[channelId]))
	for k := range (*m)[channelId] {
		users = append(users, k)
	}
	return users
}

func (m *MembershipMap) GetUsersInChannel(channelId string) []MembershipMapUser {
	m.init(channelId)
	users := make([]MembershipMapUser, 0, len((*m)[channelId]))
	for _, v := range (*m)[channelId] {
		users = append(users, v)
	}
	return users
}
