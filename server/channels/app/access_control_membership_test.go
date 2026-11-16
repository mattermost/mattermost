// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/config"
)

func enableAccessControlAuditLogging(th *TestHelper, enabled bool) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAccessControlAuditLogging = model.NewPointer(enabled)
	})
}

func attachAccessControlAuditCapture(t *testing.T, th *TestHelper) func() []map[string]any {
	t.Helper()

	dir := filepath.Join(config.GetLogRootPath(), "abac-audit-"+model.NewId())
	require.NoError(t, os.MkdirAll(dir, 0700))
	t.Cleanup(func() { _ = os.RemoveAll(dir) })

	path := filepath.Join(dir, "audit.log")
	options, err := json.Marshal(map[string]string{"filename": path})
	require.NoError(t, err)

	require.NoError(t, th.App.Srv().Audit.Configure(mlog.LoggerConfiguration{
		"test-capture": {
			Type:    "file",
			Format:  "json",
			Levels:  []mlog.Level{mlog.LvlAuditCLI, mlog.LvlAuditAPI, mlog.LvlAuditPerms, mlog.LvlAuditContent},
			Options: options,
		},
	}))

	return func() []map[string]any {
		t.Helper()
		require.NoError(t, th.App.Srv().Audit.Flush())

		data, readErr := os.ReadFile(path)
		if os.IsNotExist(readErr) || len(data) == 0 {
			return nil
		}
		require.NoError(t, readErr)

		var out []map[string]any
		for _, line := range splitNonEmptyLines(string(data)) {
			var rec map[string]any
			require.NoError(t, json.Unmarshal([]byte(line), &rec))
			out = append(out, rec)
		}
		return out
	}
}

func splitNonEmptyLines(s string) []string {
	var lines []string
	start := 0
	for i := range len(s) {
		if s[i] != '\n' {
			continue
		}
		if i > start {
			lines = append(lines, s[start:i])
		}
		start = i + 1
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

func auditEventName(rec map[string]any) string {
	name, _ := rec["event_name"].(string)
	return name
}

func auditStatus(rec map[string]any) string {
	status, _ := rec["status"].(string)
	return status
}

func auditParams(rec map[string]any) map[string]any {
	event, _ := rec["event"].(map[string]any)
	if event == nil {
		return map[string]any{}
	}
	params, _ := event["parameters"].(map[string]any)
	if params == nil {
		return map[string]any{}
	}
	return params
}

func auditsForJob(records []map[string]any, jobID string) []map[string]any {
	var out []map[string]any
	for _, rec := range records {
		if params := auditParams(rec); params["job_id"] == jobID {
			out = append(out, rec)
		}
	}
	return out
}

func auditsNamed(records []map[string]any, eventName string) []map[string]any {
	var out []map[string]any
	for _, rec := range records {
		if auditEventName(rec) == eventName {
			out = append(out, rec)
		}
	}
	return out
}

func requireAuditParam(t *testing.T, rec map[string]any, key string, expected any) {
	t.Helper()
	params := auditParams(rec)
	require.Contains(t, params, key)
	require.EqualValues(t, expected, params[key])
}

func saveTeamPolicyForAuditTests(t *testing.T, th *TestHelper, teamID string) {
	t.Helper()
	policy := &model.AccessControlPolicy{
		ID:       teamID,
		Type:     model.AccessControlPolicyTypeTeam,
		Name:     "policy-" + teamID,
		Active:   true,
		Revision: 4,
		Version:  model.AccessControlPolicyVersionV0_3,
		Imports:  []string{},
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
		},
	}
	_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, teamID)
	})
}

func countDMPostsOfType(t *testing.T, th *TestHelper, userID, postType string) int {
	t.Helper()
	bot, appErr := th.App.GetSystemBot(th.Context)
	require.Nil(t, appErr)
	channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, userID, bot.UserId)
	require.Nil(t, appErr)
	list, appErr := th.App.GetPosts(th.Context, channel.Id, 0, 50)
	require.Nil(t, appErr)

	count := 0
	for _, post := range list.Posts {
		if post.Type == postType {
			count++
		}
	}
	return count
}

func TestAddChannelMemberByAccessPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	readAudits := attachAccessControlAuditCapture(t, th)

	channel := th.CreateChannel(t, th.BasicTeam)
	jobID := "job-add-channel-" + model.NewId()

	t.Run("happy path emits membership add audit", func(t *testing.T) {
		enableAccessControlAuditLogging(th, true)

		require.False(t, th.App.channelMembershipExists(th.Context, channel.Id, th.BasicUser2.Id))
		appErr := th.App.AddChannelMemberByAccessPolicy(th.Context, channel, th.BasicUser2.Id, jobID, 7)
		require.Nil(t, appErr)
		require.True(t, th.App.channelMembershipExists(th.Context, channel.Id, th.BasicUser2.Id))

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventChannelMembershipAdded)
		require.Len(t, recs, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(recs[0]))
		requireAuditParam(t, recs[0], "policy_id", channel.Id)
		requireAuditParam(t, recs[0], "policy_revision", 7)
		requireAuditParam(t, recs[0], "resource_type", AccessControlAuditResourceChannel)
		requireAuditParam(t, recs[0], "resource_id", channel.Id)
		requireAuditParam(t, recs[0], "user_id", th.BasicUser2.Id)
		requireAuditParam(t, recs[0], "action", AccessControlAuditActionAdd)
		requireAuditParam(t, recs[0], "reason", AccessControlAuditReasonMatchesPolicy)
	})

	t.Run("already a member still records the decision", func(t *testing.T) {
		enableAccessControlAuditLogging(th, true)
		jobIDAlready := "job-add-channel-already-" + model.NewId()

		appErr := th.App.AddChannelMemberByAccessPolicy(th.Context, channel, th.BasicUser2.Id, jobIDAlready, 7)
		require.Nil(t, appErr)

		recs := auditsNamed(auditsForJob(readAudits(), jobIDAlready), model.AuditEventChannelMembershipAdded)
		require.Len(t, recs, 1)
	})

	t.Run("disabled flag does not emit an audit", func(t *testing.T) {
		enableAccessControlAuditLogging(th, false)
		jobIDOff := "job-add-channel-off-" + model.NewId()
		other := th.CreateUser(t)
		th.LinkUserToTeam(t, other, th.BasicTeam)

		appErr := th.App.AddChannelMemberByAccessPolicy(th.Context, channel, other.Id, jobIDOff, 7)
		require.Nil(t, appErr)
		require.True(t, th.App.channelMembershipExists(th.Context, channel.Id, other.Id))
		require.Empty(t, auditsForJob(readAudits(), jobIDOff))
	})
}

func TestRemoveChannelMemberByAccessPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	readAudits := attachAccessControlAuditCapture(t, th)
	enableAccessControlAuditLogging(th, true)

	channel := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser2, channel)

	t.Run("happy path emits membership remove audit", func(t *testing.T) {
		jobID := "job-remove-channel-" + model.NewId()
		appErr := th.App.RemoveChannelMemberByAccessPolicy(th.Context, channel, th.BasicUser2.Id, jobID, 3)
		require.Nil(t, appErr)
		require.False(t, th.App.channelMembershipExists(th.Context, channel.Id, th.BasicUser2.Id))

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventChannelMembershipRemoved)
		require.Len(t, recs, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(recs[0]))
		requireAuditParam(t, recs[0], "policy_id", channel.Id)
		requireAuditParam(t, recs[0], "policy_revision", 3)
		requireAuditParam(t, recs[0], "action", AccessControlAuditActionRemove)
		requireAuditParam(t, recs[0], "reason", AccessControlAuditReasonNoLongerMatches)
		requireAuditParam(t, recs[0], "user_id", th.BasicUser2.Id)
	})

	t.Run("already absent still records the decision and returns the original error", func(t *testing.T) {
		jobID := "job-remove-channel-absent-" + model.NewId()
		appErr := th.App.RemoveChannelMemberByAccessPolicy(th.Context, channel, th.BasicUser2.Id, jobID, 3)
		require.NotNil(t, appErr)
		require.False(t, th.App.channelMembershipExists(th.Context, channel.Id, th.BasicUser2.Id))

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventChannelMembershipRemoved)
		require.Len(t, recs, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(recs[0]))
	})

	t.Run("disabled flag does not emit an audit", func(t *testing.T) {
		enableAccessControlAuditLogging(th, false)
		th.AddUserToChannel(t, th.BasicUser2, channel)
		jobID := "job-remove-channel-off-" + model.NewId()

		appErr := th.App.RemoveChannelMemberByAccessPolicy(th.Context, channel, th.BasicUser2.Id, jobID, 3)
		require.Nil(t, appErr)
		require.False(t, th.App.channelMembershipExists(th.Context, channel.Id, th.BasicUser2.Id))
		require.Empty(t, auditsForJob(readAudits(), jobID))
	})
}

func TestAddTeamMemberByAccessPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	readAudits := attachAccessControlAuditCapture(t, th)
	enableAccessControlAuditLogging(th, true)

	systemBot, botErr := th.App.GetSystemBot(th.Context)
	require.Nil(t, botErr)

	t.Run("happy path emits audit and addition DM", func(t *testing.T) {
		user := th.CreateUser(t)
		jobID := "job-add-team-" + model.NewId()
		before := countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamAddition)

		appErr := th.App.AddTeamMemberByAccessPolicy(th.Context, th.BasicTeam, systemBot, user.Id, jobID, 2)
		require.Nil(t, appErr)
		require.True(t, th.App.teamMembershipExists(th.Context, th.BasicTeam.Id, user.Id))
		require.Equal(t, before+1, countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamAddition))

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventTeamMembershipAdded)
		require.Len(t, recs, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(recs[0]))
		requireAuditParam(t, recs[0], "policy_id", th.BasicTeam.Id)
		requireAuditParam(t, recs[0], "policy_revision", 2)
		requireAuditParam(t, recs[0], "resource_type", AccessControlAuditResourceTeam)
		requireAuditParam(t, recs[0], "resource_id", th.BasicTeam.Id)
		requireAuditParam(t, recs[0], "user_id", user.Id)
		requireAuditParam(t, recs[0], "action", AccessControlAuditActionAdd)
		requireAuditParam(t, recs[0], "reason", AccessControlAuditReasonMatchesPolicy)
	})

	t.Run("already a member still records the decision", func(t *testing.T) {
		jobID := "job-add-team-already-" + model.NewId()
		appErr := th.App.AddTeamMemberByAccessPolicy(th.Context, th.BasicTeam, systemBot, th.BasicUser.Id, jobID, 2)
		require.Nil(t, appErr)

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventTeamMembershipAdded)
		require.Len(t, recs, 1)
	})

	t.Run("DM failure is best-effort and does not undo the add", func(t *testing.T) {
		user := th.CreateUser(t)
		jobID := "job-add-team-nodm-" + model.NewId()
		missingBot := &model.Bot{UserId: model.NewId()}

		appErr := th.App.AddTeamMemberByAccessPolicy(th.Context, th.BasicTeam, missingBot, user.Id, jobID, 2)
		require.Nil(t, appErr)
		require.True(t, th.App.teamMembershipExists(th.Context, th.BasicTeam.Id, user.Id))

		recs := auditsNamed(auditsForJob(readAudits(), jobID), model.AuditEventTeamMembershipAdded)
		require.Len(t, recs, 1)
	})

	t.Run("SendTeamAccessControlAdditionNotification does not emit an audit", func(t *testing.T) {
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, th.BasicTeam)
		before := len(auditsNamed(readAudits(), model.AuditEventTeamMembershipAdded))

		appErr := th.App.SendTeamAccessControlAdditionNotification(th.Context, systemBot, user.Id, th.BasicTeam)
		require.Nil(t, appErr)
		require.Len(t, auditsNamed(readAudits(), model.AuditEventTeamMembershipAdded), before)
	})
}

func TestRemoveTeamMemberByAccessPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	readAudits := attachAccessControlAuditCapture(t, th)
	enableAccessControlAuditLogging(th, true)

	systemBot, botErr := th.App.GetSystemBot(th.Context)
	require.Nil(t, botErr)

	t.Run("policy-driven remove emits parent, cascade, and removal DM", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicyForAuditTests(t, th, team.Id)
		th.LinkUserToTeam(t, th.BasicUser, team)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, team)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, user, channel)

		jobID := "job-remove-team-" + model.NewId()
		before := countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamRemoval)

		appErr := th.App.RemoveTeamMemberByAccessPolicy(th.Context, team, systemBot, user.Id, jobID, 9)
		require.Nil(t, appErr)
		require.False(t, th.App.teamMembershipExists(th.Context, team.Id, user.Id))
		require.False(t, th.App.channelMembershipExists(th.Context, channel.Id, user.Id))
		require.Equal(t, before+1, countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamRemoval))

		all := auditsForJob(readAudits(), jobID)
		parent := auditsNamed(all, model.AuditEventTeamMembershipRemoved)
		require.Len(t, parent, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(parent[0]))
		requireAuditParam(t, parent[0], "policy_id", team.Id)
		requireAuditParam(t, parent[0], "policy_revision", 9)
		requireAuditParam(t, parent[0], "resource_type", AccessControlAuditResourceTeam)
		requireAuditParam(t, parent[0], "action", AccessControlAuditActionRemove)
		requireAuditParam(t, parent[0], "reason", AccessControlAuditReasonNoLongerMatches)
		parentEventID, _ := auditParams(parent[0])["event_id"].(string)
		require.NotEmpty(t, parentEventID)

		cascades := auditsNamed(all, model.AuditEventTeamCascadedChannelRemoval)
		require.NotEmpty(t, cascades)
		foundChannel := false
		for _, rec := range cascades {
			require.Equal(t, model.AuditStatusSuccess, auditStatus(rec))
			requireAuditParam(t, rec, "policy_id", team.Id)
			requireAuditParam(t, rec, "policy_revision", 9)
			requireAuditParam(t, rec, "resource_type", AccessControlAuditResourceChannel)
			requireAuditParam(t, rec, "reason", AccessControlAuditReasonTeamCascade)
			requireAuditParam(t, rec, "parent_event_id", parentEventID)
			if auditParams(rec)["resource_id"] == channel.Id {
				foundChannel = true
			}
		}
		require.True(t, foundChannel)
	})

	t.Run("already absent still notifies and returns the original error", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicyForAuditTests(t, th, team.Id)
		user := th.CreateUser(t)
		jobID := "job-remove-team-absent-" + model.NewId()
		before := countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamRemoval)

		appErr := th.App.RemoveTeamMemberByAccessPolicy(th.Context, team, systemBot, user.Id, jobID, 9)
		require.NotNil(t, appErr)
		require.False(t, th.App.teamMembershipExists(th.Context, team.Id, user.Id))
		require.Equal(t, before+1, countDMPostsOfType(t, th, user.Id, model.PostTypeAccessControlTeamRemoval))
	})

	t.Run("disabled flag still removes without emitting audits", func(t *testing.T) {
		enableAccessControlAuditLogging(th, false)
		team := th.CreateTeam(t)
		saveTeamPolicyForAuditTests(t, th, team.Id)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, team)
		jobID := "job-remove-team-off-" + model.NewId()

		appErr := th.App.RemoveTeamMemberByAccessPolicy(th.Context, team, systemBot, user.Id, jobID, 9)
		require.Nil(t, appErr)
		require.False(t, th.App.teamMembershipExists(th.Context, team.Id, user.Id))
		require.Empty(t, auditsForJob(readAudits(), jobID))
	})
}

func TestLeaveTeamPolicyDrivenAudit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	readAudits := attachAccessControlAuditCapture(t, th)
	enableAccessControlAuditLogging(th, true)

	t.Run("syncCtx stamps job id and revision onto parent and cascades", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicyForAuditTests(t, th, team.Id)
		th.LinkUserToTeam(t, th.BasicUser, team)
		fetched, appErr := th.App.GetTeam(team.Id)
		require.Nil(t, appErr)
		require.True(t, fetched.PolicyEnforced)

		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, team)
		channel := th.CreateChannel(t, team)
		th.AddUserToChannel(t, user, channel)

		jobID := "job-leave-syncctx-" + model.NewId()
		appErr = th.App.leaveTeam(th.Context, fetched, user, "", &accessControlSyncContext{jobID: jobID, policyRevision: 11})
		require.Nil(t, appErr)

		all := auditsForJob(readAudits(), jobID)
		parent := auditsNamed(all, model.AuditEventTeamMembershipRemoved)
		require.Len(t, parent, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(parent[0]))
		requireAuditParam(t, parent[0], "policy_revision", 11)
		parentEventID, _ := auditParams(parent[0])["event_id"].(string)
		require.NotEmpty(t, parentEventID)

		cascades := auditsNamed(all, model.AuditEventTeamCascadedChannelRemoval)
		require.NotEmpty(t, cascades)
		for _, rec := range cascades {
			requireAuditParam(t, rec, "policy_revision", 11)
			requireAuditParam(t, rec, "parent_event_id", parentEventID)
			requireAuditParam(t, rec, "reason", AccessControlAuditReasonTeamCascade)
		}
	})

	t.Run("nil syncCtx resolves revision from the stored policy", func(t *testing.T) {
		team := th.CreateTeam(t)
		saveTeamPolicyForAuditTests(t, th, team.Id)
		fetched, appErr := th.App.GetTeam(team.Id)
		require.Nil(t, appErr)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, team)

		appErr = th.App.leaveTeam(th.Context, fetched, user, "", nil)
		require.Nil(t, appErr)

		stored, storeErr := th.App.Srv().Store().AccessControlPolicy().Get(th.Context, team.Id)
		require.NoError(t, storeErr)
		require.NotNil(t, stored)

		var parent []map[string]any
		for _, rec := range auditsNamed(readAudits(), model.AuditEventTeamMembershipRemoved) {
			if auditParams(rec)["user_id"] == user.Id && auditParams(rec)["resource_id"] == team.Id {
				parent = append(parent, rec)
			}
		}
		require.Len(t, parent, 1)
		require.Equal(t, model.AuditStatusSuccess, auditStatus(parent[0]))
		requireAuditParam(t, parent[0], "policy_revision", stored.Revision)
		_, hasJobID := auditParams(parent[0])["job_id"]
		require.False(t, hasJobID)
	})

	t.Run("deferred parent stays failed when default-channel lookup errors after a cascade", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.ExperimentalEnableDefaultChannelLeaveJoinMessages = true
		})

		id := model.NewId()
		team, nErr := th.App.Srv().Store().Team().Save(&model.Team{
			DisplayName:     "dn_" + id,
			Name:            "name" + id,
			Email:           th.MakeEmail(),
			Type:            model.TeamOpen,
			AllowOpenInvite: true,
		})
		require.NoError(t, nErr)
		team.PolicyEnforced = true

		user := th.CreateUser(t)
		_, nErr = th.App.Srv().Store().Team().SaveMember(th.Context, &model.TeamMember{
			TeamId:     team.Id,
			UserId:     user.Id,
			SchemeUser: true,
		}, 100)
		require.NoError(t, nErr)

		channel, nErr := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
			TeamId:      team.Id,
			DisplayName: "chan",
			Name:        "chan-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}, -1)
		require.NoError(t, nErr)
		_, nErr = th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
			ChannelId:   channel.Id,
			UserId:      user.Id,
			NotifyProps: model.GetDefaultChannelNotifyProps(),
			SchemeUser:  true,
		})
		require.NoError(t, nErr)

		jobID := "job-leave-fail-parent-" + model.NewId()
		appErr := th.App.leaveTeam(th.Context, team, user, "", &accessControlSyncContext{jobID: jobID, policyRevision: 5})
		require.NotNil(t, appErr)

		all := auditsForJob(readAudits(), jobID)
		parent := auditsNamed(all, model.AuditEventTeamMembershipRemoved)
		require.Len(t, parent, 1)
		require.Equal(t, model.AuditStatusFail, auditStatus(parent[0]))
		parentEventID, _ := auditParams(parent[0])["event_id"].(string)
		require.NotEmpty(t, parentEventID)

		cascades := auditsNamed(all, model.AuditEventTeamCascadedChannelRemoval)
		require.Len(t, cascades, 1)
		requireAuditParam(t, cascades[0], "resource_id", channel.Id)
		requireAuditParam(t, cascades[0], "parent_event_id", parentEventID)
	})

	t.Run("non-policy leave emits nothing", func(t *testing.T) {
		team := th.CreateTeam(t)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, team)
		jobID := "job-leave-unrelated-" + model.NewId()

		appErr := th.App.leaveTeam(th.Context, team, user, "", &accessControlSyncContext{jobID: jobID, policyRevision: 1})
		require.Nil(t, appErr)
		require.Empty(t, auditsForJob(readAudits(), jobID))
	})
}
