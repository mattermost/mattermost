// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:generate mockgen -destination=mocks/propValueResolverMock.go -package mocks . PropValueResolver

package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/v6/boards/utils"
)

var ErrInvalidBoardBlock = errors.New("invalid board block")
var ErrInvalidPropSchema = errors.New("invalid property schema")
var ErrInvalidProperty = errors.New("invalid property")
var ErrInvalidPropertyValue = errors.New("invalid property value")
var ErrInvalidPropertyValueType = errors.New("invalid property value type")
var ErrInvalidDate = errors.New("invalid date property")

// PropValueResolver allows PropDef.GetValue to further decode property values, such as
// looking up usernames from ids.
type PropValueResolver interface {
	GetUserByID(userID string) (*User, error)
}

// BlockProperties is a map of Prop's keyed by property id.
type BlockProperties map[string]BlockProp

// BlockProp represent a property attached to a block (typically a card).
type BlockProp struct {
	ID    string `json:"id"`
	Index int    `json:"index"`
	Name  string `json:"name"`
	Value string `json:"value"`
}

// PropSchema is a map of PropDef's keyed by property id.
type PropSchema map[string]PropDef

// PropDefOption represents an option within a property definition.
type PropDefOption struct {
	ID    string `json:"id"`
	Index int    `json:"index"`
	Color string `json:"color"`
	Value string `json:"value"`
}

// PropDef represents a property definition as defined in a board's Fields member.
type PropDef struct {
	ID      string                   `json:"id"`
	Index   int                      `json:"index"`
	Name    string                   `json:"name"`
	Type    string                   `json:"type"`
	Options map[string]PropDefOption `json:"options"`
}

// GetValue resolves the value of a property if the passed value is an ID for an option,
// otherwise returns the original value.
func (pd PropDef) GetValue(v interface{}, resolver PropValueResolver) (string, error) {
	switch pd.Type {
	case "select":
		// v is the id of an option
		id, ok := v.(string)
		if !ok {
			return "", ErrInvalidPropertyValueType
		}
		opt, ok := pd.Options[id]
		if !ok {
			return "", ErrInvalidPropertyValue
		}
		return strings.ToUpper(opt.Value), nil

	case "date":
		// v is a JSON string
		date, ok := v.(string)
		if !ok {
			return "", ErrInvalidPropertyValueType
		}
		return pd.ParseDate(date)

	case "person":
		// v is a userid
		userID, ok := v.(string)
		if !ok {
			return "", ErrInvalidPropertyValueType
		}
		if resolver != nil {
			user, err := resolver.GetUserByID(userID)
			if err != nil {
				return "", err
			}
			if user == nil {
				return userID, nil
			}
			return user.Username, nil
		}
		return userID, nil

	case "multiPerson":
		// v is a slice of user IDs
		userIDs, ok := v.([]interface{})
		if !ok {
			return "", fmt.Errorf("multiPerson property type: %w", ErrInvalidPropertyValueType)
		}
		if resolver != nil {
			usernames := make([]string, len(userIDs))

			for i, userIDInterface := range userIDs {
				userID := userIDInterface.(string)

				user, err := resolver.GetUserByID(userID)
				if err != nil {
					return "", err
				}
				if user == nil {
					usernames[i] = userID
				} else {
					usernames[i] = user.Username
				}
			}

			return strings.Join(usernames, ", "), nil
		}

	case "multiSelect":
		// v is a slice of strings containing option ids
		ms, ok := v.([]interface{})
		if !ok {
			return "", ErrInvalidPropertyValueType
		}
		var sb strings.Builder
		prefix := ""
		for _, optid := range ms {
			id, ok := optid.(string)
			if !ok {
				return "", ErrInvalidPropertyValueType
			}
			opt, ok := pd.Options[id]
			if !ok {
				return "", ErrInvalidPropertyValue
			}
			sb.WriteString(prefix)
			prefix = ", "
			sb.WriteString(strings.ToUpper(opt.Value))
		}
		return sb.String(), nil
	}
	return fmt.Sprintf("%v", v), nil
}

func (pd PropDef) ParseDate(s string) (string, error) {
	// s is a JSON snippet of the form: {"from":1642161600000, "to":1642161600000} in milliseconds UTC
	// The UI does not yet support date ranges.
	var m map[string]int64
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		return s, err
	}
	tsFrom, ok := m["from"]
	if !ok {
		return s, ErrInvalidDate
	}
	date := utils.GetTimeForMillis(tsFrom).Format("January 02, 2006")
	tsTo, ok := m["to"]
	if ok {
		date += " -> " + utils.GetTimeForMillis(tsTo).Format("January 02, 2006")
	}
	return date, nil
}

// ParsePropertySchema parses a board block's `Fields` to extract the properties
// schema for all cards within the board.
// The result is provided as a map for quick lookup, and the original order is
// preserved via the `Index` field.
func ParsePropertySchema(board *Board) (PropSchema, error) {
	schema := make(map[string]PropDef)

	for i, prop := range board.CardProperties {
		pd := PropDef{
			ID:      getMapString("id", prop),
			Index:   i,
			Name:    getMapString("name", prop),
			Type:    getMapString("type", prop),
			Options: make(map[string]PropDefOption),
		}
		optsIface, ok := prop["options"]
		if ok {
			opts, ok := optsIface.([]interface{})
			if !ok {
				return nil, ErrInvalidPropSchema
			}
			for j, propOptIface := range opts {
				propOpt, ok := propOptIface.(map[string]interface{})
				if !ok {
					return nil, ErrInvalidPropSchema
				}
				po := PropDefOption{
					ID:    getMapString("id", propOpt),
					Index: j,
					Value: getMapString("value", propOpt),
					Color: getMapString("color", propOpt),
				}
				pd.Options[po.ID] = po
			}
		}
		schema[pd.ID] = pd
	}
	return schema, nil
}

func getMapString(key string, m map[string]interface{}) string {
	iface, ok := m[key]
	if !ok {
		return ""
	}

	s, ok := iface.(string)
	if !ok {
		return ""
	}
	return s
}

// ParseProperties parses a block's `Fields` to extract the properties. Properties typically exist on
// card blocks.  A resolver can optionally be provided to fetch usernames for `person` prop type.
func ParseProperties(block *Block, schema PropSchema, resolver PropValueResolver) (BlockProperties, error) {
	props := make(map[string]BlockProp)

	if block == nil {
		return props, nil
	}

	// `properties` contains a map (untyped at this point).
	propsIface, ok := block.Fields["properties"]
	if !ok {
		return props, nil // this is expected for blocks that don't have any properties.
	}

	blockProps, ok := propsIface.(map[string]interface{})
	if !ok {
		return props, fmt.Errorf("`properties` field wrong type: %w", ErrInvalidProperty)
	}

	if len(blockProps) == 0 {
		return props, nil
	}

	for k, v := range blockProps {
		s := fmt.Sprintf("%v", v)

		prop := BlockProp{
			ID:    k,
			Name:  k,
			Value: s,
		}

		def, ok := schema[k]
		if ok {
			val, err := def.GetValue(v, resolver)
			if err != nil {
				return props, fmt.Errorf("could not parse property value (%s): %w", fmt.Sprintf("%v", v), err)
			}
			prop.Name = def.Name
			prop.Value = val
			prop.Index = def.Index
		}
		props[k] = prop
	}
	return props, nil
}
