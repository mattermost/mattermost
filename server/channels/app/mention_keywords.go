package app

import (
	"fmt"
	"strings"
)

const (
	mentionableUserPrefix  = "user:"
	mentionableGroupPrefix = "group:"
)

type MentionableID string

func (id MentionableID) AsUserID() (userID string, ok bool) {
	idString := string(id)
	if strings.HasPrefix(idString, mentionableUserPrefix) {
		return idString[len(mentionableUserPrefix):], true
	} else {
		return "", false
	}
}

func (id MentionableID) AsGroupID() (groupID string, ok bool) {
	idString := string(id)
	if strings.HasPrefix(idString, mentionableGroupPrefix) {
		return idString[len(mentionableGroupPrefix):], true
	} else {
		return "", false
	}
}

type MentionKeywords map[string][]MentionableID

func (k MentionKeywords) AddUser(userID string, keyword string) {
	k[keyword] = append(k[keyword], MentionableUserID(userID))
}

func (k MentionKeywords) AddGroup(groupID string, keyword string) {
	k[keyword] = append(k[keyword], MentionableGroupID(groupID))
}

func MentionableUserID(userID string) MentionableID {
	return MentionableID(fmt.Sprint(mentionableUserPrefix, userID))
}

func MentionableGroupID(groupID string) MentionableID {
	return MentionableID(fmt.Sprint(mentionableGroupPrefix, groupID))
}
