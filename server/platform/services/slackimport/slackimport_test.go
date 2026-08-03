// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package slackimport

import (
	"archive/zip"
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestSlackConvertTimeStamp(t *testing.T) {
	assert.EqualValues(t, slackConvertTimeStamp("1469785419.000033"), 1469785419000)
}

func TestSlackConvertChannelName(t *testing.T) {
	for _, tc := range []struct {
		nameInput string
		idInput   string
		output    string
	}{
		{"test-channel", "C0G08DLQH", "test-channel"},
		{"_test_channel_", "C0G04DLQH", "test_channel"},
		{"__test", "C0G07DLQH", "test"},
		{"-t", "C0G06DLQH", "slack-channel-t"},
		{"a", "C0G05DLQH", "slack-channel-a"},
		{"случайный", "C0G05DLQD", "c0g05dlqd"},
	} {
		assert.Equal(t, slackConvertChannelName(tc.nameInput, tc.idInput), tc.output, "nameInput = %v", tc.nameInput)
	}
}

func TestSlackConvertUserMentions(t *testing.T) {
	users := []slackUser{
		{Id: "U00000A0A", Username: "firstuser"},
		{Id: "U00000B1B", Username: "seconduser"},
	}

	posts := map[string][]slackPost{
		"test-channel": {
			{
				Text: "<!channel>: Hi guys.",
			},
			{
				Text: "Calling <!here|@here>.",
			},
			{
				Text: "Yo <!everyone>.",
			},
			{
				Text: "Regular user test <@U00000B1B|seconduser> and <@U00000A0A>.",
			},
		},
	}

	expectedPosts := map[string][]slackPost{
		"test-channel": {
			{
				Text: "@channel: Hi guys.",
			},
			{
				Text: "Calling @here.",
			},
			{
				Text: "Yo @all.",
			},
			{
				Text: "Regular user test @seconduser and @firstuser.",
			},
		},
	}

	assert.Equal(t, expectedPosts, slackConvertUserMentions(users, posts))
}

func TestSlackConvertChannelMentions(t *testing.T) {
	channels := []slackChannel{
		{Id: "C000AA00A", Name: "one"},
		{Id: "C000BB11B", Name: "two"},
	}

	posts := map[string][]slackPost{
		"test-channel": {
			{
				Text: "Go to <#C000AA00A>.",
			},
			{
				User: "U00000A0A",
				Text: "Try <#C000BB11B|two> for this.",
			},
		},
	}

	expectedPosts := map[string][]slackPost{
		"test-channel": {
			{
				Text: "Go to ~one.",
			},
			{
				User: "U00000A0A",
				Text: "Try ~two for this.",
			},
		},
	}

	assert.Equal(t, expectedPosts, slackConvertChannelMentions(channels, posts))
}

func openTestFile(t *testing.T, filename string) (*os.File, error) {
	working, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	t.Log("working directory:", working)

	path := filepath.Join("../tests", filename)
	return os.Open(path)
}

func TestSlackParseChannels(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-channels.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := slackParseChannels(file, model.ChannelTypeOpen)
	require.NoError(t, err)
	assert.Equal(t, 6, len(channels))
}

func TestSlackParseDirectMessages(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-direct-messages.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := slackParseChannels(file, model.ChannelTypeDirect)
	require.NoError(t, err)
	assert.Equal(t, 4, len(channels))
}

func TestSlackParsePrivateChannels(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-private-channels.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := slackParseChannels(file, model.ChannelTypePrivate)
	require.NoError(t, err)
	assert.Equal(t, 1, len(channels))
}

func TestSlackParseGroupDirectMessages(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-group-direct-messages.json")
	require.NoError(t, err)
	defer file.Close()

	channels, err := slackParseChannels(file, model.ChannelTypeGroup)
	require.NoError(t, err)
	assert.Equal(t, 3, len(channels))
}

func TestSlackParseUsers(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-users.json")
	require.NoError(t, err)
	defer file.Close()

	users, err := slackParseUsers(file)
	require.NoError(t, err)
	assert.Equal(t, 11, len(users))
}

func TestSlackParsePosts(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-posts.json")
	require.NoError(t, err)
	defer file.Close()

	posts, err := slackParsePosts(file)
	require.NoError(t, err)
	assert.Equal(t, 9, len(posts))
}

func TestSlackParseMultipleAttachments(t *testing.T) {
	file, err := openTestFile(t, "slack-import-test-posts.json")
	require.NoError(t, err)
	defer file.Close()

	posts, err := slackParsePosts(file)
	require.NoError(t, err)
	assert.Equal(t, 2, len(posts[8].Files))
}

func TestSlackSanitiseChannelProperties(t *testing.T) {
	rctx := request.TestContext(t)

	c1 := model.Channel{
		DisplayName: "display-name",
		Name:        "name",
		Purpose:     "The channel purpose",
		Header:      "The channel header",
	}

	c1s := slackSanitiseChannelProperties(rctx, c1)
	assert.Equal(t, c1, c1s)

	c2 := model.Channel{
		DisplayName: strings.Repeat("abcdefghij", 7),
		Name:        strings.Repeat("abcdefghij", 7),
		Purpose:     strings.Repeat("0123456789", 30),
		Header:      strings.Repeat("0123456789", 120),
	}

	c2s := slackSanitiseChannelProperties(rctx, c2)
	assert.Equal(t, model.Channel{
		DisplayName: strings.Repeat("abcdefghij", 6) + "abcd",
		Name:        strings.Repeat("abcdefghij", 6) + "abcd",
		Purpose:     strings.Repeat("0123456789", 25),
		Header:      strings.Repeat("0123456789", 102) + "0123",
	}, c2s)
}

func TestSlackConvertPostsMarkup(t *testing.T) {
	input := make(map[string][]slackPost)
	input["test"] = []slackPost{
		{
			Text: "This message contains a link to <https://google.com|Google>.",
		},
		{
			Text: "This message contains a mailto link to <mailto:me@example.com|me@example.com> in it.",
		},
		{
			Text: "This message contains a *bold* word.",
		},
		{
			Text: "This is not a * bold * word.",
		},
		{
			Text: `There is *no bold word
in this*.`,
		},
		{
			Text: "*This* is not a*bold* word.*This* is a bold word, *and* this; *and* this too.",
		},
		{
			Text: "This message contains a ~strikethrough~ word.",
		},
		{
			Text: "This is not a ~ strikethrough ~ word.",
		},
		{
			Text: `There is ~no strikethrough word
in this~.`,
		},
		{
			Text: "~This~ is not a~strikethrough~ word.~This~ is a strikethrough word, ~and~ this; ~and~ this too.",
		},
		{
			Text: `This message contains multiple paragraphs blockquotes
&gt;&gt;&gt;first
second
third`,
		},
		{
			Text: `This message contains single paragraph blockquotes
&gt;something
&gt;another thing`,
		},
		{
			Text: "This message has no > block quote",
		},
	}

	expectedOutput := make(map[string][]slackPost)
	expectedOutput["test"] = []slackPost{
		{
			Text: "This message contains a link to [Google](https://google.com).",
		},
		{
			Text: "This message contains a mailto link to [me@example.com](mailto:me@example.com) in it.",
		},
		{
			Text: "This message contains a **bold** word.",
		},
		{
			Text: "This is not a * bold * word.",
		},
		{
			Text: `There is *no bold word
in this*.`,
		},
		{
			Text: "**This** is not a*bold* word.**This** is a bold word, **and** this; **and** this too.",
		},
		{
			Text: "This message contains a ~~strikethrough~~ word.",
		},
		{
			Text: "This is not a ~ strikethrough ~ word.",
		},
		{
			Text: `There is ~no strikethrough word
in this~.`,
		},
		{
			Text: "~~This~~ is not a~strikethrough~ word.~~This~~ is a strikethrough word, ~~and~~ this; ~~and~~ this too.",
		},
		{
			Text: `This message contains multiple paragraphs blockquotes
>first
>second
>third`,
		},
		{
			Text: `This message contains single paragraph blockquotes
>something
>another thing`,
		},
		{
			Text: "This message has no > block quote",
		},
	}

	assert.Equal(t, expectedOutput, slackConvertPostsMarkup(input))
}

func TestOldImportChannel(t *testing.T) {
	u1 := &model.User{
		Id:       model.NewId(),
		Username: "test-user-1",
	}
	u2 := &model.User{
		Id:       model.NewId(),
		Username: "test-user-2",
	}
	store := &mocks.Store{}
	config := &model.Config{}
	config.SetDefaults()
	rctx := request.TestContext(t)

	t.Run("No panic on direct channel", func(t *testing.T) {
		// ch := th.CreateDmChannel(u1)
		ch := &model.Channel{
			Type: model.ChannelTypeDirect,
			Name: model.GetDMNameFromIds(u1.Id, u2.Id),
		}
		users := map[string]*model.User{
			u2.Id: u2,
		}
		sCh := slackChannel{
			Id:      "someid",
			Members: []string{u1.Id, "randomID"},
			Creator: "randomID2",
		}

		actions := Actions{}

		importer := New(store, actions, config)
		_ = importer.oldImportChannel(rctx, ch, sCh, users)
	})

	t.Run("No panic on direct channel with 1 member", func(t *testing.T) {
		ch := &model.Channel{
			Type: model.ChannelTypeDirect,
			Name: model.GetDMNameFromIds(u1.Id, u1.Id),
		}
		users := map[string]*model.User{
			u1.Id: u1,
		}
		sCh := slackChannel{
			Id:      "someid",
			Members: []string{u1.Id},
			Creator: "randomID2",
		}

		actions := Actions{}

		importer := New(store, actions, config)
		_ = importer.oldImportChannel(rctx, ch, sCh, users)
	})

	t.Run("No panic on group channel", func(t *testing.T) {
		ch := &model.Channel{
			Type: model.ChannelTypeGroup,
			Name: "test-channel",
		}
		users := map[string]*model.User{
			u1.Id: u1,
		}
		sCh := slackChannel{
			Id:      "someid",
			Members: []string{u1.Id},
			Creator: "randomID2",
		}
		actions := Actions{}

		importer := New(store, actions, config)
		_ = importer.oldImportChannel(rctx, ch, sCh, users)
	})
}

func TestSlackUploadFile(t *testing.T) {
	store := &mocks.Store{}
	config := &model.Config{}
	config.SetDefaults()
	defaultLimit := *config.FileSettings.MaxFileSize

	rctx := request.TestContext(t)

	sf := &slackFile{
		Id:    "testfile",
		Title: "test-file",
	}

	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)
	writer, err := zipWriter.Create("testfile")
	require.NoError(t, err)

	_, err = writer.Write([]byte(strings.Repeat("a", 100)))
	require.NoError(t, err)

	err = zipWriter.Close()
	require.NoError(t, err)

	zipReader, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	require.NoError(t, err)

	uploads := map[string]*zip.File{
		"testfile": zipReader.File[0],
	}

	t.Run("Should not fail when file is in limits", func(t *testing.T) {
		importer := New(store, Actions{
			DoUploadFile: func(_ time.Time, _, _, _, _ string, _ []byte) (*model.FileInfo, *model.AppError) {
				return &model.FileInfo{}, nil
			},
		}, config)
		_, ok := importer.slackUploadFile(rctx, sf, uploads, "team-id", "channel-id", "user-id", time.Now().String())
		require.True(t, ok)
	})

	t.Run("Should fail when file size exceeded", func(t *testing.T) {
		defer func() {
			config.FileSettings.MaxFileSize = new(defaultLimit)
		}()

		config.FileSettings.MaxFileSize = new(int64(10))

		importer := New(store, Actions{}, config)
		_, ok := importer.slackUploadFile(rctx, sf, uploads, "team-id", "channel-id", "user-id", time.Now().String())
		require.False(t, ok)
	})
}

func TestOldImportUserEmailVerificationIsNotAutomatic(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	userStore := &mocks.UserStore{}
	store.On("User").Return(userStore)

	// Track if VerifyEmail is called (it should NOT be called)
	verifyEmailCalled := false
	userStore.On("VerifyEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return("user-id", nil).Run(func(args mock.Arguments) {
		verifyEmailCalled = true
	})

	savedUser := &model.User{
		Id:            "test-user-id",
		Username:      "testuser",
		Email:         "testuser@restricted-domain.com",
		EmailVerified: false, // Must remain false after import
		Roles:         model.SystemUserRoleId,
	}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(savedUser, nil)

	joinTeamCalled := false
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinTeamCalled = true
			return &model.TeamMember{}, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()

	importer := New(store, actions, config)

	team := &model.Team{
		Id:   "test-team-id",
		Name: "test-team",
	}

	user := &model.User{
		Username:  "testuser",
		Email:     "testuser@restricted-domain.com",
		FirstName: "Test",
		LastName:  "User",
	}

	result := importer.oldImportUser(rctx, team, user)

	require.NotNil(t, result, "User import should succeed")
	assert.Equal(t, "test-user-id", result.Id, "Should return the saved user")
	assert.False(t, verifyEmailCalled, "SECURITY: VerifyEmail should NOT be called - this prevents domain bypass vulnerability")
	assert.True(t, joinTeamCalled, "User should still be joined to the team")

	// Verify the user was saved with unverified email (VerifyEmail should not have been called)
	userStore.AssertCalled(t, "Save", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(u *model.User) bool {
		return u.Email == "testuser@restricted-domain.com" && !u.EmailVerified
	}))
}

// TestSlackImportEnhancedSecurityAdminCanVerifyEmails tests that system admins can automatically verify emails
func TestSlackImportEnhancedSecurityAdminCanVerifyEmails(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	userStore := &mocks.UserStore{}
	store.On("User").Return(userStore)

	// Track if VerifyEmail is called (it SHOULD be called for admin imports)
	verifyEmailCalled := false
	userStore.On("VerifyEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return("user-id", nil).Run(func(args mock.Arguments) {
		verifyEmailCalled = true
	})

	savedUser := &model.User{
		Id:            "test-user-id",
		Username:      "testuser",
		Email:         "testuser@restricted-domain.com",
		EmailVerified: false, // Will be verified by admin import
		Roles:         model.SystemUserRoleId,
	}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(savedUser, nil)

	joinTeamCalled := false
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinTeamCalled = true
			return &model.TeamMember{}, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()

	// Pass true to indicate this is an admin import
	importer := NewWithAdminFlag(store, actions, config, true)

	team := &model.Team{
		Id:   "test-team-id",
		Name: "test-team",
	}

	user := &model.User{
		Username:  "testuser",
		Email:     "testuser@restricted-domain.com",
		FirstName: "Test",
		LastName:  "User",
	}

	result := importer.oldImportUser(rctx, team, user)

	require.NotNil(t, result, "User import should succeed")
	assert.Equal(t, "test-user-id", result.Id, "Should return the saved user")
	assert.True(t, verifyEmailCalled, "ADMIN IMPORT: VerifyEmail SHOULD be called for system admin imports")
	assert.True(t, joinTeamCalled, "User should still be joined to the team")

	// Verify VerifyEmail was called with correct parameters
	userStore.AssertCalled(t, "VerifyEmail", "test-user-id", "testuser@restricted-domain.com")
}

// TestSlackImportEnhancedSecurityNonAdminCannotVerifyEmails tests that non-admin users cannot automatically verify emails
func TestSlackImportEnhancedSecurityNonAdminCannotVerifyEmails(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	userStore := &mocks.UserStore{}
	store.On("User").Return(userStore)

	// Track if VerifyEmail is called (it should NOT be called for non-admin imports)
	verifyEmailCalled := false
	userStore.On("VerifyEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return("user-id", nil).Run(func(args mock.Arguments) {
		verifyEmailCalled = true
	})

	savedUser := &model.User{
		Id:            "test-user-id",
		Username:      "testuser",
		Email:         "testuser@restricted-domain.com",
		EmailVerified: false, // Should remain false for non-admin import
		Roles:         model.SystemUserRoleId,
	}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(savedUser, nil)

	joinTeamCalled := false
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinTeamCalled = true
			return &model.TeamMember{}, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()

	// Pass false to indicate this is NOT an admin import
	importer := NewWithAdminFlag(store, actions, config, false)

	team := &model.Team{
		Id:   "test-team-id",
		Name: "test-team",
	}

	user := &model.User{
		Username:  "testuser",
		Email:     "testuser@restricted-domain.com",
		FirstName: "Test",
		LastName:  "User",
	}

	result := importer.oldImportUser(rctx, team, user)

	require.NotNil(t, result, "User import should succeed")
	assert.Equal(t, "test-user-id", result.Id, "Should return the saved user")
	assert.False(t, verifyEmailCalled, "NON-ADMIN IMPORT: VerifyEmail should NOT be called for non-admin imports")
	assert.True(t, joinTeamCalled, "User should still be joined to the team")

	// Verify VerifyEmail was NOT called
	userStore.AssertNotCalled(t, "VerifyEmail")
}

// TestSlackImportEnhancedSecurityNoImportingUser tests behavior when no importing user is provided
func TestSlackImportEnhancedSecurityNoImportingUser(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	userStore := &mocks.UserStore{}
	store.On("User").Return(userStore)

	// Track if VerifyEmail is called (it should NOT be called when no importing user)
	verifyEmailCalled := false
	userStore.On("VerifyEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return("user-id", nil).Run(func(args mock.Arguments) {
		verifyEmailCalled = true
	})

	savedUser := &model.User{
		Id:            "test-user-id",
		Username:      "testuser",
		Email:         "testuser@restricted-domain.com",
		EmailVerified: false, // Should remain false when no importing user
		Roles:         model.SystemUserRoleId,
	}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(savedUser, nil)

	joinTeamCalled := false
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinTeamCalled = true
			return &model.TeamMember{}, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()

	// Pass false to indicate no admin privileges (default secure behavior)
	importer := NewWithAdminFlag(store, actions, config, false)

	team := &model.Team{
		Id:   "test-team-id",
		Name: "test-team",
	}

	user := &model.User{
		Username:  "testuser",
		Email:     "testuser@restricted-domain.com",
		FirstName: "Test",
		LastName:  "User",
	}

	result := importer.oldImportUser(rctx, team, user)

	require.NotNil(t, result, "User import should succeed")
	assert.Equal(t, "test-user-id", result.Id, "Should return the saved user")
	assert.False(t, verifyEmailCalled, "NO IMPORTING USER: VerifyEmail should NOT be called when no importing user is provided")
	assert.True(t, joinTeamCalled, "User should still be joined to the team")

	// Verify VerifyEmail was NOT called
	userStore.AssertNotCalled(t, "VerifyEmail")
}

// TestSlackImportEnhancedSecurityBackwardsCompatibility tests that the old New() constructor still works
func TestSlackImportEnhancedSecurityBackwardsCompatibility(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	userStore := &mocks.UserStore{}
	store.On("User").Return(userStore)

	// Track if VerifyEmail is called (it should NOT be called with old constructor)
	verifyEmailCalled := false
	userStore.On("VerifyEmail", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return("user-id", nil).Run(func(args mock.Arguments) {
		verifyEmailCalled = true
	})

	savedUser := &model.User{
		Id:            "test-user-id",
		Username:      "testuser",
		Email:         "testuser@restricted-domain.com",
		EmailVerified: false, // Should remain false with old constructor
		Roles:         model.SystemUserRoleId,
	}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(savedUser, nil)

	joinTeamCalled := false
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinTeamCalled = true
			return &model.TeamMember{}, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()

	// Use the old constructor (backwards compatibility)
	importer := New(store, actions, config)

	team := &model.Team{
		Id:   "test-team-id",
		Name: "test-team",
	}

	user := &model.User{
		Username:  "testuser",
		Email:     "testuser@restricted-domain.com",
		FirstName: "Test",
		LastName:  "User",
	}

	result := importer.oldImportUser(rctx, team, user)

	require.NotNil(t, result, "User import should succeed")
	assert.Equal(t, "test-user-id", result.Id, "Should return the saved user")
	assert.False(t, verifyEmailCalled, "BACKWARDS COMPATIBILITY: VerifyEmail should NOT be called with old constructor")
	assert.True(t, joinTeamCalled, "User should still be joined to the team")

	// Verify VerifyEmail was NOT called
	userStore.AssertNotCalled(t, "VerifyEmail")
}

type slackAddUsersTestSetup struct {
	store     *mocks.Store
	teamStore *mocks.TeamStore
	userStore *mocks.UserStore
	team      *model.Team
	savedUser *model.User
}

func newSlackAddUsersTestSetup(t *testing.T) *slackAddUsersTestSetup {
	t.Helper()

	s := &slackAddUsersTestSetup{}
	s.store = &mocks.Store{}
	s.teamStore = &mocks.TeamStore{}
	s.userStore = &mocks.UserStore{}
	s.store.On("Team").Return(s.teamStore)
	s.store.On("User").Return(s.userStore)

	s.team = &model.Team{Id: "test-team-id", Name: "test-team"}
	s.teamStore.On("Get", "test-team-id").Return(s.team, nil)
	s.userStore.On("GetByEmail", mock.AnythingOfType("string")).Return(nil, fmt.Errorf("not found"))

	s.savedUser = &model.User{Id: "test-user-id", Username: "testuser", Email: "testuser@example.com"}
	s.userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(s.savedUser, nil)

	return s
}

func (s *slackAddUsersTestSetup) newImporter(actions Actions) *SlackImporter {
	config := &model.Config{}
	config.SetDefaults()
	return New(s.store, actions, config)
}

func (s *slackAddUsersTestSetup) newImporterWithAdminFlag(actions Actions, isAdminImport bool) *SlackImporter {
	config := &model.Config{}
	config.SetDefaults()
	return NewWithAdminFlag(s.store, actions, config, isAdminImport)
}

func (s *slackAddUsersTestSetup) defaultActions() Actions {
	return Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			return &model.TeamMember{}, nil
		},
		SendPasswordReset: func(email string) (bool, *model.AppError) {
			return true, nil
		},
	}
}

func defaultSlackUsers() []slackUser {
	return []slackUser{
		{Id: "U001", Username: "testuser", Profile: slackProfile{FirstName: "Test", LastName: "User", Email: "testuser@example.com"}},
	}
}

func TestSlackAddUsersLogContainsProperUserCreationMessage(t *testing.T) {
	rctx := request.TestContext(t)
	s := newSlackAddUsersTestSetup(t)

	importer := s.newImporter(s.defaultActions())
	importerLog := new(bytes.Buffer)
	importer.slackAddUsers(rctx, "test-team-id", defaultSlackUsers(), importerLog)

	logOutput := importerLog.String()
	assert.Contains(t, logOutput, "api.slackimport.slack_add_users.email", "import log should contain the user creation message")
	assert.NotContains(t, logOutput, "api.slackimport.slack_add_users.email_pwd", "import log must not use the old user creation message")
}

func TestSlackAddUsersLogsSendResetEmailFailure(t *testing.T) {
	rctx := request.TestContext(t)
	s := newSlackAddUsersTestSetup(t)

	actions := s.defaultActions()
	actions.SendPasswordReset = func(email string) (bool, *model.AppError) {
		return false, nil
	}

	importer := s.newImporter(actions)
	importerLog := new(bytes.Buffer)
	importer.slackAddUsers(rctx, "test-team-id", defaultSlackUsers(), importerLog)

	assert.Contains(t, importerLog.String(), "api.slackimport.slack_add_users.send_reset_email_failed")
}

func TestSlackAddUsersGeneratesUserWithEmptyPassword(t *testing.T) {
	rctx := request.TestContext(t)
	s := newSlackAddUsersTestSetup(t)

	importer := s.newImporter(s.defaultActions())
	importerLog := new(bytes.Buffer)
	importer.slackAddUsers(rctx, "test-team-id", defaultSlackUsers(), importerLog)

	s.userStore.AssertCalled(t, "Save", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(u *model.User) bool {
		return u.Password == ""
	}))
}

func TestSlackAddUsersTriggersPasswordResetFlow(t *testing.T) {
	rctx := request.TestContext(t)
	s := newSlackAddUsersTestSetup(t)

	passwordResetCalled := false
	actions := s.defaultActions()
	actions.SendPasswordReset = func(email string) (bool, *model.AppError) {
		passwordResetCalled = true
		return true, nil
	}

	importer := s.newImporter(actions)
	importerLog := new(bytes.Buffer)
	importer.slackAddUsers(rctx, "test-team-id", defaultSlackUsers(), importerLog)

	assert.True(t, passwordResetCalled, "SendPasswordReset should be called for each imported user")
}

// TestSlackAddUsersNonAdminImportDoesNotMergeExistingUser tests that a non-admin import does
// not adopt an existing Mattermost account that happens to share an email with a Slack user,
// and instead creates a brand new account for that Slack identity.
func TestSlackAddUsersNonAdminImportDoesNotMergeExistingUser(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	teamStore := &mocks.TeamStore{}
	userStore := &mocks.UserStore{}
	store.On("Team").Return(teamStore)
	store.On("User").Return(userStore)

	team := &model.Team{Id: "test-team-id", Name: "test-team"}
	teamStore.On("Get", "test-team-id").Return(team, nil)

	existingUser := &model.User{Id: "existing-user-id", Username: "existinguser", Email: "shared@example.com"}
	userStore.On("GetByEmail", "shared@example.com").Return(existingUser, nil)

	newUser := &model.User{Id: "new-user-id", Username: "slackuser", Email: "shared@example.com"}
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).Return(newUser, nil)

	var joinedUserIDs []string
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinedUserIDs = append(joinedUserIDs, user.Id)
			return &model.TeamMember{}, nil
		},
		SendPasswordReset: func(email string) (bool, *model.AppError) {
			return true, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()
	importer := NewWithAdminFlag(store, actions, config, false)

	slackUsers := []slackUser{
		{Id: "U001", Username: "slackuser", Profile: slackProfile{FirstName: "Slack", LastName: "User", Email: "shared@example.com"}},
	}

	importerLog := new(bytes.Buffer)
	addedUsers := importer.slackAddUsers(rctx, "test-team-id", slackUsers, importerLog)

	require.Contains(t, addedUsers, "U001")
	assert.Equal(t, "new-user-id", addedUsers["U001"].Id, "non-admin import should not adopt the existing account")
	assert.Len(t, joinedUserIDs, 1, "only the newly created account should be joined to the team")
	assert.NotContains(t, joinedUserIDs, "existing-user-id", "existing account should never be joined to the team by a non-admin import")

	expectedLog := "api.slackimport.slack_add_users.created" +
		"===============\r\n\r\n" +
		"api.slackimport.slack_add_users.merge_existing_skipped_non_admin" +
		"api.slackimport.slack_add_users.email"
	assert.Equal(t, expectedLog, importerLog.String())
}

// TestSlackAddUsersNonAdminImportSaveFailsOnEmailConflict tests that when a non-admin import
// falls through to account creation for a Slack profile whose email matches an existing
// account, and the store rejects the save (as a real database would for a duplicate email),
// no account is added and no creation message is logged.
func TestSlackAddUsersNonAdminImportSaveFailsOnEmailConflict(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	teamStore := &mocks.TeamStore{}
	userStore := &mocks.UserStore{}
	store.On("Team").Return(teamStore)
	store.On("User").Return(userStore)

	team := &model.Team{Id: "test-team-id", Name: "test-team"}
	teamStore.On("Get", "test-team-id").Return(team, nil)

	existingUser := &model.User{Id: "existing-user-id", Username: "existinguser", Email: "shared@example.com"}
	userStore.On("GetByEmail", "shared@example.com").Return(existingUser, nil)
	userStore.On("Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User")).
		Return(nil, model.NewAppError("Save", "app.user.save.email_exists", nil, "", http.StatusBadRequest))

	var joinedUserIDs []string
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinedUserIDs = append(joinedUserIDs, user.Id)
			return &model.TeamMember{}, nil
		},
		SendPasswordReset: func(email string) (bool, *model.AppError) {
			return true, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()
	importer := NewWithAdminFlag(store, actions, config, false)

	slackUsers := []slackUser{
		{Id: "U001", Username: "slackuser", Profile: slackProfile{FirstName: "Slack", LastName: "User", Email: "shared@example.com"}},
	}

	importerLog := new(bytes.Buffer)
	addedUsers := importer.slackAddUsers(rctx, "test-team-id", slackUsers, importerLog)

	assert.NotContains(t, addedUsers, "U001", "no account should be added when the save fails")
	assert.Empty(t, joinedUserIDs, "no account should be joined to the team when the save fails")
	assert.NotContains(t, importerLog.String(), "api.slackimport.slack_add_users.email", "no creation message should be logged when the save fails")
	assert.Contains(t, importerLog.String(), "api.slackimport.slack_add_users.unable_import")
	userStore.AssertCalled(t, "Save", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.User"))
}

// TestSlackAddUsersAdminImportMergesExistingUser tests that an admin import preserves the
// existing behavior of adopting an existing Mattermost account that shares an email with a
// Slack user.
func TestSlackAddUsersAdminImportMergesExistingUser(t *testing.T) {
	rctx := request.TestContext(t)

	store := &mocks.Store{}
	teamStore := &mocks.TeamStore{}
	userStore := &mocks.UserStore{}
	store.On("Team").Return(teamStore)
	store.On("User").Return(userStore)

	team := &model.Team{Id: "test-team-id", Name: "test-team"}
	teamStore.On("Get", "test-team-id").Return(team, nil)

	existingUser := &model.User{Id: "existing-user-id", Username: "existinguser", Email: "shared@example.com"}
	userStore.On("GetByEmail", "shared@example.com").Return(existingUser, nil)

	var joinedUserIDs []string
	actions := Actions{
		JoinUserToTeam: func(team *model.Team, user *model.User, userRequestorId string) (*model.TeamMember, *model.AppError) {
			joinedUserIDs = append(joinedUserIDs, user.Id)
			return &model.TeamMember{}, nil
		},
		SendPasswordReset: func(email string) (bool, *model.AppError) {
			return true, nil
		},
	}

	config := &model.Config{}
	config.SetDefaults()
	importer := NewWithAdminFlag(store, actions, config, true)

	slackUsers := []slackUser{
		{Id: "U001", Username: "slackuser", Profile: slackProfile{FirstName: "Slack", LastName: "User", Email: "shared@example.com"}},
	}

	importerLog := new(bytes.Buffer)
	addedUsers := importer.slackAddUsers(rctx, "test-team-id", slackUsers, importerLog)

	require.Contains(t, addedUsers, "U001")
	assert.Equal(t, "existing-user-id", addedUsers["U001"].Id, "admin import should still adopt the existing account")
	assert.Contains(t, joinedUserIDs, "existing-user-id")

	userStore.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)

	expectedLog := "api.slackimport.slack_add_users.created" +
		"===============\r\n\r\n" +
		"api.slackimport.slack_add_users.merge_existing"
	assert.Equal(t, expectedLog, importerLog.String())
}

// TestSlackAddUsersCreatesNewAccountWhenNoExistingMatch tests that when no existing account
// matches the Slack user's email, a new account is created and joined to the team, regardless
// of whether the import is an admin import.
func TestSlackAddUsersCreatesNewAccountWhenNoExistingMatch(t *testing.T) {
	rctx := request.TestContext(t)
	s := newSlackAddUsersTestSetup(t)

	importer := s.newImporterWithAdminFlag(s.defaultActions(), false)
	importerLog := new(bytes.Buffer)
	addedUsers := importer.slackAddUsers(rctx, "test-team-id", defaultSlackUsers(), importerLog)

	require.Contains(t, addedUsers, "U001")
	assert.Equal(t, s.savedUser.Id, addedUsers["U001"].Id)
	assert.Contains(t, importerLog.String(), "api.slackimport.slack_add_users.email")
}
