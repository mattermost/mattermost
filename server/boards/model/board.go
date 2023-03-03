// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"time"
)

type BoardType string
type BoardRole string
type BoardSearchField string

const (
	BoardTypeOpen    BoardType = "O"
	BoardTypePrivate BoardType = "P"
)

const (
	BoardRoleNone      BoardRole = ""
	BoardRoleViewer    BoardRole = "viewer"
	BoardRoleCommenter BoardRole = "commenter"
	BoardRoleEditor    BoardRole = "editor"
	BoardRoleAdmin     BoardRole = "admin"
)

const (
	BoardSearchFieldNone         BoardSearchField = ""
	BoardSearchFieldTitle        BoardSearchField = "title"
	BoardSearchFieldPropertyName BoardSearchField = "property_name"
)

// Board groups a set of blocks and its layout
// swagger:model
type Board struct {
	// The ID for the board
	// required: true
	ID string `json:"id"`

	// The ID of the team that the board belongs to
	// required: true
	TeamID string `json:"teamId"`

	// The ID of the channel that the board was created from
	// required: false
	ChannelID string `json:"channelId"`

	// The ID of the user that created the board
	// required: true
	CreatedBy string `json:"createdBy"`

	// The ID of the last user that updated the board
	// required: true
	ModifiedBy string `json:"modifiedBy"`

	// The type of the board
	// required: true
	Type BoardType `json:"type"`

	// The minimum role applied when somebody joins the board
	// required: true
	MinimumRole BoardRole `json:"minimumRole"`

	// The title of the board
	// required: false
	Title string `json:"title"`

	// The description of the board
	// required: false
	Description string `json:"description"`

	// The icon of the board
	// required: false
	Icon string `json:"icon"`

	// Indicates if the board shows the description on the interface
	// required: false
	ShowDescription bool `json:"showDescription"`

	// Marks the template boards
	// required: false
	IsTemplate bool `json:"isTemplate"`

	// Marks the template boards
	// required: false
	TemplateVersion int `json:"templateVersion"`

	// The properties of the board
	// required: false
	Properties map[string]interface{} `json:"properties"`

	// The properties of the board cards
	// required: false
	CardProperties []map[string]interface{} `json:"cardProperties"`

	// The creation time in miliseconds since the current epoch
	// required: true
	CreateAt int64 `json:"createAt"`

	// The last modified time in miliseconds since the current epoch
	// required: true
	UpdateAt int64 `json:"updateAt"`

	// The deleted time in miliseconds since the current epoch. Set to indicate this block is deleted
	// required: false
	DeleteAt int64 `json:"deleteAt"`
}

// GetPropertyString returns the value of the specified property as a string,
// or error if the property does not exist or is not of type string.
func (b *Board) GetPropertyString(propName string) (string, error) {
	val, ok := b.Properties[propName]
	if !ok {
		return "", NewErrNotFound(propName)
	}

	s, ok := val.(string)
	if !ok {
		return "", ErrInvalidPropertyValueType
	}
	return s, nil
}

// BoardPatch is a patch for modify boards
// swagger:model
type BoardPatch struct {
	// The type of the board
	// required: false
	Type *BoardType `json:"type"`

	// The minimum role applied when somebody joins the board
	// required: false
	MinimumRole *BoardRole `json:"minimumRole"`

	// The title of the board
	// required: false
	Title *string `json:"title"`

	// The description of the board
	// required: false
	Description *string `json:"description"`

	// The icon of the board
	// required: false
	Icon *string `json:"icon"`

	// Indicates if the board shows the description on the interface
	// required: false
	ShowDescription *bool `json:"showDescription"`

	// Indicates if the board shows the description on the interface
	// required: false
	ChannelID *string `json:"channelId"`

	// The board updated properties
	// required: false
	UpdatedProperties map[string]interface{} `json:"updatedProperties"`

	// The board removed properties
	// required: false
	DeletedProperties []string `json:"deletedProperties"`

	// The board updated card properties
	// required: false
	UpdatedCardProperties []map[string]interface{} `json:"updatedCardProperties"`

	// The board removed card properties
	// required: false
	DeletedCardProperties []string `json:"deletedCardProperties"`
}

// BoardMember stores the information of the membership of a user on a board
// swagger:model
type BoardMember struct {
	// The ID of the board
	// required: true
	BoardID string `json:"boardId"`

	// The ID of the user
	// required: true
	UserID string `json:"userId"`

	// The independent roles of the user on the board
	// required: false
	Roles string `json:"roles"`

	// Minimum role because the board configuration
	// required: false
	MinimumRole string `json:"minimumRole"`

	// Marks the user as an admin of the board
	// required: true
	SchemeAdmin bool `json:"schemeAdmin"`

	// Marks the user as an editor of the board
	// required: true
	SchemeEditor bool `json:"schemeEditor"`

	// Marks the user as an commenter of the board
	// required: true
	SchemeCommenter bool `json:"schemeCommenter"`

	// Marks the user as an viewer of the board
	// required: true
	SchemeViewer bool `json:"schemeViewer"`

	// Marks the membership as generated by an access group
	// required: true
	Synthetic bool `json:"synthetic"`
}

// BoardMetadata contains metadata for a Board
// swagger:model
type BoardMetadata struct {
	// The ID for the board
	// required: true
	BoardID string `json:"boardId"`

	// The most recent time a descendant of this board was added, modified, or deleted
	// required: true
	DescendantLastUpdateAt int64 `json:"descendantLastUpdateAt"`

	// The earliest time a descendant of this board was added, modified, or deleted
	// required: true
	DescendantFirstUpdateAt int64 `json:"descendantFirstUpdateAt"`

	// The ID of the user that created the board
	// required: true
	CreatedBy string `json:"createdBy"`

	// The ID of the user that last modified the most recently modified descendant
	// required: true
	LastModifiedBy string `json:"lastModifiedBy"`
}

func BoardFromJSON(data io.Reader) *Board {
	var board *Board
	_ = json.NewDecoder(data).Decode(&board)
	return board
}

func BoardsFromJSON(data io.Reader) []*Board {
	var boards []*Board
	_ = json.NewDecoder(data).Decode(&boards)
	return boards
}

func BoardMemberFromJSON(data io.Reader) *BoardMember {
	var boardMember *BoardMember
	_ = json.NewDecoder(data).Decode(&boardMember)
	return boardMember
}

func BoardMembersFromJSON(data io.Reader) []*BoardMember {
	var boardMembers []*BoardMember
	_ = json.NewDecoder(data).Decode(&boardMembers)
	return boardMembers
}

func BoardMetadataFromJSON(data io.Reader) *BoardMetadata {
	var boardMetadata *BoardMetadata
	_ = json.NewDecoder(data).Decode(&boardMetadata)
	return boardMetadata
}

// Patch returns an updated version of the board.
func (p *BoardPatch) Patch(board *Board) *Board {
	if p.Type != nil {
		board.Type = *p.Type
	}

	if p.Title != nil {
		board.Title = *p.Title
	}

	if p.MinimumRole != nil {
		board.MinimumRole = *p.MinimumRole
	}

	if p.Description != nil {
		board.Description = *p.Description
	}

	if p.Icon != nil {
		board.Icon = *p.Icon
	}

	if p.ShowDescription != nil {
		board.ShowDescription = *p.ShowDescription
	}

	if p.ChannelID != nil {
		board.ChannelID = *p.ChannelID
	}

	for key, property := range p.UpdatedProperties {
		board.Properties[key] = property
	}

	for _, key := range p.DeletedProperties {
		delete(board.Properties, key)
	}

	if len(p.UpdatedCardProperties) != 0 || len(p.DeletedCardProperties) != 0 {
		// first we accumulate all properties indexed by, and maintain their order
		keyOrder := []string{}
		cardPropertyMap := map[string]map[string]interface{}{}
		for _, prop := range board.CardProperties {
			id, ok := prop["id"].(string)
			if !ok {
				// bad property, skipping
				continue
			}

			cardPropertyMap[id] = prop
			keyOrder = append(keyOrder, id)
		}

		// if there are properties marked for removal, we delete them
		for _, propertyID := range p.DeletedCardProperties {
			delete(cardPropertyMap, propertyID)
		}

		// if there are properties marked for update, we replace the
		// existing ones or add them
		for _, newprop := range p.UpdatedCardProperties {
			id, ok := newprop["id"].(string)
			if !ok {
				// bad new property, skipping
				continue
			}

			_, exists := cardPropertyMap[id]
			if !exists {
				keyOrder = append(keyOrder, id)
			}
			cardPropertyMap[id] = newprop
		}

		// and finally we flatten and save the updated properties
		newCardProperties := []map[string]interface{}{}
		for _, key := range keyOrder {
			p, exists := cardPropertyMap[key]
			if exists {
				newCardProperties = append(newCardProperties, p)
			}
		}

		board.CardProperties = newCardProperties
	}

	return board
}

func IsBoardTypeValid(t BoardType) bool {
	return t == BoardTypeOpen || t == BoardTypePrivate
}

func IsBoardMinimumRoleValid(r BoardRole) bool {
	return r == BoardRoleNone || r == BoardRoleAdmin || r == BoardRoleEditor || r == BoardRoleCommenter || r == BoardRoleViewer
}

func (p *BoardPatch) IsValid() error {
	if p.Type != nil && !IsBoardTypeValid(*p.Type) {
		return InvalidBoardErr{"invalid-board-type"}
	}

	if p.MinimumRole != nil && !IsBoardMinimumRoleValid(*p.MinimumRole) {
		return InvalidBoardErr{"invalid-board-minimum-role"}
	}

	return nil
}

type InvalidBoardErr struct {
	msg string
}

func (ibe InvalidBoardErr) Error() string {
	return ibe.msg
}

func (b *Board) IsValid() error {
	if b.TeamID == "" {
		return InvalidBoardErr{"empty-team-id"}
	}

	if !IsBoardTypeValid(b.Type) {
		return InvalidBoardErr{"invalid-board-type"}
	}

	if !IsBoardMinimumRoleValid(b.MinimumRole) {
		return InvalidBoardErr{"invalid-board-minimum-role"}
	}

	return nil
}

// BoardMemberHistoryEntry stores the information of the membership of a user on a board
// swagger:model
type BoardMemberHistoryEntry struct {
	// The ID of the board
	// required: true
	BoardID string `json:"boardId"`

	// The ID of the user
	// required: true
	UserID string `json:"userId"`

	// The action that added this history entry (created or deleted)
	// required: false
	Action string `json:"action"`

	// The insertion time
	// required: true
	InsertAt time.Time `json:"insertAt"`
}

func BoardSearchFieldFromString(field string) (BoardSearchField, error) {
	switch field {
	case string(BoardSearchFieldTitle):
		return BoardSearchFieldTitle, nil
	case string(BoardSearchFieldPropertyName):
		return BoardSearchFieldPropertyName, nil
	}
	return BoardSearchFieldNone, ErrInvalidBoardSearchField
}
