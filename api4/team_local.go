// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app/email"
	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

func (api *API) InitTeamLocal() {
	api.BaseRoutes.Teams.Handle("", api.APILocal(localCreateTeam)).Methods("POST")
	api.BaseRoutes.Teams.Handle("", api.APILocal(getAllTeams)).Methods("GET")
	api.BaseRoutes.Teams.Handle("/search", api.APILocal(searchTeams)).Methods("POST")

	api.BaseRoutes.Team.Handle("", api.APILocal(getTeam)).Methods("GET")
	api.BaseRoutes.Team.Handle("", api.APILocal(updateTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("", api.APILocal(localDeleteTeam)).Methods("DELETE")
	api.BaseRoutes.Team.Handle("/invite/email", api.APILocal(localInviteUsersToTeam)).Methods("POST")
	api.BaseRoutes.Team.Handle("/patch", api.APILocal(patchTeam)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/privacy", api.APILocal(updateTeamPrivacy)).Methods("PUT")
	api.BaseRoutes.Team.Handle("/restore", api.APILocal(restoreTeam)).Methods("POST")

	api.BaseRoutes.TeamByName.Handle("", api.APILocal(getTeamByName)).Methods("GET")
	api.BaseRoutes.TeamMembers.Handle("", api.APILocal(addTeamMember)).Methods("POST")
	api.BaseRoutes.TeamMember.Handle("", api.APILocal(removeTeamMember)).Methods("DELETE")
}

func localDeleteTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	auditRec := c.MakeAuditRecord("localDeleteTeam", audit.Fail)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)
	defer c.LogAuditRec(auditRec)

	if team, err := c.App.GetTeam(c.Params.TeamId); err == nil {
		auditRec.AddEventPriorState(team)
		auditRec.AddEventObjectType("team")
	}

	var err *model.AppError
	if c.Params.Permanent {
		err = c.App.PermanentDeleteTeamId(c.AppContext, c.Params.TeamId)
	} else {
		err = c.App.SoftDeleteTeam(c.Params.TeamId)
	}

	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func localInviteUsersToTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}

	if !*c.App.Config().ServiceSettings.EnableEmailInvitations {
		c.Err = model.NewAppError("localInviteUsersToTeam", "api.team.invite_members.disabled.app_error", nil, "", http.StatusNotImplemented)
		return
	}

	bf, err := io.ReadAll(r.Body)
	if err != nil {
		c.Err = model.NewAppError("Api4.inviteUsersToTeams", "api.team.invite_members_to_team_and_channels.invalid_body.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	memberInvite := &model.MemberInvite{}
	err = json.Unmarshal(bf, memberInvite)
	if err != nil {
		c.Err = model.NewAppError("Api4.inviteUsersToTeams", "api.team.invite_members_to_team_and_channels.invalid_body_parsing.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}

	emailList := memberInvite.Emails

	if len(emailList) == 0 {
		c.SetInvalidParam("user_email")
		return
	}
	for i := range emailList {
		email := strings.ToLower(emailList[i])
		if !model.IsValidEmail(email) {
			c.Err = model.NewAppError("localInviteUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]any{"Address": email}, "", http.StatusBadRequest)
			return
		}
		emailList[i] = email
	}

	auditRec := c.MakeAuditRecord("localInviteUsersToTeam", audit.Fail)
	auditRec.AddEventParameter("member_invite", memberInvite)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team_id", c.Params.TeamId)
	auditRec.AddMeta("count", len(emailList))
	auditRec.AddMeta("emails", emailList)

	if len(memberInvite.ChannelIds) > 0 {
		auditRec.AddMeta("channel_count", len(memberInvite.ChannelIds))
		auditRec.AddMeta("channels", memberInvite.ChannelIds)
	}

	team, err := c.App.Srv().Store().Team().Get(c.Params.TeamId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			c.Err = model.NewAppError("localInviteUsersToTeam", "app.team.get.find.app_error", nil, "", http.StatusNotFound).Wrap(err)
		default:
			c.Err = model.NewAppError("localInviteUsersToTeam", "app.team.get.finding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		return
	}

	allowedDomains := []string{team.AllowedDomains, *c.App.Config().TeamSettings.RestrictCreationToDomains}

	var channels []*model.Channel
	if len(memberInvite.ChannelIds) > 0 {
		channels, err = c.App.Srv().Store().Channel().GetChannelsByIds(memberInvite.ChannelIds, false)
		if err != nil {
			c.Err = model.NewAppError("prepareLocalInviteNewUsersToTeam", "app.channel.get_channels_by_ids.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	if r.URL.Query().Get("graceful") != "" {
		var invitesWithErrors []*model.EmailInviteWithError
		var goodEmails, errList []string
		for _, email := range emailList {
			invite := &model.EmailInviteWithError{
				Email: email,
				Error: nil,
			}
			if !isEmailAddressAllowed(email, allowedDomains) {
				invite.Error = model.NewAppError("localInviteUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": email}, "", http.StatusBadRequest)
				errList = append(errList, model.EmailInviteWithErrorToString(invite))
			} else {
				goodEmails = append(goodEmails, email)
			}
			invitesWithErrors = append(invitesWithErrors, invite)
		}
		auditRec.AddMeta("errors", errList)
		if len(goodEmails) > 0 {
			var invitesWithErrors2 []*model.EmailInviteWithError
			if len(channels) > 0 {
				invitesWithErrors2, err = c.App.Srv().EmailService.SendInviteEmailsToTeamAndChannels(team, channels, "Administrator", "mmctl "+model.NewId(), nil, goodEmails, *c.App.Config().ServiceSettings.SiteURL, nil, memberInvite.Message, true, true, false)
				invitesWithErrors = append(invitesWithErrors, invitesWithErrors2...)
			} else {
				err = c.App.Srv().EmailService.SendInviteEmails(team, "Administrator", "mmctl "+model.NewId(), goodEmails, *c.App.Config().ServiceSettings.SiteURL, nil, false, true, false)
			}

			if err != nil {
				switch {
				case errors.Is(err, email.NoRateLimiterError):
					c.Err = model.NewAppError("SendInviteEmails", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("team_id=%s", team.Id), http.StatusInternalServerError).Wrap(err)
				case errors.Is(err, email.SetupRateLimiterError):
					c.Err = model.NewAppError("SendInviteEmails", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("team_id=%s, error=%v", team.Id, err), http.StatusInternalServerError).Wrap(err)
				default:
					c.Err = model.NewAppError("SendInviteEmails", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("team_id=%s, error=%v", team.Id, err), http.StatusRequestEntityTooLarge).Wrap(err)
				}
				return
			}
		}

		// in graceful mode we return both the successful ones and the failed ones
		js, err := json.Marshal(invitesWithErrors)
		if err != nil {
			c.Err = model.NewAppError("localInviteUsersToTeam", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return
		}

		w.Write(js)
	} else {
		var invalidEmailList []string

		for _, email := range emailList {
			if !isEmailAddressAllowed(email, allowedDomains) {
				invalidEmailList = append(invalidEmailList, email)
			}
		}
		if len(invalidEmailList) > 0 {
			s := strings.Join(invalidEmailList, ", ")
			c.Err = model.NewAppError("localInviteUsersToTeam", "api.team.invite_members.invalid_email.app_error", map[string]any{"Addresses": s}, "", http.StatusBadRequest)
			return
		}
		err := c.App.Srv().EmailService.SendInviteEmails(team, "Administrator", "mmctl "+model.NewId(), emailList, *c.App.Config().ServiceSettings.SiteURL, nil, false, true, false)
		if err != nil {
			switch {
			case errors.Is(err, email.NoRateLimiterError):
				c.Err = model.NewAppError("SendInviteEmails", "app.email.no_rate_limiter.app_error", nil, fmt.Sprintf("team_id=%s", team.Id), http.StatusInternalServerError).Wrap(err)
			case errors.Is(err, email.SetupRateLimiterError):
				c.Err = model.NewAppError("SendInviteEmails", "app.email.setup_rate_limiter.app_error", nil, fmt.Sprintf("team_id=%s, error=%v", team.Id, err), http.StatusInternalServerError).Wrap(err)
			default:
				c.Err = model.NewAppError("SendInviteEmails", "app.email.rate_limit_exceeded.app_error", nil, fmt.Sprintf("team_id=%s, error=%v", team.Id, err), http.StatusRequestEntityTooLarge).Wrap(err)
			}
			return
		}
		ReturnStatusOK(w)
	}
	auditRec.Success()
}

func isEmailAddressAllowed(email string, allowedDomains []string) bool {
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

func normalizeDomains(domains string) []string {
	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	return strings.Fields(strings.TrimSpace(strings.ToLower(strings.Replace(strings.Replace(domains, "@", " ", -1), ",", " ", -1))))
}

func localCreateTeam(c *Context, w http.ResponseWriter, r *http.Request) {
	var team model.Team
	if jsonErr := json.NewDecoder(r.Body).Decode(&team); jsonErr != nil {
		c.SetInvalidParamWithErr("team", jsonErr)
		return
	}

	team.Email = strings.ToLower(team.Email)

	auditRec := c.MakeAuditRecord("localCreateTeam", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddEventParameter("team", team)

	rteam, err := c.App.CreateTeam(c.AppContext, &team)
	if err != nil {
		c.Err = err
		return
	}
	// Don't sanitize the team here since the user will be a team admin and their session won't reflect that yet

	auditRec.AddEventResultState(rteam)
	auditRec.AddEventObjectType("type")
	auditRec.Success()
	auditRec.AddMeta("team", team) // overwrite meta

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(rteam); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
