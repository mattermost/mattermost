package app

import (
	"github.com/mattermost/mattermost-server/v5/model"
	"time"
)

func (a *App) AddFriend(friend *model.Friend) (*model.Friend, *model.AppError) {
	friend.IsPending = true
	friend.RequestedTime = time.Now().UnixNano() / int64(time.Millisecond)
	rfriend, err := a.saveFriend(friend)

	return rfriend, err
}

func (a *App) AcceptFriend(friend *model.Friend) (*model.Friend, *model.AppError) {
	friend.IsPending = false
	friend2 := model.Friend{ UserId1: friend.UserId2, UserId2: friend.UserId1}
	a.saveFriend(&friend2)
	return a.updateFriend(friend)
}

func (a *App) saveFriend(friend *model.Friend) (*model.Friend, *model.AppError)  {
	rfriend, err := a.Srv().Store.Friend().Save(friend)
	return rfriend, err

}

func (a *App) updateFriend(friend *model.Friend) (*model.Friend, *model.AppError)  {
	rfriend, err := a.Srv().Store.Friend().Update(friend)
	return rfriend, err

}
