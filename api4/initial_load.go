package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitInitialLoad() {
	api.BaseRoutes.InitialLoad.Handle("/load", api.APIHandlerTrustRequester(initialLoad)).Methods("GET")
}

type InitialLoadData struct {
	Config             map[string]string        `json:"config"`
	License            map[string]string        `json:"license"`
	User               *model.User              `json:"user"`
	UserSettings       *model.User              `json:"user_settings"`
	TeamMemberships    []*model.TeamMember      `json:"team_memberships"`
	Teams              []*model.Team            `json:"teams"`
	ChannelMemberships []model.ChannelMember    `json:"channel_memberships"`
	Channels           []*model.Channel         `json:"channles"`
	SidebarCategories  []*model.SidebarCategory `json:"sidebar_categories"`
	Roles              []*model.Role            `json:"roles"`
}

func initialLoad(c *Context, w http.ResponseWriter, r *http.Request) {
	data := InitialLoadData{}

	userID := c.AppContext.Session().UserId

	// Not logged in initial Load
	if userID == "" {
		data.Config = c.App.LimitedClientConfigWithComputed()
		dataBytes, jsonErr := json.Marshal(data)
		if jsonErr != nil {
			c.Err = model.NewAppError("initialLoad", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
			return
		}

		w.Write(dataBytes)
		return
	}

	data.Config = c.App.ClientConfigWithComputed()

	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionReadLicenseInformation) {
		data.License = c.App.Srv().ClientLicense()
	} else {
		data.License = c.App.Srv().GetSanitizedClientLicense()
	}

	user, err := c.App.GetUser(userID)
	if err != nil {
		c.Err = err
		return
	}
	data.User = user

	teamMembers, err := c.App.GetTeamMembersForUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}

	data.TeamMemberships = teamMembers
	teams, err := c.App.GetTeamsForUser(c.Params.UserId)
	if err != nil {
		c.Err = err
		return
	}
	data.Teams = teams

	// TODO: Make it database efficiient
	for _, team := range teams {
		channelMembers, err := c.App.GetChannelMembersForUser(team.Id, userID)
		if err != nil {
			c.Err = err
			return
		}
		data.ChannelMemberships = append(data.ChannelMemberships, channelMembers...)
	}

	// TODO: Make it database efficiient
	for _, channelMember := range data.ChannelMemberships {
		channel, err := c.App.GetChannel(channelMember.ChannelId)
		if err != nil {
			c.Err = err
			return
		}
		data.Channels = append(data.Channels, channel)
	}

	// TODO: Add roles
	// roles, err := c.App.GetRolesByNames(roleNames)
	// if err != nil {
	// 	c.Err = err
	// 	return
	// }

	dataBytes, jsonErr := json.Marshal(data)
	if jsonErr != nil {
		c.Err = model.NewAppError("initialLoad", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(dataBytes)
}
