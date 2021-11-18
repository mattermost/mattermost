package api4

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitInitialLoad() {
	api.BaseRoutes.InitialLoad.Handle("/", api.APIHandlerTrustRequester(initialLoad)).Methods("GET")
}

func initialLoad(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.InitialLoad{}

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
	user.Sanitize(map[string]bool{})
	data.User = user

	teamMembers, err := c.App.GetTeamMembersForUser(userID)
	if err != nil {
		c.Err = err
		return
	}

	data.TeamMemberships = teamMembers
	teams, err := c.App.GetTeamsForUser(userID)
	if err != nil {
		c.Err = err
		return
	}
	fmt.Println(teams)
	data.Teams = teams

	data.SidebarCategories = map[string]*model.OrderedSidebarCategories{}

	roleNames := user.Roles

	// TODO: Make it database efficiient
	for _, teamMember := range teamMembers {
		channelMembers, err := c.App.GetChannelMembersForUser(teamMember.TeamId, userID)
		if err != nil {
			c.Err = err
			return
		}
		data.ChannelMemberships = append(data.ChannelMemberships, channelMembers...)

		sidebarCategories, err := c.App.GetSidebarCategories(userID, teamMember.TeamId)
		if err != nil {
			c.Err = err
			return
		}
		data.SidebarCategories[teamMember.TeamId] = sidebarCategories
		roleNames = roleNames + " " + teamMember.Roles
	}

	preferences, err := c.App.GetPreferencesForUser(userID)
	if err != nil {
		c.Err = err
		return
	}
	data.UserPreferences = &preferences

	displaySetting, _ := c.App.GetPreferenceByCategoryAndNameForUser(userID, "display_settings", "name_format")
	displaySettingValue := data.Config["TeammateNameDisplay"]
	if displaySetting != nil {
		displaySettingValue = displaySetting.Value
	}

	// TODO: Make it database efficiient
	for _, channelMember := range data.ChannelMemberships {
		channel, err := c.App.GetChannel(channelMember.ChannelId)
		if err != nil {
			c.Err = err
			return
		}
		if channel.Type == model.ChannelTypeDirect {
			dmMembers, err := c.App.GetChannelMembersPage(channelMember.ChannelId, 0, 2)
			if err != nil {
				c.Err = err
				return
			}
			if len(dmMembers) != 2 && !(len(dmMembers) == 1 && dmMembers[0].UserId == userID) {
				c.Err = model.NewAppError("initialLoad", "api.too_few_dm_members", nil, "", http.StatusInternalServerError)
				return
			}

			dmMember := dmMembers[0]
			if len(dmMembers) > 1 && dmMembers[0].UserId == userID {
				dmMember = dmMembers[1]
			}
			teammate, err := c.App.GetUser(dmMember.UserId)
			if err != nil {
				c.Err = err
				return
			}
			if displaySettingValue == "nickname_full_name" {
				channel.DisplayName = teammate.Nickname
				if channel.DisplayName == "" {
					channel.DisplayName = teammate.GetFullName()
				}
				if channel.DisplayName == "" {
					channel.DisplayName = teammate.Username
				}
			} else if displaySettingValue == "full_name" {
				channel.DisplayName = teammate.GetFullName()
				if channel.DisplayName == "" {
					channel.DisplayName = teammate.Username
				}
			} else if displaySettingValue == "username" {
				channel.DisplayName = teammate.Username
			} else {
				channel.DisplayName = teammate.Username
			}
		}
		if channel.Type == model.ChannelTypeGroup {
			gmMembers, err := c.App.GetChannelMembersPage(channelMember.ChannelId, 0, 8)
			if err != nil {
				c.Err = err
				return
			}

			displayNames := []string{}
			for _, gmMember := range gmMembers {
				if gmMember.UserId == userID {
					continue
				}
				// TODO: This is duplicated code
				teammate, err := c.App.GetUser(gmMember.UserId)
				if err != nil {
					c.Err = err
					return
				}
				displayName := ""
				if displaySettingValue == "nickname_full_name" {
					displayName = teammate.Nickname
					if displayName == "" {
						displayName = teammate.GetFullName()
					}
					if displayName == "" {
						displayName = teammate.Username
					}
				} else if displaySettingValue == "full_name" {
					displayName = teammate.GetFullName()
					if displayName == "" {
						displayName = teammate.Username
					}
				} else if displaySettingValue == "username" {
					displayName = teammate.Username
				} else {
					displayName = teammate.Username
				}
				displayNames = append(displayNames, displayName)
			}
			sort.Strings(displayNames)
			channel.DisplayName = strings.Join(displayNames, ", ")
		}
		data.Channels = append(data.Channels, channel)
		roleNames = roleNames + " " + channelMember.Roles
	}

	roles, err := c.App.GetRolesByNames(strings.Split(roleNames, " "))
	if err != nil {
		c.Err = err
		return
	}
	data.Roles = roles

	dataBytes, jsonErr := json.Marshal(data)
	if jsonErr != nil {
		c.Err = model.NewAppError("initialLoad", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(dataBytes)
}
