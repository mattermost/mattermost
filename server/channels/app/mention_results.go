// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

const (
	// Different types of mentions ordered by their priority from lowest to highest

	// A placeholder that should never be used in practice
	NoMention MentionType = iota

	// The post is in a GM
	GMMention

	// The post is in a thread that the user has commented on
	ThreadMention

	// The post is a comment on a thread started by the user
	CommentMention

	// The post contains an at-channel, at-all, or at-here
	ChannelMention

	// The post is a DM
	DMMention

	// The post contains an at-mention for the user
	KeywordMention

	// The post contains a group mention for the user
	GroupMention
)

type MentionType int

type MentionResults struct {
	// Mentions maps the ID of each user that was mentioned to how they were mentioned.
	Mentions map[string]MentionType

	// GroupMentions maps the ID of each group that was mentioned to how it was mentioned.
	GroupMentions map[string]MentionType

	// OtherPotentialMentions contains a list of strings that looked like mentions, but didn't have
	// a corresponding keyword.
	OtherPotentialMentions []string

	// HereMentioned is true if the message contained @here.
	HereMentioned bool

	// AllMentioned is true if the message contained @all.
	AllMentioned bool

	// ChannelMentioned is true if the message contained @channel.
	ChannelMentioned bool
}

func (m *MentionResults) isUserMentioned(userID string) bool {
	if _, ok := m.Mentions[userID]; ok {
		return true
	}

	if _, ok := m.GroupMentions[userID]; ok {
		return true
	}

	return m.HereMentioned || m.AllMentioned || m.ChannelMentioned
}

func (m *MentionResults) addMention(userID string, mentionType MentionType) {
	if m.Mentions == nil {
		m.Mentions = make(map[string]MentionType)
	}

	if currentType, ok := m.Mentions[userID]; ok && currentType >= mentionType {
		return
	}

	m.Mentions[userID] = mentionType
}

func (m *MentionResults) removeMention(userID string) {
	delete(m.Mentions, userID)
}

func (m *MentionResults) addGroupMention(groupID string) {
	if m.GroupMentions == nil {
		m.GroupMentions = make(map[string]MentionType)
	}

	m.GroupMentions[groupID] = GroupMention
}
