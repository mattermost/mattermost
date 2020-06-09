// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionDeepCopy(t *testing.T) {
	sessionId := NewId()
	userId := NewId()
	mapKey := "key"
	mapValue := "val"

	session := &Session{Id: sessionId, Props: map[string]string{mapKey: mapValue}, TeamMembers: []*TeamMember{{UserId: userId, TeamId: "someteamId"}}}

	copySession := session.DeepCopy()
	copySession.Id = "changed"
	copySession.Props[mapKey] = "changed"
	copySession.TeamMembers[0].UserId = "changed"

	assert.Equal(t, sessionId, session.Id)
	assert.Equal(t, mapValue, session.Props[mapKey])
	assert.Equal(t, userId, session.TeamMembers[0].UserId)

	session = &Session{Id: sessionId}
	copySession = session.DeepCopy()

	assert.Equal(t, sessionId, copySession.Id)

	session = &Session{TeamMembers: []*TeamMember{}}
	copySession = session.DeepCopy()

	assert.Equal(t, 0, len(copySession.TeamMembers))
}

func TestSessionJson(t *testing.T) {
	session := Session{}
	session.PreSave()
	json := session.ToJson()
	rsession := SessionFromJson(strings.NewReader(json))

	require.Equal(t, rsession.Id, session.Id, "Ids do not match")

	session.Sanitize()

	require.False(t, session.IsExpired(), "Shouldn't expire")

	session.ExpiresAt = GetMillis()
	time.Sleep(10 * time.Millisecond)

	require.True(t, session.IsExpired(), "Should expire")

	session.SetExpireInDays(10)
}

func TestSessionCSRF(t *testing.T) {
	s := Session{}
	token := s.GetCSRF()
	assert.Empty(t, token)

	token = s.GenerateCSRF()
	assert.NotEmpty(t, token)

	token2 := s.GetCSRF()
	assert.NotEmpty(t, token2)
	assert.Equal(t, token, token2)
}
