package ws

import (
	"github.com/mattermost/mattermost-server/v6/boards/model"
)

// UpdateCategoryMessage is sent on block updates.
type UpdateCategoryMessage struct {
	Action          string                              `json:"action"`
	TeamID          string                              `json:"teamId"`
	Category        *model.Category                     `json:"category,omitempty"`
	BoardCategories []*model.BoardCategoryWebsocketData `json:"blockCategories,omitempty"`
}

// UpdateBlockMsg is sent on block updates.
type UpdateBlockMsg struct {
	Action string       `json:"action"`
	TeamID string       `json:"teamId"`
	Block  *model.Block `json:"block"`
}

// UpdateBoardMsg is sent on block updates.
type UpdateBoardMsg struct {
	Action string       `json:"action"`
	TeamID string       `json:"teamId"`
	Board  *model.Board `json:"board"`
}

// UpdateMemberMsg is sent on membership updates.
type UpdateMemberMsg struct {
	Action string             `json:"action"`
	TeamID string             `json:"teamId"`
	Member *model.BoardMember `json:"member"`
}

// UpdateSubscription is sent on subscription updates.
type UpdateSubscription struct {
	Action       string              `json:"action"`
	Subscription *model.Subscription `json:"subscription"`
}

// UpdateClientConfig is sent on block updates.
type UpdateClientConfig struct {
	Action       string             `json:"action"`
	ClientConfig model.ClientConfig `json:"clientconfig"`
}

// UpdateClientConfig is sent on block updates.
type UpdateCardLimitTimestamp struct {
	Action    string `json:"action"`
	Timestamp int64  `json:"timestamp"`
}

// WebsocketCommand is an incoming command from the client.
type WebsocketCommand struct {
	Action    string   `json:"action"`
	TeamID    string   `json:"teamId"`
	Token     string   `json:"token"`
	ReadToken string   `json:"readToken"`
	BlockIDs  []string `json:"blockIds"`
}

type CategoryReorderMessage struct {
	Action        string   `json:"action"`
	CategoryOrder []string `json:"categoryOrder"`
	TeamID        string   `json:"teamId"`
}

type CategoryBoardReorderMessage struct {
	Action     string   `json:"action"`
	CategoryID string   `json:"CategoryId"`
	BoardOrder []string `json:"BoardOrder"`
	TeamID     string   `json:"teamId"`
}
