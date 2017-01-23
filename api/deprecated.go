// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

// ONLY FOR APIs SCHEDULED TO BE DEPRECATED

func InitDeprecated() {
	l4g.Debug(utils.T("api.channel.init.debug"))

	/* start - SCHEDULED FOR DEPRECATION IN 3.7 */
	BaseRoutes.Channels.Handle("/more", ApiUserRequired(getMoreChannels)).Methods("GET")
	/* end - SCHEDULED FOR DEPRECATION IN 3.7 */

	/* start - SCHEDULED FOR DEPRECATION IN 3.8 */
	BaseRoutes.NeedChannel.Handle("/update_last_viewed_at", ApiUserRequired(updateLastViewedAt)).Methods("POST")
	BaseRoutes.NeedChannel.Handle("/set_last_viewed_at", ApiUserRequired(setLastViewedAt)).Methods("POST")
	BaseRoutes.Users.Handle("/status/set_active_channel", ApiUserRequired(setActiveChannel)).Methods("POST")
	/* end - SCHEDULED FOR DEPRECATION IN 3.8 */
}

func getMoreChannels(c *Context, w http.ResponseWriter, r *http.Request) {

	// user is already in the team
	if !app.SessionHasPermissionToTeam(c.Session, c.TeamId, model.PERMISSION_LIST_TEAM_CHANNELS) {
		c.SetPermissionError(model.PERMISSION_LIST_TEAM_CHANNELS)
		return
	}

	if result := <-app.Srv.Store.Channel().GetMoreChannels(c.TeamId, c.Session.UserId, 0, 100000); result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.ChannelList).Etag(), "Get More Channels (deprecated)", w, r) {
		return
	} else {
		data := result.Data.(*model.ChannelList)
		w.Header().Set(model.HEADER_ETAG_SERVER, data.Etag())
		w.Write([]byte(data.ToJson()))
	}
}

func updateLastViewedAt(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	data := model.StringInterfaceFromJson(r.Body)

	var active bool
	var ok bool
	if active, ok = data["active"].(bool); !ok {
		active = true
	}

	doClearPush := false
	if *utils.Cfg.EmailSettings.SendPushNotifications && !c.Session.IsMobileApp() && active {
		if result := <-app.Srv.Store.User().GetUnreadCountForChannel(c.Session.UserId, id); result.Err != nil {
			l4g.Error(utils.T("api.channel.update_last_viewed_at.get_unread_count_for_channel.error"), c.Session.UserId, id, result.Err.Error())
		} else {
			if result.Data.(int64) > 0 {
				doClearPush = true
			}
		}
	}

	go func() {
		if err := app.SetActiveChannel(c.Session.UserId, id); err != nil {
			l4g.Error(err.Error())
		}
	}()

	app.Srv.Store.Channel().UpdateLastViewedAt([]string{id}, c.Session.UserId)

	// Must be after update so that unread count is correct
	if doClearPush {
		go app.ClearPushNotification(c.Session.UserId, id)
	}

	chanPref := model.Preference{
		UserId:   c.Session.UserId,
		Category: c.TeamId,
		Name:     model.PREFERENCE_NAME_LAST_CHANNEL,
		Value:    id,
	}

	teamPref := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_LAST,
		Name:     model.PREFERENCE_NAME_LAST_TEAM,
		Value:    c.TeamId,
	}

	app.Srv.Store.Preference().Save(&model.Preferences{teamPref, chanPref})

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, c.TeamId, "", c.Session.UserId, nil)
	message.Add("channel_id", id)

	go app.Publish(message)

	result := make(map[string]string)
	result["id"] = id
	w.Write([]byte(model.MapToJson(result)))
}

func setLastViewedAt(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["channel_id"]

	data := model.StringInterfaceFromJson(r.Body)
	newLastViewedAt := int64(data["last_viewed_at"].(float64))

	app.Srv.Store.Channel().SetLastViewedAt(id, c.Session.UserId, newLastViewedAt)

	chanPref := model.Preference{
		UserId:   c.Session.UserId,
		Category: c.TeamId,
		Name:     model.PREFERENCE_NAME_LAST_CHANNEL,
		Value:    id,
	}

	teamPref := model.Preference{
		UserId:   c.Session.UserId,
		Category: model.PREFERENCE_CATEGORY_LAST,
		Name:     model.PREFERENCE_NAME_LAST_TEAM,
		Value:    c.TeamId,
	}

	app.Srv.Store.Preference().Save(&model.Preferences{teamPref, chanPref})

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, c.TeamId, "", c.Session.UserId, nil)
	message.Add("channel_id", id)

	go app.Publish(message)

	result := make(map[string]string)
	result["id"] = id
	w.Write([]byte(model.MapToJson(result)))
}

func setActiveChannel(c *Context, w http.ResponseWriter, r *http.Request) {
	data := model.MapFromJson(r.Body)

	var channelId string
	var ok bool
	if channelId, ok = data["channel_id"]; !ok || len(channelId) > 26 {
		c.SetInvalidParam("setActiveChannel", "channel_id")
		return
	}

	if err := app.SetActiveChannel(c.Session.UserId, channelId); err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
