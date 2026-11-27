// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"errors"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	inviteReminderCheckInterval = 5 * time.Minute
	// maxInviteRemindersPerRun bounds how long one sweep holds the cluster mutex. Twelve sweeps
	// fall within the hour before an invite expires, so up to 2,400 reminders an hour go out.
	maxInviteRemindersPerRun = 200
)

type dueInviteReminder struct {
	token     *model.Token
	tokenData map[string]string
	remindAt  int64
}

// SendDueInviteReminders sends one reminder for each team invitation token whose reminder is due,
// earliest first, up to maxInviteRemindersPerRun. It stops between sends once rctx is canceled.
func (a *App) SendDueInviteReminders(rctx request.CTX) {
	a.sendDueInviteReminders(rctx, maxInviteRemindersPerRun)
}

func (a *App) sendDueInviteReminders(rctx request.CTX, limit int) {
	if !*a.Config().ServiceSettings.EnableEmailInvitations {
		return
	}

	tokens, err := a.Srv().Store().Token().GetAllTokensByType(model.TokenTypeTeamInvitation)
	if err != nil {
		rctx.Logger().Error("Failed to get team invitation tokens for reminders", mlog.Err(err))
		return
	}

	now := model.GetMillis()
	var due []dueInviteReminder
	for _, token := range tokens {
		// An expired invite is left for the token cleanup rather than re-issued with a fresh link.
		if token.IsExpired() {
			continue
		}

		tokenData := model.MapFromJSON(strings.NewReader(token.Extra))
		remindAt, parseErr := strconv.ParseInt(tokenData[email.InviteTokenRemindAtKey], 10, 64)
		if parseErr != nil || remindAt > now {
			continue
		}
		due = append(due, dueInviteReminder{token: token, tokenData: tokenData, remindAt: remindAt})
	}

	slices.SortFunc(due, func(a, b dueInviteReminder) int {
		return cmp.Compare(a.remindAt, b.remindAt)
	})
	if len(due) > limit {
		rctx.Logger().Info("More invite reminders are due than one run sends; the rest wait for the next run", mlog.Int("due", len(due)), mlog.Int("per_run", limit))
		due = due[:limit]
	}

	for _, reminder := range due {
		if rctx.Context().Err() != nil {
			return
		}

		// Consuming the token claims its reminder, so each invite is reminded at most once.
		// The reminder email carries a fresh token in its place.
		if _, err := a.Srv().Store().Token().ConsumeOnce(model.TokenTypeTeamInvitation, reminder.token.Token); err != nil {
			if _, notFound := errors.AsType[*store.ErrNotFound](err); !notFound {
				rctx.Logger().Warn("Failed to claim team invitation token for reminder", mlog.Err(err))
			}
			continue
		}

		a.sendInviteReminder(rctx, reminder.tokenData)
	}
}

func (a *App) sendInviteReminder(rctx request.CTX, tokenData map[string]string) {
	teamID := tokenData["teamId"]
	senderID := tokenData["senderId"]
	invitedEmail := tokenData["email"]
	logger := rctx.Logger().With(mlog.String("team_id", teamID), mlog.String("sender_id", senderID))

	if a.isActiveTeamMemberByEmail(rctx, teamID, invitedEmail) {
		return
	}

	memberInvite := &model.MemberInvite{
		Emails:     []string{invitedEmail},
		ChannelIds: strings.Fields(tokenData["channels"]),
	}
	if tokenData["username"] != "" || tokenData["first_name"] != "" || tokenData["last_name"] != "" {
		memberInvite.Profiles = []*model.MemberInviteProfile{{
			Email:     invitedEmail,
			Username:  tokenData["username"],
			FirstName: tokenData["first_name"],
			LastName:  tokenData["last_name"],
		}}
	}

	invitesWithErrors, appErr := a.InviteNewUsersToTeamGracefully(rctx, memberInvite, teamID, senderID, true)
	if appErr != nil {
		logger.Warn("Failed to send invite reminder", mlog.Err(appErr))
		return
	}
	for _, invite := range invitesWithErrors {
		if invite != nil && invite.Error != nil {
			logger.Warn("Failed to send invite reminder", mlog.Err(invite.Error))
		}
	}
}

func (a *App) isActiveTeamMemberByEmail(rctx request.CTX, teamID, userEmail string) bool {
	user, appErr := a.GetUserByEmail(userEmail)
	if appErr != nil {
		return false
	}

	member, appErr := a.GetTeamMember(rctx, teamID, user.Id)
	return appErr == nil && member.DeleteAt == 0
}
