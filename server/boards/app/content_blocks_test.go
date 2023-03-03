// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

type contentOrderMatcher struct {
	contentOrder []string
}

func NewContentOrderMatcher(contentOrder []string) contentOrderMatcher {
	return contentOrderMatcher{contentOrder}
}

func (com contentOrderMatcher) Matches(x interface{}) bool {
	patch, ok := x.(*model.BlockPatch)
	if !ok {
		return false
	}

	contentOrderData, ok := patch.UpdatedFields["contentOrder"]
	if !ok {
		return false
	}

	contentOrder, ok := contentOrderData.([]interface{})
	if !ok {
		return false
	}

	if len(contentOrder) != len(com.contentOrder) {
		return false
	}

	for i := range contentOrder {
		if contentOrder[i] != com.contentOrder[i] {
			return false
		}
	}
	return true
}

func (com contentOrderMatcher) String() string {
	return fmt.Sprint(&model.BlockPatch{UpdatedFields: map[string]interface{}{"contentOrder": com.contentOrder}})
}

func TestMoveContentBlock(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	ttCases := []struct {
		name                 string
		srcBlock             model.Block
		dstBlock             model.Block
		parentBlock          *model.Block
		where                string
		userID               string
		mockPatch            bool
		mockPatchError       error
		errorMessage         string
		expectedContentOrder []string
	}{
		{
			name:         "not matching parents",
			srcBlock:     model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:     model.Block{ID: "test-2", ParentID: "other-test-card"},
			parentBlock:  nil,
			where:        "after",
			userID:       "user-id",
			errorMessage: "not matching parent test-card and other-test-card",
		},
		{
			name:         "parent not found",
			srcBlock:     model.Block{ID: "test-1", ParentID: "invalid-card"},
			dstBlock:     model.Block{ID: "test-2", ParentID: "invalid-card"},
			parentBlock:  &model.Block{ID: "invalid-card"},
			where:        "after",
			userID:       "user-id",
			errorMessage: "{test} not found",
		},
		{
			name:         "valid parent without content order",
			srcBlock:     model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:     model.Block{ID: "test-2", ParentID: "test-card"},
			parentBlock:  &model.Block{ID: "test-card"},
			where:        "after",
			userID:       "user-id",
			errorMessage: "source block test-1 not found",
		},
		{
			name:         "valid parent with content order but without test-1 in it",
			srcBlock:     model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:     model.Block{ID: "test-2", ParentID: "test-card"},
			parentBlock:  &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-2"}}},
			where:        "after",
			userID:       "user-id",
			errorMessage: "source block test-1 not found",
		},
		{
			name:         "valid parent with content order but without test-2 in it",
			srcBlock:     model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:     model.Block{ID: "test-2", ParentID: "test-card"},
			parentBlock:  &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-1"}}},
			where:        "after",
			userID:       "user-id",
			errorMessage: "destination block test-2 not found",
		},
		{
			name:           "valid request but fail on patchparent with content order",
			srcBlock:       model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:       model.Block{ID: "test-2", ParentID: "test-card"},
			parentBlock:    &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-1", "test-2"}}},
			where:          "after",
			userID:         "user-id",
			mockPatch:      true,
			mockPatchError: errors.New("test error"),
			errorMessage:   "test error",
		},
		{
			name:                 "valid request with not real change",
			srcBlock:             model.Block{ID: "test-2", ParentID: "test-card"},
			dstBlock:             model.Block{ID: "test-1", ParentID: "test-card"},
			parentBlock:          &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-1", "test-2", "test-3"}}, BoardID: "test-board"},
			where:                "after",
			userID:               "user-id",
			mockPatch:            true,
			errorMessage:         "",
			expectedContentOrder: []string{"test-1", "test-2", "test-3"},
		},
		{
			name:                 "valid request changing order with before",
			srcBlock:             model.Block{ID: "test-2", ParentID: "test-card"},
			dstBlock:             model.Block{ID: "test-1", ParentID: "test-card"},
			parentBlock:          &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-1", "test-2", "test-3"}}, BoardID: "test-board"},
			where:                "before",
			userID:               "user-id",
			mockPatch:            true,
			errorMessage:         "",
			expectedContentOrder: []string{"test-2", "test-1", "test-3"},
		},
		{
			name:                 "valid request changing order with after",
			srcBlock:             model.Block{ID: "test-1", ParentID: "test-card"},
			dstBlock:             model.Block{ID: "test-2", ParentID: "test-card"},
			parentBlock:          &model.Block{ID: "test-card", Fields: map[string]interface{}{"contentOrder": []interface{}{"test-1", "test-2", "test-3"}}, BoardID: "test-board"},
			where:                "after",
			userID:               "user-id",
			mockPatch:            true,
			errorMessage:         "",
			expectedContentOrder: []string{"test-2", "test-1", "test-3"},
		},
	}

	for _, tc := range ttCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.parentBlock != nil {
				if tc.parentBlock.ID == "invalid-card" {
					th.Store.EXPECT().GetBlock(tc.srcBlock.ParentID).Return(nil, model.NewErrNotFound("test"))
				} else {
					th.Store.EXPECT().GetBlock(tc.parentBlock.ID).Return(tc.parentBlock, nil)
					if tc.mockPatch {
						if tc.mockPatchError != nil {
							th.Store.EXPECT().GetBlock(tc.parentBlock.ID).Return(nil, tc.mockPatchError)
						} else {
							th.Store.EXPECT().GetBlock(tc.parentBlock.ID).Return(tc.parentBlock, nil)
							th.Store.EXPECT().PatchBlock(tc.parentBlock.ID, NewContentOrderMatcher(tc.expectedContentOrder), gomock.Eq("user-id")).Return(nil)
							th.Store.EXPECT().GetBlock(tc.parentBlock.ID).Return(tc.parentBlock, nil)
							th.Store.EXPECT().GetBoard(tc.parentBlock.BoardID).Return(&model.Board{ID: "test-board"}, nil)
							// this call comes from the WS server notification
							th.Store.EXPECT().GetMembersForBoard(gomock.Any()).Times(1)
						}
					}
				}
			}

			err := th.App.MoveContentBlock(&tc.srcBlock, &tc.dstBlock, tc.where, tc.userID)
			if tc.errorMessage == "" {
				require.NoError(t, err)
			} else {
				require.EqualError(t, err, tc.errorMessage)
			}
		})
	}
}
