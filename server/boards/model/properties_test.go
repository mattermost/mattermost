// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/boards/utils"
)

type MockResolver struct{}

func (r MockResolver) GetUserByID(userID string) (*User, error) {
	if userID == "user_id_1" {
		return &User{
			ID:       "user_id_1",
			Username: "username_1",
		}, nil
	} else if userID == "user_id_2" {
		return &User{
			ID:       "user_id_2",
			Username: "username_2",
		}, nil
	}

	return nil, nil
}

func Test_parsePropertySchema(t *testing.T) {
	board := &Board{
		ID:     utils.NewID(utils.IDTypeBoard),
		Title:  "Test Board",
		TeamID: utils.NewID(utils.IDTypeTeam),
	}

	err := json.Unmarshal([]byte(cardPropertiesExample), &board.CardProperties)
	require.NoError(t, err)

	t.Run("parse schema", func(t *testing.T) {
		schema, err := ParsePropertySchema(board)
		require.NoError(t, err)

		assert.Len(t, schema, 6)

		prop, ok := schema["7c212e78-9345-4c60-81b5-0b0e37ce463f"]
		require.True(t, ok)

		assert.Equal(t, "select", prop.Type)
		assert.Equal(t, "Type", prop.Name)
		assert.Len(t, prop.Options, 3)

		prop, ok = schema["a8spou7if43eo1rqzb9qeq488so"]
		require.True(t, ok)

		assert.Equal(t, "date", prop.Type)
		assert.Equal(t, "MyDate", prop.Name)
		assert.Empty(t, prop.Options)
	})
}

func Test_GetValue(t *testing.T) {
	resolver := MockResolver{}

	propDef := PropDef{
		Type: "multiPerson",
	}

	value, err := propDef.GetValue([]interface{}{"user_id_1", "user_id_2"}, resolver)
	require.NoError(t, err)
	require.Equal(t, "username_1, username_2", value)

	// trying with only user
	value, err = propDef.GetValue([]interface{}{"user_id_1"}, resolver)
	require.NoError(t, err)
	require.Equal(t, "username_1", value)

	// trying with unknown user
	value, err = propDef.GetValue([]interface{}{"user_id_1", "user_id_unknown"}, resolver)
	require.NoError(t, err)
	require.Equal(t, "username_1, user_id_unknown", value)

	// trying with multiple unknown users
	value, err = propDef.GetValue([]interface{}{"michael_scott", "jim_halpert"}, resolver)
	require.NoError(t, err)
	require.Equal(t, "michael_scott, jim_halpert", value)
}

const (
	cardPropertiesExample = `[
	   {
		  "id":"7c212e78-9345-4c60-81b5-0b0e37ce463f",
		  "name":"Type",
		  "options":[
			 {
				"color":"propColorYellow",
				"id":"31da50ca-f1a9-4d21-8636-17dc387c1a23",
				"value":"Ad Hoc"
			 },
			 {
				"color":"propColorBlue",
				"id":"def6317c-ec11-410d-8a6b-ea461320f392",
				"value":"Standup"
			 },
			 {
				"color":"propColorPurple",
				"id":"700f83f8-6a41-46cd-87e2-53e0d0b12cc7",
				"value":"Weekly Sync"
			 }
		  ],
		  "type":"select"
	   },
	   {
		  "id":"13d2394a-eb5e-4f22-8c22-6515ec41c4a4",
		  "name":"Summary",
		  "options":[],
		  "type":"text"
	   },
	   {
		  "id":"566cd860-bbae-4bcd-86a8-7df4db2ba15c",
		  "name":"Color",
		  "options":[
			 {
				"color":"propColorDefault",
				"id":"efb0c783-f9ea-4938-8b86-9cf425296cd1",
				"value":"RED"
			 },
			 {
				"color":"propColorDefault",
				"id":"2f100e13-e7c4-4ab6-81c9-a17baf98b311",
				"value":"GREEN"
			 },
			 {
				"color":"propColorDefault",
				"id":"a05bdc80-bd90-45b0-8805-a7e77a4884be",
				"value":"BLUE"
			 }
		  ],
		  "type":"select"
	   },
	   {
		  "id":"aawg1s8rxq8o1bbksxmsmpsdd3r",
		  "name":"MyTextProp",
		  "options":[],
		  "type":"text"
	   },
	   {
		  "id":"awdwfigo4kse63bdfp56mzhip6w",
		  "name":"MyCheckBox",
		  "options":[],
		  "type":"checkbox"
	   },
	   {
		  "id":"a8spou7if43eo1rqzb9qeq488so",
		  "name":"MyDate",
		  "options":[],
		  "type":"date"
	   }
	]`
)
