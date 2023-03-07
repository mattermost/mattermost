// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"strings"

	"github.com/mattermost/mattermost-server/server/v7/boards/utils"
)

// BlockType represents a block type.
type BlockType string

const (
	TypeUnknown    = "unknown"
	TypeBoard      = "board"
	TypeCard       = "card"
	TypeView       = "view"
	TypeText       = "text"
	TypeCheckbox   = "checkbox"
	TypeComment    = "comment"
	TypeImage      = "image"
	TypeAttachment = "attachment"
	TypeDivider    = "divider"
)

func (bt BlockType) String() string {
	return string(bt)
}

// BlockTypeFromString returns an appropriate BlockType for the specified string.
func BlockTypeFromString(s string) (BlockType, error) {
	switch strings.ToLower(s) {
	case "board":
		return TypeBoard, nil
	case "card":
		return TypeCard, nil
	case "view":
		return TypeView, nil
	case "text":
		return TypeText, nil
	case "checkbox":
		return TypeCheckbox, nil
	case "comment":
		return TypeComment, nil
	case "image":
		return TypeImage, nil
	case "attachment":
		return TypeAttachment, nil
	case "divider":
		return TypeDivider, nil
	}
	return TypeUnknown, ErrInvalidBlockType{s}
}

// BlockType2IDType returns an appropriate IDType for the specified BlockType.
func BlockType2IDType(blockType BlockType) utils.IDType {
	switch blockType {
	case TypeBoard:
		return utils.IDTypeBoard
	case TypeCard:
		return utils.IDTypeCard
	case TypeView:
		return utils.IDTypeView
	case TypeText, TypeCheckbox, TypeComment, TypeDivider:
		return utils.IDTypeBlock
	case TypeImage, TypeAttachment:
		return utils.IDTypeAttachment
	}
	return utils.IDTypeNone
}

// ErrInvalidBlockType is returned wherever an invalid block type was provided.
type ErrInvalidBlockType struct {
	Type string
}

func (e ErrInvalidBlockType) Error() string {
	return e.Type + " is an invalid block type."
}

// IsErrInvalidBlockType returns true if `err` is a IsErrInvalidBlockType or wraps one.
func IsErrInvalidBlockType(err error) bool {
	var eibt *ErrInvalidBlockType
	return errors.As(err, &eibt)
}
