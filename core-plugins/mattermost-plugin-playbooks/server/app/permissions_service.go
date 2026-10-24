// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"reflect"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
)

// ErrNoPermissions if the error is caused by the user not having permissions
var ErrNoPermissions = errors.New("does not have permissions")

// ErrLicensedFeature if the error is caused by the server not having the needed license for the feature
var ErrLicensedFeature = errors.New("not covered by current server license")

type LicenseChecker interface {
	PlaybookAllowed(isPlaybookPublic bool) bool
	RetrospectiveAllowed() bool
	TimelineAllowed() bool
	StatsAllowed() bool
	ChecklistItemDueDateAllowed() bool
	PlaybookAttributesAllowed() bool
	ConditionalPlaybooksAllowed() bool
}

type PermissionsService struct {
	playbookService PlaybookService
	runService      PlaybookRunService
	pluginAPI       *pluginapi.Client
	configService   config.Service
	licenseChecker  LicenseChecker
}

func NewPermissionsService(
	playbookService PlaybookService,
	runService PlaybookRunService,
	pluginAPI *pluginapi.Client,
	configService config.Service,
	licenseChecker LicenseChecker,
) *PermissionsService {
	return &PermissionsService{
		playbookService,
		runService,
		pluginAPI,
		configService,
		licenseChecker,
	}
}

func (p *PermissionsService) PlaybookIsPublic(playbook Playbook) bool {
	return playbook.Public
}

func (p *PermissionsService) getPlaybookRole(userID string, playbook Playbook) []string {
	if !p.canViewTeam(userID, playbook.TeamID) {
		return []string{}
	}

	for _, member := range playbook.Members {
		if member.UserID == userID {
			return member.SchemeRoles
		}
	}

	// Public playbooks
	if playbook.Public {
		// Public playbooks are public to those who can list channels on a team. (Not guests)
		if p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PermissionListTeamChannels) {
			if playbook.DefaultPlaybookMemberRole == "" {
				return []string{playbook.DefaultPlaybookMemberRole}
			}
			return []string{PlaybookRoleMember}
		}
	}

	return []string{}
}

func (p *PermissionsService) hasPermissionsToPlaybook(userID string, playbook Playbook, permission *model.Permission) bool {
	// Check at playbook level
	if p.pluginAPI.User.RolesGrantPermission(p.getPlaybookRole(userID, playbook), permission.Id) {
		return true
	}

	// Cascade normally to higher level permissions
	return p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, permission)
}

func (p *PermissionsService) canViewTeam(userID string, teamID string) bool {
	if teamID == "" || userID == "" {
		return false
	}

	return p.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam)
}

func (p *PermissionsService) PlaybookCreate(userID string, playbook Playbook) error {
	if !p.licenseChecker.PlaybookAllowed(p.PlaybookIsPublic(playbook)) {
		return errors.Wrapf(ErrLicensedFeature, "the playbook is not valid with the current license")
	}

	// Check the user has permissions over all broadcast channels
	for _, channelID := range playbook.BroadcastChannelIDs {
		if !p.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
			return errors.Errorf("user `%s` does not have permission to create posts in channel `%s`", userID, channelID)
		}
	}

	// Check all invited users have permissions to the team.
	for _, userID := range playbook.InvitedUserIDs {
		if !p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, model.PermissionViewTeam) {
			return errors.Errorf(
				"invited user `%s` does not have permission to playbook's team `%s`",
				userID,
				playbook.TeamID,
			)
		}
	}

	// Respect setting for not allowing mentions of a group.
	for _, groupID := range playbook.InvitedGroupIDs {
		group, err := p.pluginAPI.Group.Get(groupID)
		if err != nil {
			return errors.Wrap(err, "invalid group")
		}

		if !group.AllowReference {
			return errors.Errorf(
				"group `%s` does not allow references",
				groupID,
			)
		}
	}

	// Check general permissions
	permission := model.PermissionPrivatePlaybookCreate
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookCreate
	}

	if p.pluginAPI.User.HasPermissionToTeam(userID, playbook.TeamID, permission) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to create playbook", userID)
}

func (p *PermissionsService) PlaybookManageProperties(userID string, playbook Playbook) error {
	permission := model.PermissionPrivatePlaybookManageProperties
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookManageProperties
	}

	if p.hasPermissionsToPlaybook(userID, playbook, permission) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have access to playbook `%s`", userID, playbook.ID)
}

// PlaybookManageConditions returns an error if the user cannot manage conditions for the playbook
func (p *PermissionsService) PlaybookManageConditions(userID string, playbook Playbook) error {
	if !p.licenseChecker.ConditionalPlaybooksAllowed() {
		return errors.Wrapf(ErrLicensedFeature, "conditional playbooks feature is not covered by current server license")
	}

	return p.PlaybookManageProperties(userID, playbook)
}

// PlaybookViewConditions returns an error if the user cannot view conditions for the playbook
func (p *PermissionsService) PlaybookViewConditions(userID string, playbookID string) error {
	if !p.licenseChecker.ConditionalPlaybooksAllowed() {
		return errors.Wrapf(ErrLicensedFeature, "conditional playbooks feature is not covered by current server license")
	}

	return p.PlaybookView(userID, playbookID)
}

// RunViewConditions returns an error if the user cannot view conditions for the run
func (p *PermissionsService) RunViewConditions(userID string, runID string) error {
	if !p.licenseChecker.ConditionalPlaybooksAllowed() {
		return errors.Wrapf(ErrLicensedFeature, "conditional playbooks feature is not covered by current server license")
	}

	return p.RunView(userID, runID)
}

// PlaybookodifyWithFixes checks both ManageProperties and ManageMembers permissions
// performs permissions checks that can be resolved though modification of the input.
// This function modifies the playbook argument.
func (p *PermissionsService) PlaybookModifyWithFixes(userID string, playbook *Playbook, oldPlaybook Playbook) error {
	// It is assumed that if you are calling this function there are properties changes
	// This means that you need the manage properties permission to manage members for now.
	if err := p.PlaybookManageProperties(userID, oldPlaybook); err != nil {
		return err
	}

	if err := p.NoAddedBroadcastChannelsWithoutPermission(userID, playbook.BroadcastChannelIDs, oldPlaybook.BroadcastChannelIDs); err != nil {
		return err
	}

	filteredUsers := p.FilterInvitedUserIDs(playbook.InvitedUserIDs, playbook.TeamID)
	playbook.InvitedUserIDs = filteredUsers

	filteredGroups := p.FilterInvitedGroupIDs(playbook.InvitedGroupIDs)
	playbook.InvitedGroupIDs = filteredGroups

	if playbook.DefaultOwnerID != "" {
		if !p.pluginAPI.User.HasPermissionToTeam(playbook.DefaultOwnerID, playbook.TeamID, model.PermissionViewTeam) {
			logrus.WithFields(logrus.Fields{
				"team_id": playbook.TeamID,
				"user_id": playbook.DefaultOwnerID,
			}).Warn("owner is not a member of the playbook's team, disabling default owner")
			playbook.DefaultOwnerID = ""
			playbook.DefaultOwnerEnabled = false
		}
	}

	// Check if we have changed members, if so check that permission.
	if !reflect.DeepEqual(oldPlaybook.Members, playbook.Members) {
		if err := p.PlaybookManageMembers(userID, oldPlaybook); err != nil {
			return errors.Wrap(err, "attempted to modify members without permissions")
		}

		oldMemberRoles := map[string]string{}
		for _, member := range oldPlaybook.Members {
			oldMemberRoles[member.UserID] = strings.Join(member.Roles, ",")
		}

		// Also need to check if roles changed. If so we need to check manage roles permission.
		for _, member := range playbook.Members {
			oldRoles, memberExisted := oldMemberRoles[member.UserID]
			userAddedAsMember := !memberExisted && len(member.Roles) == 1 && member.Roles[0] == PlaybookRoleMember
			rolesHaveNotChanged := memberExisted && strings.Join(member.Roles, ",") == oldRoles
			if !userAddedAsMember && !rolesHaveNotChanged {
				if err := p.PlaybookManageRoles(userID, oldPlaybook); err != nil {
					return errors.Wrap(err, "attempted to modify members without permissions")
				}
				break
			}
		}
	}

	// Check if team is being changed
	if oldPlaybook.TeamID != playbook.TeamID {
		// Require ManageMembers permission (since changing teams effectively removes members not in destination team)
		// This is the fix for MM-66474 - prevents privilege escalation when users only have "Manage Playbook Configurations"
		if err := p.PlaybookManageMembers(userID, oldPlaybook); err != nil {
			return errors.Wrap(err, "attempted to change playbook team without manage members permission")
		}

		// Verify user has access to destination team
		if !p.canViewTeam(userID, playbook.TeamID) {
			return errors.Wrapf(ErrNoPermissions, "user `%s` does not have access to destination team `%s`", userID, playbook.TeamID)
		}
	}

	// Check if we have done a public conversion
	if oldPlaybook.Public != playbook.Public {
		if oldPlaybook.Public {
			if err := p.PlaybookMakePrivate(userID, oldPlaybook); err != nil {
				return errors.Wrap(err, "attempted to make playbook private without permissions")
			}
		} else {
			if err := p.PlaybookMakePublic(userID, oldPlaybook); err != nil {
				return errors.Wrap(err, "attempted to make playbook public without permissions")
			}
		}
	}

	if !p.licenseChecker.PlaybookAllowed(p.PlaybookIsPublic(*playbook)) {
		return errors.Wrapf(ErrLicensedFeature, "the playbook is not valid with the current license")
	}

	return nil
}

func (p *PermissionsService) FilterInvitedUserIDs(invitedUserIDs []string, teamID string) []string {
	filteredUsers := []string{}
	for _, userID := range invitedUserIDs {
		if !p.pluginAPI.User.HasPermissionToTeam(userID, teamID, model.PermissionViewTeam) {
			logrus.WithFields(logrus.Fields{
				"team_id": teamID,
				"user_id": userID,
			}).Warn("user does not have permissions to playbook's team, removing from automated invite list")
			continue
		}
		filteredUsers = append(filteredUsers, userID)
	}
	return filteredUsers
}

func (p *PermissionsService) FilterInvitedGroupIDs(invitedGroupIDs []string) []string {
	filteredGroups := []string{}
	for _, groupID := range invitedGroupIDs {
		var group *model.Group
		group, err := p.pluginAPI.Group.Get(groupID)
		if err != nil {
			logrus.WithField("group_id", groupID).Error("failed to query group")
			continue
		}

		if !group.AllowReference {
			logrus.WithField("group_id", groupID).Warn("group does not allow references, removing from automated invite list")
			continue
		}

		filteredGroups = append(filteredGroups, groupID)
	}
	return filteredGroups
}

func (p *PermissionsService) DeletePlaybook(userID string, playbook Playbook) error {
	return p.PlaybookManageProperties(userID, playbook)
}

func (p *PermissionsService) NoAddedBroadcastChannelsWithoutPermission(userID string, broadcastChannelIDs, oldBroadcastChannelIDs []string) error {
	oldChannelsSet := make(map[string]bool)
	for _, channelID := range oldBroadcastChannelIDs {
		oldChannelsSet[channelID] = true
	}

	for _, channelID := range broadcastChannelIDs {
		if !oldChannelsSet[channelID] &&
			!p.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost) {
			return errors.Wrapf(
				ErrNoPermissions,
				"user `%s` does not have permission to create posts in channel `%s`",
				userID,
				channelID,
			)
		}
	}

	return nil
}

func (p *PermissionsService) PlaybookManageMembers(userID string, playbook Playbook) error {
	permission := model.PermissionPrivatePlaybookManageMembers
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookManageMembers
	}

	if p.hasPermissionsToPlaybook(userID, playbook, permission) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to manage members for playbook `%s`", userID, playbook.ID)
}

func (p *PermissionsService) PlaybookManageRoles(userID string, playbook Playbook) error {
	permission := model.PermissionPrivatePlaybookManageRoles
	if p.PlaybookIsPublic(playbook) {
		permission = model.PermissionPublicPlaybookManageRoles
	}

	if p.hasPermissionsToPlaybook(userID, playbook, permission) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to manage roles for playbook `%s`", userID, playbook.ID)
}

func (p *PermissionsService) PlaybookView(userID string, playbookID string) error {
	playbook, err := p.playbookService.Get(playbookID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get playbook to determine permissions, playbook id `%s`", playbookID)
	}

	return p.PlaybookViewWithPlaybook(userID, playbook)
}

func (p *PermissionsService) PlaybookList(userID, teamID string) error {
	// Can list playbooks if you are on the team
	if p.canViewTeam(userID, teamID) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to list playbooks for team `%s`", userID, teamID)
}

func (p *PermissionsService) PlaybookViewWithPlaybook(userID string, playbook Playbook) error {
	noAccessErr := errors.Wrapf(
		ErrNoPermissions,
		"user `%s` to access playbook `%s`",
		userID,
		playbook.ID,
	)

	// Playbooks are tied to teams. You must have permission to the team to have permission to the playbook.
	if !p.canViewTeam(userID, playbook.TeamID) {
		return errors.Wrapf(noAccessErr, "no playbook access; no team view permission for team `%s`", playbook.TeamID)
	}

	if p.PlaybookIsPublic(playbook) {
		if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPublicPlaybookView) {
			return nil
		}
	}

	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPrivatePlaybookView) {
		return nil
	}

	return noAccessErr
}

// FilterPlaybooksByViewPermission returns only the playbooks the user has permission to view.
func (p *PermissionsService) FilterPlaybooksByViewPermission(userID string, playbooks []Playbook) []Playbook {
	filtered := make([]Playbook, 0, len(playbooks))
	for _, playbook := range playbooks {
		if p.PlaybookViewWithPlaybook(userID, playbook) == nil {
			filtered = append(filtered, playbook)
		}
	}
	return filtered
}

func (p *PermissionsService) PlaybookMakePrivate(userID string, playbook Playbook) error {
	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPublicPlaybookMakePrivate) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to make playbook `%s` private", userID, playbook.ID)
}

func (p *PermissionsService) PlaybookMakePublic(userID string, playbook Playbook) error {
	if p.hasPermissionsToPlaybook(userID, playbook, model.PermissionPrivatePlaybookMakePublic) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to make playbook `%s` public", userID, playbook.ID)
}

func (p *PermissionsService) RunCreate(userID string, playbook Playbook, targetTeamID string) error {
	if !p.hasPermissionsToPlaybook(userID, playbook, model.PermissionRunCreate) {
		return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to run playbook `%s`", userID, playbook.ID)
	}

	if targetTeamID != "" && targetTeamID != playbook.TeamID {
		if !p.pluginAPI.User.HasPermissionToTeam(userID, targetTeamID, model.PermissionRunCreate) {
			return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to create a run in team `%s`", userID, targetTeamID)
		}
	}

	return nil
}

func (p *PermissionsService) RunManageProperties(userID, runID string) error {
	run, err := p.runService.GetPlaybookRun(runID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get run to determine permissions, run id `%s`", runID)
	}

	return p.runManagePropertiesWithPlaybookRun(userID, run)
}

func (p *PermissionsService) runManagePropertiesWithPlaybookRun(userID string, run *PlaybookRun) error {
	if !p.canViewTeam(userID, run.TeamID) {
		return errors.Wrapf(ErrNoPermissions, "no run access; no team view permission for team `%s`", run.TeamID)
	}

	// For channelChecklists, use channel-based permissions
	if p.isChannelChecklist(run) {
		// Cannot modify checklists in archived channels
		if p.isChannelArchived(run.ChannelID) {
			return errors.Wrap(ErrNoPermissions, "cannot modify checklist in archived channel")
		}

		// Allow modification if user can post in channel
		if p.pluginAPI.User.HasPermissionToChannel(userID, run.ChannelID, model.PermissionCreatePost) {
			return nil
		}

		return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to modify channelChecklist `%s`", userID, run.ID)
	}

	// For playbook-based runs, use existing logic
	if run.OwnerUserID == userID {
		return nil
	}

	if slices.Contains(run.ParticipantIDs, userID) {
		return nil
	}

	if IsSystemAdmin(userID, p.pluginAPI) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to manage run `%s`", userID, run.ID)
}

func (p *PermissionsService) RunView(userID, runID string) error {
	run, err := p.runService.GetPlaybookRun(runID)
	if err != nil {
		return errors.Wrapf(err, "Unable to get run to determine permissions, run id `%s`", runID)
	}

	if !p.canViewTeam(userID, run.TeamID) {
		return errors.Wrapf(ErrNoPermissions, "no run access; no team view permission for team `%s`", run.TeamID)
	}

	// For channelChecklists, use channel-based permissions
	if p.isChannelChecklist(run) {

		// Check if user has permission to read the channel
		if p.pluginAPI.User.HasPermissionToChannel(userID, run.ChannelID, model.PermissionReadChannel) {
			return nil
		}

		return errors.Wrapf(ErrNoPermissions, "user `%s` does not have channel access to view channelChecklist `%s`", userID, runID)
	}

	// For playbook-based runs, use existing logic
	// Has permission if is the owner of the run
	if run.OwnerUserID == userID {
		return nil
	}

	// Or if is a participant of the run
	if slices.Contains(run.ParticipantIDs, userID) {
		return nil
	}

	// Or has view access to the playbook that created it
	return p.PlaybookView(userID, run.PlaybookID)
}

func (p *PermissionsService) ChannelActionCreate(userID, channelID string) error {
	if IsSystemAdmin(userID, p.pluginAPI) || CanManageChannelProperties(userID, channelID, p.pluginAPI) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to create actions for channel `%s`", userID, channelID)
}

func (p *PermissionsService) ChannelActionView(userID, channelID string) error {
	if p.pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionReadChannel) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to view actions for channel `%s`", userID, channelID)
}

func (p *PermissionsService) ChannelActionUpdate(userID, channelID string) error {
	if IsSystemAdmin(userID, p.pluginAPI) || CanManageChannelProperties(userID, channelID, p.pluginAPI) {
		return nil
	}

	return errors.Wrapf(ErrNoPermissions, "user `%s` does not have permission to update actions for channel `%s`", userID, channelID)
}

// IsSystemAdmin returns true if the userID is a system admin
func IsSystemAdmin(userID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionTo(userID, model.PermissionManageSystem)
}

// CanManageChannelProperties returns true if the userID is allowed to manage the properties of channelID
func CanManageChannelProperties(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	channel, err := pluginAPI.Channel.Get(channelID)
	if err != nil {
		return false
	}

	permission := model.PermissionManagePublicChannelProperties
	if channel.Type == model.ChannelTypePrivate {
		permission = model.PermissionManagePrivateChannelProperties
	}

	return pluginAPI.User.HasPermissionToChannel(userID, channelID, permission)
}

func CanPostToChannel(userID, channelID string, pluginAPI *pluginapi.Client) bool {
	return pluginAPI.User.HasPermissionToChannel(userID, channelID, model.PermissionCreatePost)
}

func IsMemberOfTeam(userID, teamID string, pluginAPI *pluginapi.Client) bool {
	teamMember, err := pluginAPI.Team.GetMember(teamID, userID)
	if err != nil {
		return false
	}

	return teamMember.DeleteAt == 0
}

// RequesterInfo holds the userID and teamID that this request is regarding, and permissions
// for the user making the request
type RequesterInfo struct {
	UserID  string
	TeamID  string
	IsAdmin bool
	IsGuest bool
}

// IsGuest returns true if the userID is a system guest
func IsGuest(userID string, pluginAPI *pluginapi.Client) (bool, error) {
	user, err := pluginAPI.User.Get(userID)
	if err != nil {
		return false, errors.Wrapf(err, "Unable to get user to determine permissions, user id `%s`", userID)
	}

	return user.IsGuest(), nil
}

func GetRequesterInfo(userID string, pluginAPI *pluginapi.Client) (RequesterInfo, error) {
	isAdmin := IsSystemAdmin(userID, pluginAPI)

	isGuest, err := IsGuest(userID, pluginAPI)
	if err != nil {
		return RequesterInfo{}, err
	}

	return RequesterInfo{
		UserID:  userID,
		IsAdmin: isAdmin,
		IsGuest: isGuest,
	}, nil
}

// isChannelChecklist returns true if the run is a channelChecklist (not created from a playbook)
func (p *PermissionsService) isChannelChecklist(run *PlaybookRun) bool {
	return run.Type == RunTypeChannelChecklist
}

// isChannelArchived returns true if the channel has been archived/deleted
func (p *PermissionsService) isChannelArchived(channelID string) bool {
	channel, err := p.pluginAPI.Channel.Get(channelID)
	if err != nil {
		logrus.WithError(err).WithField("channel_id", channelID).Error("failed to get channel")
		return false
	}
	return channel.DeleteAt > 0
}
