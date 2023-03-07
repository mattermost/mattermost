// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/boards/utils"
)

func TestBlock2Card(t *testing.T) {
	blockID := utils.NewID(utils.IDTypeCard)
	boardID := utils.NewID(utils.IDTypeBoard)
	userID := utils.NewID(utils.IDTypeUser)
	now := utils.GetMillis()

	var fields map[string]any
	err := json.Unmarshal([]byte(sampleBlockFieldsJSON), &fields)
	require.NoError(t, err)

	block := &Block{
		ID:         blockID,
		ParentID:   boardID,
		CreatedBy:  userID,
		ModifiedBy: userID,
		Schema:     1,
		Type:       TypeCard,
		Title:      "My card title",
		Fields:     fields,
		CreateAt:   now,
		UpdateAt:   now,
		DeleteAt:   0,
		BoardID:    boardID,
	}

	t.Run("Good block", func(t *testing.T) {
		card, err := Block2Card(block)
		require.NoError(t, err)

		assert.Equal(t, block.ID, card.ID)
		assert.Equal(t, []string{"acdxa8r8aht85pyoeuj1ed7tu8w", "73urm1huoupd4idzkdq5yaeuyay", "ay6sogs9owtd9xbyn49qt3395ko"}, card.ContentOrder)
		assert.EqualValues(t, fields["icon"], card.Icon)
		assert.EqualValues(t, fields["isTemplate"], card.IsTemplate)
		assert.EqualValues(t, fields["properties"], card.Properties)
	})

	t.Run("Not a card", func(t *testing.T) {
		blockNotCard := &Block{}

		card, err := Block2Card(blockNotCard)
		require.Error(t, err)
		require.Nil(t, card)
	})
}

const sampleBlockFieldsJSON = `
{
	"contentOrder":[
	   "acdxa8r8aht85pyoeuj1ed7tu8w",
	   "73urm1huoupd4idzkdq5yaeuyay",
	   "ay6sogs9owtd9xbyn49qt3395ko"
	],
	"icon":"🎨",
	"isTemplate":false,
	"properties":{
	   "aa7swu9zz3ofdkcna3h867cum4y":"212-444-1234",
	   "af6fcbb8-ca56-4b73-83eb-37437b9a667d":"77c539af-309c-4db1-8329-d20ef7e9eacd",
	   "aiwt9ibi8jjrf9hzi1xzk8no8mo":"foo",
	   "aj65h4s6ghr6wgh3bnhqbzzmiaa":"77",
	   "ajy6xbebzopojaenbnmfpgtdwso":"{\"from\":1660046400000}",
	   "amc8wnk1xqj54rymkoqffhtw7ie":"zhqsoeqs1pg9i8gk81k9ryy83h",
	   "aooz77t119y7xtfmoyeiy4up75c":"someone@example.com",
	   "auskzaoaccsn55icuwarf4o3tfe":"https://www.google.com",
	   "aydsk41h6cs1z7nmghaw16jqcia":[
		  "aw565znut6zphbxqhbwyawiuggy",
		  "aefd3pxciomrkur4rc6smg1usoc",
		  "a6c96kwrqaskbtochq9wunmzweh",
		  "atyexeuq993fwwb84bxoqixxqqr"
	   ],
	   "d6b1249b-bc18-45fc-889e-bec48fce80ef":"9a090e33-b110-4268-8909-132c5002c90e",
	   "d9725d14-d5a8-48e5-8de1-6f8c004a9680":"3245a32d-f688-463b-87f4-8e7142c1b397"
	}
}`
