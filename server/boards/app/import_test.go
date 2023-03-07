// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/boards/utils"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v7/boards/model"
)

func TestApp_ImportArchive(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	board := &model.Board{
		ID:     "d14b9df9-1f31-4732-8a64-92bc7162cd28",
		TeamID: "test-team",
		Title:  "Cross-Functional Project Plan",
	}

	block := &model.Block{
		ID:       "2c1873e0-1484-407d-8b2c-3c3b5a2a9f9e",
		ParentID: board.ID,
		Type:     model.TypeView,
		BoardID:  board.ID,
	}

	babs := &model.BoardsAndBlocks{
		Boards: []*model.Board{board},
		Blocks: []*model.Block{block},
	}

	boardMember := &model.BoardMember{
		BoardID: board.ID,
		UserID:  "user",
	}

	t.Run("import asana archive", func(t *testing.T) {
		r := bytes.NewReader([]byte(asana))
		opts := model.ImportArchiveOptions{
			TeamID:     "test-team",
			ModifiedBy: "user",
		}

		th.Store.EXPECT().CreateBoardsAndBlocks(gomock.AssignableToTypeOf(&model.BoardsAndBlocks{}), "user").Return(babs, nil)
		th.Store.EXPECT().GetMembersForBoard(board.ID).AnyTimes().Return([]*model.BoardMember{boardMember}, nil)
		th.Store.EXPECT().GetBoard(board.ID).Return(board, nil)
		th.Store.EXPECT().GetMemberForBoard(board.ID, "user").Return(boardMember, nil)
		th.Store.EXPECT().GetUserCategoryBoards("user", "test-team").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					Type: "default",
					Name: "Boards",
					ID:   "boards_category_id",
				},
			},
		}, nil)
		th.Store.EXPECT().GetUserCategoryBoards("user", "test-team")
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user", "test-team", false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().GetMembersForUser("user").Return([]*model.BoardMember{}, nil)
		th.Store.EXPECT().AddUpdateCategoryBoard("user", utils.Anything, utils.Anything).Return(nil)

		err := th.App.ImportArchive(r, opts)
		require.NoError(t, err, "import archive should not fail")
	})

	t.Run("import board archive", func(t *testing.T) {
		r := bytes.NewReader([]byte(boardArchive))
		opts := model.ImportArchiveOptions{
			TeamID:     "test-team",
			ModifiedBy: "f1tydgc697fcbp8ampr6881jea",
		}

		bm1 := &model.BoardMember{
			BoardID: board.ID,
			UserID:  "f1tydgc697fcbp8ampr6881jea",
		}

		bm2 := &model.BoardMember{
			BoardID: board.ID,
			UserID:  "hxxzooc3ff8cubsgtcmpn8733e",
		}

		bm3 := &model.BoardMember{
			BoardID: board.ID,
			UserID:  "nto73edn5ir6ifimo5a53y1dwa",
		}

		user1 := &model.User{
			ID: "f1tydgc697fcbp8ampr6881jea",
		}

		user2 := &model.User{
			ID: "hxxzooc3ff8cubsgtcmpn8733e",
		}

		user3 := &model.User{
			ID: "nto73edn5ir6ifimo5a53y1dwa",
		}

		th.Store.EXPECT().CreateBoardsAndBlocks(gomock.AssignableToTypeOf(&model.BoardsAndBlocks{}), "f1tydgc697fcbp8ampr6881jea").Return(babs, nil)
		th.Store.EXPECT().GetMembersForBoard(board.ID).AnyTimes().Return([]*model.BoardMember{bm1, bm2, bm3}, nil)
		th.Store.EXPECT().GetUserCategoryBoards("f1tydgc697fcbp8ampr6881jea", "test-team").Return([]model.CategoryBoards{}, nil)
		th.Store.EXPECT().GetUserCategoryBoards("f1tydgc697fcbp8ampr6881jea", "test-team").Return([]model.CategoryBoards{
			{
				Category: model.Category{
					ID:   "boards_category_id",
					Name: "Boards",
					Type: model.CategoryTypeSystem,
				},
			},
		}, nil)
		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category_id",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetMembersForUser("f1tydgc697fcbp8ampr6881jea").Return([]*model.BoardMember{}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("f1tydgc697fcbp8ampr6881jea", "test-team", false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().AddUpdateCategoryBoard("f1tydgc697fcbp8ampr6881jea", utils.Anything, utils.Anything).Return(nil)
		th.Store.EXPECT().GetBoard(board.ID).AnyTimes().Return(board, nil)
		th.Store.EXPECT().GetMemberForBoard(board.ID, "f1tydgc697fcbp8ampr6881jea").AnyTimes().Return(bm1, nil)
		th.Store.EXPECT().GetMemberForBoard(board.ID, "hxxzooc3ff8cubsgtcmpn8733e").AnyTimes().Return(bm2, nil)
		th.Store.EXPECT().GetMemberForBoard(board.ID, "nto73edn5ir6ifimo5a53y1dwa").AnyTimes().Return(bm3, nil)
		th.Store.EXPECT().GetUserByID("f1tydgc697fcbp8ampr6881jea").AnyTimes().Return(user1, nil)
		th.Store.EXPECT().GetUserByID("hxxzooc3ff8cubsgtcmpn8733e").AnyTimes().Return(user2, nil)
		th.Store.EXPECT().GetUserByID("nto73edn5ir6ifimo5a53y1dwa").AnyTimes().Return(user3, nil)

		boardID, err := th.App.ImportBoardJSONL(r, opts)
		require.Equal(t, board.ID, boardID, "Board ID should be same")
		require.NoError(t, err, "import archive should not fail")
	})
}

//nolint:lll
const asana = `{"version":1,"date":1614714686842}
{"type":"block","data":{"id":"d14b9df9-1f31-4732-8a64-92bc7162cd28","fields":{"icon":"","description":"","cardProperties":[{"id":"3bdcbaeb-bc78-4884-8531-a0323b74676a","name":"Section","type":"select","options":[{"id":"d8d94ef1-5e74-40bb-8be5-fc0eb3f47732","value":"Planning","color":"propColorGray"},{"id":"454559bb-b788-4ff6-873e-04def8491d2c","value":"Milestones","color":"propColorBrown"},{"id":"deaab476-c690-48df-828f-725b064dc476","value":"Next steps","color":"propColorOrange"},{"id":"2138305a-3157-461c-8bbe-f19ebb55846d","value":"Comms Plan","color":"propColorYellow"}]}]},"createAt":1614714686836,"updateAt":1614714686836,"deleteAt":0,"schema":1,"parentId":"","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"board","title":"Cross-Functional Project Plan"}}
{"type":"block","data":{"id":"2c1873e0-1484-407d-8b2c-3c3b5a2a9f9e","fields":{"sortOptions":[],"visiblePropertyIds":[],"visibleOptionIds":[],"hiddenOptionIds":[],"filter":{"operation":"and","filters":[]},"cardOrder":[],"columnWidths":{},"viewType":"board"},"createAt":1614714686840,"updateAt":1614714686840,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"view","title":"Board View"}}
{"type":"block","data":{"id":"520c332b-adf5-4a32-88ab-43655c8b6aa2","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"d8d94ef1-5e74-40bb-8be5-fc0eb3f47732"},"contentOrder":["deb3966c-6d56-43b1-8e95-36806877ce81"]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[READ ME] - Instructions for using this template"}}
{"type":"block","data":{"id":"deb3966c-6d56-43b1-8e95-36806877ce81","fields":{},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"520c332b-adf5-4a32-88ab-43655c8b6aa2","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"text","title":"This project template is set up in List View with sections and Asana-created Custom Fields to help you track your team's work. We've provided some example content in this template to get you started, but you should add tasks, change task names, add more Custom Fields, and change any other info to make this project your own.\n\nSend feedback about this template: https://asa.na/templatesfeedback"}}
{"type":"block","data":{"id":"be791f66-a5e5-4408-82f6-cb1280f5bc45","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"d8d94ef1-5e74-40bb-8be5-fc0eb3f47732"},"contentOrder":["2688b31f-e7ff-4de1-87ae-d4b5570f8712"]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"Redesign the landing page of our website"}}
{"type":"block","data":{"id":"2688b31f-e7ff-4de1-87ae-d4b5570f8712","fields":{},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"be791f66-a5e5-4408-82f6-cb1280f5bc45","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"text","title":"Redesign the landing page to focus on the main persona."}}
{"type":"block","data":{"id":"98f74948-1700-4a3c-8cc2-8bb632499def","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"454559bb-b788-4ff6-873e-04def8491d2c"},"contentOrder":[]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[EXAMPLE TASK] Consider trying a new email marketing service"}}
{"type":"block","data":{"id":"142fba5d-05e6-4865-83d9-b3f54d9de96e","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"454559bb-b788-4ff6-873e-04def8491d2c"},"contentOrder":[]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[EXAMPLE TASK] Budget finalization"}}
{"type":"block","data":{"id":"ca6670b1-b034-4e42-8971-c659b478b9e0","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"deaab476-c690-48df-828f-725b064dc476"},"contentOrder":[]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[EXAMPLE TASK] Find a venue for the holiday party"}}
{"type":"block","data":{"id":"db1dd596-0999-4741-8b05-72ca8e438e31","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"deaab476-c690-48df-828f-725b064dc476"},"contentOrder":[]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[EXAMPLE TASK] Approve campaign copy"}}
{"type":"block","data":{"id":"16861c05-f31f-46af-8429-80a87b5aa93a","fields":{"icon":"","properties":{"3bdcbaeb-bc78-4884-8531-a0323b74676a":"2138305a-3157-461c-8bbe-f19ebb55846d"},"contentOrder":[]},"createAt":1614714686841,"updateAt":1614714686841,"deleteAt":0,"schema":1,"parentId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","rootId":"d14b9df9-1f31-4732-8a64-92bc7162cd28","modifiedBy":"","type":"card","title":"[EXAMPLE TASK] Send out updated attendee list"}}
`

//nolint:lll
const boardArchive = `{"type":"board","data":{"id":"bfoi6yy6pa3yzika53spj7pq9ee","teamId":"wsmqbtwb5jb35jb3mtp85c8a9h","channelId":"","createdBy":"nto73edn5ir6ifimo5a53y1dwa","modifiedBy":"nto73edn5ir6ifimo5a53y1dwa","type":"P","minimumRole":"","title":"Custom","description":"","icon":"","showDescription":false,"isTemplate":false,"templateVersion":0,"properties":{},"cardProperties":[{"id":"aonihehbifijmx56aqzu3cc7w1r","name":"Status","options":[],"type":"select"},{"id":"aohjkzt769rxhtcz1o9xcoce5to","name":"Person","options":[],"type":"person"}],"createAt":1672750481591,"updateAt":1672750481591,"deleteAt":0}}
{"type":"block","data":{"id":"ckpc3b1dp3pbw7bqntfryy9jbzo","parentId":"bjaqxtbyqz3bu7pgyddpgpms74a","createdBy":"nto73edn5ir6ifimo5a53y1dwa","modifiedBy":"nto73edn5ir6ifimo5a53y1dwa","schema":1,"type":"card","title":"Test","fields":{"contentOrder":[],"icon":"","isTemplate":false,"properties":{"aohjkzt769rxhtcz1o9xcoce5to":"hxxzooc3ff8cubsgtcmpn8733e"}},"createAt":1672750481612,"updateAt":1672845003530,"deleteAt":0,"boardId":"bfoi6yy6pa3yzika53spj7pq9ee"}}
{"type":"block","data":{"id":"v7tdajwpm47r3u8duedk89bhxar","parentId":"bpypang3a3errqstj1agx9kuqay","createdBy":"nto73edn5ir6ifimo5a53y1dwa","modifiedBy":"nto73edn5ir6ifimo5a53y1dwa","schema":1,"type":"view","title":"Board view","fields":{"cardOrder":["crsyw7tbr3pnjznok6ppngmmyya","c5titiemp4pgaxbs4jksgybbj4y"],"collapsedOptionIds":[],"columnCalculations":{},"columnWidths":{},"defaultTemplateId":"","filter":{"filters":[],"operation":"and"},"hiddenOptionIds":[],"kanbanCalculations":{},"sortOptions":[],"viewType":"board","visibleOptionIds":[],"visiblePropertyIds":["aohjkzt769rxhtcz1o9xcoce5to"]},"createAt":1672750481626,"updateAt":1672750481626,"deleteAt":0,"boardId":"bfoi6yy6pa3yzika53spj7pq9ee"}}
{"type":"boardMember","data":{"boardId":"bfoi6yy6pa3yzika53spj7pq9ee","userId":"f1tydgc697fcbp8ampr6881jea","roles":"","minimumRole":"","schemeAdmin":false,"schemeEditor":false,"schemeCommenter":false,"schemeViewer":true,"synthetic":false}}
{"type":"boardMember","data":{"boardId":"bfoi6yy6pa3yzika53spj7pq9ee","userId":"hxxzooc3ff8cubsgtcmpn8733e","roles":"","minimumRole":"","schemeAdmin":false,"schemeEditor":false,"schemeCommenter":false,"schemeViewer":true,"synthetic":false}}
{"type":"boardMember","data":{"boardId":"bfoi6yy6pa3yzika53spj7pq9ee","userId":"nto73edn5ir6ifimo5a53y1dwa","roles":"","minimumRole":"","schemeAdmin":true,"schemeEditor":false,"schemeCommenter":false,"schemeViewer":false,"synthetic":false}}
`
