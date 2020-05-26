package api4

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"net/http"
)

func (api *API) InitFriend() {
	api.BaseRoutes.Users.Handle("/friend", api.ApiSessionRequired(addFriend)).Methods("POST")
	api.BaseRoutes.Users.Handle("/friend", api.ApiSessionRequired(acceptFriend)).Methods("PUT")
}

func addFriend(c *Context, w http.ResponseWriter, r *http.Request) {
	friend := model.FriendFromJson(r.Body)
	c.App.AddFriend(friend)
}

func acceptFriend(c *Context, w http.ResponseWriter, r *http.Request) {
	friend := model.FriendFromJson(r.Body)
	c.App.AcceptFriend(friend)
}
