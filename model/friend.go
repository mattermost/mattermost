package model

import (
	"encoding/json"
	"io"
)

type Friend struct {
	UserId1 string `json:"userid1"`
	UserId2 string `json:"userid2"`
	IsPending bool `json:"is_pending"`
	IsBlocked bool `json:"is_blocked"`
	RequestedTime int64 `json:"requested_time"`
}


// FriendFromJson will decode the input and return a Friend
func FriendFromJson(data io.Reader) *Friend {
	var friend *Friend
	json.NewDecoder(data).Decode(&friend)
	return friend
}
