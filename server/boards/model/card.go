// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"fmt"

	"github.com/rivo/uniseg"

	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

var ErrBoardIDMismatch = errors.New("Board IDs do not match")

type ErrInvalidCard struct {
	msg string
}

func NewErrInvalidCard(msg string) ErrInvalidCard {
	return ErrInvalidCard{
		msg: msg,
	}
}

func (e ErrInvalidCard) Error() string {
	return fmt.Sprintf("invalid card, %s", e.msg)
}

var ErrNotCardBlock = errors.New("not a card block")

type ErrInvalidFieldType struct {
	field string
}

func (e ErrInvalidFieldType) Error() string {
	return fmt.Sprintf("invalid type for field '%s'", e.field)
}

// Card represents a group of content blocks and properties.
// swagger:model
type Card struct {
	// The id for this card
	// required: false
	ID string `json:"id"`

	// The id for board this card belongs to.
	// required: false
	BoardID string `json:"boardId"`

	// The id for user who created this card
	// required: false
	CreatedBy string `json:"createdBy"`

	// The id for user who last modified this card
	// required: false
	ModifiedBy string `json:"modifiedBy"`

	// The display title
	// required: false
	Title string `json:"title"`

	// An array of content block ids specifying the ordering of content for this card.
	// required: false
	ContentOrder []string `json:"contentOrder"`

	// The icon of the card
	// required: false
	Icon string `json:"icon"`

	// True if this card belongs to a template
	// required: false
	IsTemplate bool `json:"isTemplate"`

	// A map of property ids to property values (option ids, strings, array of option ids)
	// required: false
	Properties map[string]any `json:"properties"`

	// The creation time in milliseconds since the current epoch
	// required: false
	CreateAt int64 `json:"createAt"`

	// The last modified time in milliseconds since the current epoch
	// required: false
	UpdateAt int64 `json:"updateAt"`

	// The deleted time in milliseconds since the current epoch. Set to indicate this card is deleted
	// required: false
	DeleteAt int64 `json:"deleteAt"`
}

// Populate populates a Card with default values.
func (c *Card) Populate() {
	if c.ID == "" {
		c.ID = utils.NewID(utils.IDTypeCard)
	}
	if c.ContentOrder == nil {
		c.ContentOrder = make([]string, 0)
	}
	if c.Properties == nil {
		c.Properties = make(map[string]any)
	}
	now := utils.GetMillis()
	if c.CreateAt == 0 {
		c.CreateAt = now
	}
	if c.UpdateAt == 0 {
		c.UpdateAt = now
	}
}

func (c *Card) PopulateWithBoardID(boardID string) {
	c.BoardID = boardID
	c.Populate()
}

// CheckValid returns an error if the Card has invalid field values.
func (c *Card) CheckValid() error {
	if c.ID == "" {
		return ErrInvalidCard{"ID is missing"}
	}
	if c.BoardID == "" {
		return ErrInvalidCard{"BoardID is missing"}
	}
	if c.ContentOrder == nil {
		return ErrInvalidCard{"ContentOrder is missing"}
	}
	if uniseg.GraphemeClusterCount(c.Icon) > 1 {
		return ErrInvalidCard{"Icon can have only one grapheme"}
	}
	if c.Properties == nil {
		return ErrInvalidCard{"Properties"}
	}
	if c.CreateAt == 0 {
		return ErrInvalidCard{"CreateAt"}
	}
	if c.UpdateAt == 0 {
		return ErrInvalidCard{"UpdateAt"}
	}
	return nil
}

// CardPatch is a patch for modifying cards
// swagger:model
type CardPatch struct {
	// The display title
	// required: false
	Title *string `json:"title"`

	// An array of content block ids specifying the ordering of content for this card.
	// required: false
	ContentOrder *[]string `json:"contentOrder"`

	// The icon of the card
	// required: false
	Icon *string `json:"icon"`

	// A map of property ids to property option ids to be updated
	// required: false
	UpdatedProperties map[string]any `json:"updatedProperties"`
}

// Patch returns an updated version of the card.
func (p *CardPatch) Patch(card *Card) *Card {
	if p.Title != nil {
		card.Title = *p.Title
	}

	if p.ContentOrder != nil {
		card.ContentOrder = *p.ContentOrder
	}

	if p.Icon != nil {
		card.Icon = *p.Icon
	}

	if card.Properties == nil {
		card.Properties = make(map[string]any)
	}

	// if there are properties marked for update, we replace the
	// existing ones or add them
	for propID, propVal := range p.UpdatedProperties {
		card.Properties[propID] = propVal
	}

	return card
}

// CheckValid returns an error if the CardPatch has invalid field values.
func (p *CardPatch) CheckValid() error {
	if p.Icon != nil && uniseg.GraphemeClusterCount(*p.Icon) > 1 {
		return ErrInvalidCard{"Icon can have only one grapheme"}
	}
	return nil
}

// Card2Block converts a card to block using a shallow copy. Not needed once cards are first class entities.
func Card2Block(card *Card) *Block {
	fields := make(map[string]interface{})

	fields["contentOrder"] = card.ContentOrder
	fields["icon"] = card.Icon
	fields["isTemplate"] = card.IsTemplate
	fields["properties"] = card.Properties

	return &Block{
		ID:         card.ID,
		ParentID:   card.BoardID,
		CreatedBy:  card.CreatedBy,
		ModifiedBy: card.ModifiedBy,
		Schema:     1,
		Type:       TypeCard,
		Title:      card.Title,
		Fields:     fields,
		CreateAt:   card.CreateAt,
		UpdateAt:   card.UpdateAt,
		DeleteAt:   card.DeleteAt,
		BoardID:    card.BoardID,
	}
}

// Block2Card converts a block to a card. Not needed once cards are first class entities.
func Block2Card(block *Block) (*Card, error) {
	if block.Type != TypeCard {
		return nil, fmt.Errorf("cannot convert block to card: %w", ErrNotCardBlock)
	}

	contentOrder := make([]string, 0)
	icon := ""
	isTemplate := false
	properties := make(map[string]any)

	if co, ok := block.Fields["contentOrder"]; ok {
		switch arr := co.(type) {
		case []any:
			for _, str := range arr {
				if id, ok := str.(string); ok {
					contentOrder = append(contentOrder, id)
				} else {
					return nil, ErrInvalidFieldType{"contentOrder item"}
				}
			}
		case []string:
			contentOrder = append(contentOrder, arr...)
		default:
			return nil, ErrInvalidFieldType{"contentOrder"}
		}
	}

	if iconAny, ok := block.Fields["icon"]; ok {
		if id, ok := iconAny.(string); ok {
			icon = id
		} else {
			return nil, ErrInvalidFieldType{"icon"}
		}
	}

	if isTemplateAny, ok := block.Fields["isTemplate"]; ok {
		if b, ok := isTemplateAny.(bool); ok {
			isTemplate = b
		} else {
			return nil, ErrInvalidFieldType{"isTemplate"}
		}
	}

	if props, ok := block.Fields["properties"]; ok {
		if propMap, ok := props.(map[string]any); ok {
			for k, v := range propMap {
				properties[k] = v
			}
		} else {
			return nil, ErrInvalidFieldType{"properties"}
		}
	}

	card := &Card{
		ID:           block.ID,
		BoardID:      block.BoardID,
		CreatedBy:    block.CreatedBy,
		ModifiedBy:   block.ModifiedBy,
		Title:        block.Title,
		ContentOrder: contentOrder,
		Icon:         icon,
		IsTemplate:   isTemplate,
		Properties:   properties,
		CreateAt:     block.CreateAt,
		UpdateAt:     block.UpdateAt,
		DeleteAt:     block.DeleteAt,
	}
	card.Populate()
	return card, nil
}

// CardPatch2BlockPatch converts a CardPatch to a BlockPatch. Not needed once cards are first class entities.
func CardPatch2BlockPatch(cardPatch *CardPatch) (*BlockPatch, error) {
	if err := cardPatch.CheckValid(); err != nil {
		return nil, err
	}

	blockPatch := &BlockPatch{
		Title: cardPatch.Title,
	}

	updatedFields := make(map[string]any, 0)

	if cardPatch.ContentOrder != nil {
		updatedFields["contentOrder"] = cardPatch.ContentOrder
	}
	if cardPatch.Icon != nil {
		updatedFields["icon"] = cardPatch.Icon
	}

	properties := make(map[string]any)
	for k, v := range cardPatch.UpdatedProperties {
		properties[k] = v
	}

	if len(properties) != 0 {
		updatedFields["properties"] = cardPatch.UpdatedProperties
	}

	blockPatch.UpdatedFields = updatedFields

	return blockPatch, nil
}
