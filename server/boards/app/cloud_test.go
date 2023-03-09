// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/require"

	mm_model "github.com/mattermost/mattermost-server/v6/model"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
	mockservicesapi "github.com/mattermost/mattermost-server/v6/server/boards/model/mocks"
)

func TestIsCloud(t *testing.T) {
	t.Run("if it's not running on plugin mode", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.Store.EXPECT().GetLicense().Return(nil)
		require.False(t, th.App.IsCloud())
	})

	t.Run("if it's running on plugin mode but the license is incomplete", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		fakeLicense := &mm_model.License{}

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		require.False(t, th.App.IsCloud())

		fakeLicense = &mm_model.License{Features: &mm_model.Features{}}

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		require.False(t, th.App.IsCloud())
	})

	t.Run("if it's running on plugin mode, with a non-cloud license", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		fakeLicense := &mm_model.License{
			Features: &mm_model.Features{Cloud: mm_model.NewBool(false)},
		}

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		require.False(t, th.App.IsCloud())
	})

	t.Run("if it's running on plugin mode with a cloud license", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		fakeLicense := &mm_model.License{
			Features: &mm_model.Features{Cloud: mm_model.NewBool(true)},
		}

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		require.True(t, th.App.IsCloud())
	})
}

func TestIsCloudLimited(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	t.Run("if no limit has been set, it should be false", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		require.Zero(t, th.App.CardLimit())
		require.False(t, th.App.IsCloudLimited())
	})

	t.Run("if the limit is set, it should be true", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		fakeLicense := &mm_model.License{
			Features: &mm_model.Features{Cloud: mm_model.NewBool(true)},
		}
		th.Store.EXPECT().GetLicense().Return(fakeLicense)

		th.App.SetCardLimit(5)
		require.True(t, th.App.IsCloudLimited())
	})
}

func TestSetCloudLimits(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	t.Run("if the limits are empty, it should do nothing", func(t *testing.T) {
		t.Run("limits empty", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t)
			defer tearDown()

			require.Zero(t, th.App.CardLimit())

			require.NoError(t, th.App.SetCloudLimits(nil))
			require.Zero(t, th.App.CardLimit())
		})

		t.Run("limits not empty but board limits empty", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t)
			defer tearDown()

			require.Zero(t, th.App.CardLimit())

			limits := &mm_model.ProductLimits{}

			require.NoError(t, th.App.SetCloudLimits(limits))
			require.Zero(t, th.App.CardLimit())
		})

		t.Run("limits not empty but board limits values empty", func(t *testing.T) {
			th, tearDown := SetupTestHelper(t)
			defer tearDown()

			require.Zero(t, th.App.CardLimit())

			limits := &mm_model.ProductLimits{
				Boards: &mm_model.BoardsLimits{},
			}

			require.NoError(t, th.App.SetCloudLimits(limits))
			require.Zero(t, th.App.CardLimit())
		})
	})

	t.Run("if the limits are not empty, it should update them and calculate the new timestamp", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		require.Zero(t, th.App.CardLimit())

		newCardLimitTimestamp := int64(27)
		th.Store.EXPECT().UpdateCardLimitTimestamp(5).Return(newCardLimitTimestamp, nil)

		limits := &mm_model.ProductLimits{
			Boards: &mm_model.BoardsLimits{Cards: mm_model.NewInt(5)},
		}

		require.NoError(t, th.App.SetCloudLimits(limits))
		require.Equal(t, 5, th.App.CardLimit())
	})

	t.Run("if the limits are already set and we unset them, the timestamp will be unset too", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.App.SetCardLimit(20)

		th.Store.EXPECT().UpdateCardLimitTimestamp(0)

		require.NoError(t, th.App.SetCloudLimits(nil))

		require.Zero(t, th.App.CardLimit())
	})

	t.Run("if the limits are already set and we try to set the same ones again", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.App.SetCardLimit(20)

		// the call to update card limit timestamp should not happen
		// as the limits didn't change
		th.Store.EXPECT().UpdateCardLimitTimestamp(gomock.Any()).Times(0)

		limits := &mm_model.ProductLimits{
			Boards: &mm_model.BoardsLimits{Cards: mm_model.NewInt(20)},
		}

		require.NoError(t, th.App.SetCloudLimits(limits))
		require.Equal(t, 20, th.App.CardLimit())
	})
}

func TestUpdateCardLimitTimestamp(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	fakeLicense := &mm_model.License{
		Features: &mm_model.Features{Cloud: mm_model.NewBool(true)},
	}

	t.Run("if the server is a cloud instance but not limited, it should do nothing", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		require.Zero(t, th.App.CardLimit())

		// the license check will not be done as the limit not being
		// set is enough for the method to return
		th.Store.EXPECT().GetLicense().Times(0)
		// no call to UpdateCardLimitTimestamp should happen as the
		// method should shortcircuit if not cloud limited
		th.Store.EXPECT().UpdateCardLimitTimestamp(gomock.Any()).Times(0)

		require.NoError(t, th.App.UpdateCardLimitTimestamp())
	})

	t.Run("if the server is a cloud instance and the timestamp is set, it should run the update", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.App.SetCardLimit(5)

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		// no call to UpdateCardLimitTimestamp should happen as the
		// method should shortcircuit if not cloud limited
		th.Store.EXPECT().UpdateCardLimitTimestamp(5)

		require.NoError(t, th.App.UpdateCardLimitTimestamp())
	})
}

func TestGetTemplateMapForBlocks(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	t.Run("should fetch the necessary boards from the database", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		board1 := &model.Board{
			ID:         "board1",
			Type:       model.BoardTypeOpen,
			IsTemplate: true,
		}

		board2 := &model.Board{
			ID:         "board2",
			Type:       model.BoardTypeOpen,
			IsTemplate: false,
		}

		blocks := []*model.Block{
			{
				ID:       "card1",
				Type:     model.TypeCard,
				ParentID: "board1",
				BoardID:  "board1",
			},
			{
				ID:       "card2",
				Type:     model.TypeCard,
				ParentID: "board2",
				BoardID:  "board2",
			},
			{
				ID:       "text2",
				Type:     model.TypeText,
				ParentID: "card2",
				BoardID:  "board2",
			},
		}

		th.Store.EXPECT().
			GetBoard("board1").
			Return(board1, nil).
			Times(1)
		th.Store.EXPECT().
			GetBoard("board2").
			Return(board2, nil).
			Times(1)

		templateMap, err := th.App.getTemplateMapForBlocks(blocks)
		require.NoError(t, err)
		require.Len(t, templateMap, 2)
		require.Contains(t, templateMap, "board1")
		require.True(t, templateMap["board1"])
		require.Contains(t, templateMap, "board2")
		require.False(t, templateMap["board2"])
	})

	t.Run("should fail if the board is not in the database", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "card1",
				Type:     model.TypeCard,
				ParentID: "board1",
				BoardID:  "board1",
			},
			{
				ID:       "card2",
				Type:     model.TypeCard,
				ParentID: "board2",
				BoardID:  "board2",
			},
		}

		th.Store.EXPECT().
			GetBoard("board1").
			Return(nil, sql.ErrNoRows).
			Times(1)

		templateMap, err := th.App.getTemplateMapForBlocks(blocks)
		require.ErrorIs(t, err, sql.ErrNoRows)
		require.Empty(t, templateMap)
	})
}

func TestApplyCloudLimits(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	fakeLicense := &mm_model.License{
		Features: &mm_model.Features{Cloud: mm_model.NewBool(true)},
	}

	board1 := &model.Board{
		ID:         "board1",
		Type:       model.BoardTypeOpen,
		IsTemplate: false,
	}

	template := &model.Board{
		ID:         "template",
		Type:       model.BoardTypeOpen,
		IsTemplate: true,
	}

	blocks := []*model.Block{
		{
			ID:       "card1",
			Type:     model.TypeCard,
			ParentID: "board1",
			BoardID:  "board1",
			UpdateAt: 100,
		},
		{
			ID:       "text1",
			Type:     model.TypeText,
			ParentID: "card1",
			BoardID:  "board1",
			UpdateAt: 100,
		},
		{
			ID:       "card2",
			Type:     model.TypeCard,
			ParentID: "board1",
			BoardID:  "board1",
			UpdateAt: 200,
		},
		{
			ID:       "card-from-template",
			Type:     model.TypeCard,
			ParentID: "template",
			BoardID:  "template",
			UpdateAt: 1,
		},
	}

	t.Run("if the server is not limited, it should return the blocks untouched", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		require.Zero(t, th.App.CardLimit())

		newBlocks, err := th.App.ApplyCloudLimits(blocks)
		require.NoError(t, err)
		require.ElementsMatch(t, blocks, newBlocks)
	})

	t.Run("if the server is limited, it should limit the blocks that are beyond the card limit timestamp", func(t *testing.T) {
		findBlock := func(blocks []*model.Block, id string) *model.Block {
			for _, block := range blocks {
				if block.ID == id {
					return block
				}
			}
			require.FailNow(t, "block %s not found", id)
			return &model.Block{} // this should never be reached
		}

		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		th.App.SetCardLimit(5)

		th.Store.EXPECT().GetLicense().Return(fakeLicense)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(int64(150), nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil).Times(1)
		th.Store.EXPECT().GetBoard("template").Return(template, nil).Times(1)

		newBlocks, err := th.App.ApplyCloudLimits(blocks)
		require.NoError(t, err)

		// should be limited as it's beyond the threshold
		require.True(t, findBlock(newBlocks, "card1").Limited)
		// only cards are limited
		require.False(t, findBlock(newBlocks, "text1").Limited)
		// should not be limited as it's not beyond the threshold
		require.False(t, findBlock(newBlocks, "card2").Limited)
		// cards belonging to templates are never limited
		require.False(t, findBlock(newBlocks, "card-from-template").Limited)
	})
}

func TestContainsLimitedBlocks(t *testing.T) {
	t.Skipf("The Cloud Limits feature has been disabled")

	// for all the following tests, the timestamp will be set to 150,
	// which means that blocks with an UpdateAt set to 100 will be
	// outside the active window and possibly limited, and blocks with
	// UpdateAt set to 200 will not

	t.Run("should return false if the card limit timestamp is zero", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "card1",
				Type:     model.TypeCard,
				ParentID: "board1",
				BoardID:  "board1",
				UpdateAt: 100,
			},
		}

		th.Store.EXPECT().GetCardLimitTimestamp().Return(int64(0), nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.False(t, containsLimitedBlocks)
	})

	t.Run("should return true if the block set contains a card that is limited", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "card1",
				Type:     model.TypeCard,
				ParentID: "board1",
				BoardID:  "board1",
				UpdateAt: 100,
			},
		}

		board1 := &model.Board{
			ID:   "board1",
			Type: model.BoardTypePrivate,
		}

		th.App.SetCardLimit(500)
		cardLimitTimestamp := int64(150)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(cardLimitTimestamp, nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.True(t, containsLimitedBlocks)
	})

	t.Run("should return false if that same block belongs to a template", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "card1",
				Type:     model.TypeCard,
				ParentID: "board1",
				BoardID:  "board1",
				UpdateAt: 100,
			},
		}

		board1 := &model.Board{
			ID:         "board1",
			Type:       model.BoardTypeOpen,
			IsTemplate: true,
		}

		th.App.SetCardLimit(500)
		cardLimitTimestamp := int64(150)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(cardLimitTimestamp, nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.False(t, containsLimitedBlocks)
	})

	t.Run("should return true if the block contains a content block that belongs to a card that should be limited", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "text1",
				Type:     model.TypeText,
				ParentID: "card1",
				BoardID:  "board1",
				UpdateAt: 200,
			},
		}

		card1 := &model.Block{
			ID:       "card1",
			Type:     model.TypeCard,
			ParentID: "board1",
			BoardID:  "board1",
			UpdateAt: 100,
		}

		board1 := &model.Board{
			ID:   "board1",
			Type: model.BoardTypeOpen,
		}

		th.App.SetCardLimit(500)
		cardLimitTimestamp := int64(150)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(cardLimitTimestamp, nil)
		th.Store.EXPECT().GetBlocksByIDs([]string{"card1"}).Return([]*model.Block{card1}, nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.True(t, containsLimitedBlocks)
	})

	t.Run("should return false if that same block belongs to a card that is inside the active window", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			{
				ID:       "text1",
				Type:     model.TypeText,
				ParentID: "card1",
				BoardID:  "board1",
				UpdateAt: 200,
			},
		}

		card1 := &model.Block{
			ID:       "card1",
			Type:     model.TypeCard,
			ParentID: "board1",
			BoardID:  "board1",
			UpdateAt: 200,
		}

		board1 := &model.Board{
			ID:   "board1",
			Type: model.BoardTypeOpen,
		}

		th.App.SetCardLimit(500)
		cardLimitTimestamp := int64(150)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(cardLimitTimestamp, nil)
		th.Store.EXPECT().GetBlocksByIDs([]string{"card1"}).Return([]*model.Block{card1}, nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.False(t, containsLimitedBlocks)
	})

	t.Run("should reach to the database to fetch the necessary information only in an efficient way", func(t *testing.T) {
		th, tearDown := SetupTestHelper(t)
		defer tearDown()

		blocks := []*model.Block{
			// a content block that references a card that needs
			// fetching
			{
				ID:       "text1",
				Type:     model.TypeText,
				ParentID: "card1",
				BoardID:  "board1",
				UpdateAt: 100,
			},
			// a board that needs fetching referenced by a card and a content block
			{
				ID:       "card2",
				Type:     model.TypeCard,
				ParentID: "board2",
				BoardID:  "board2",
				// per timestamp should be limited but the board is a
				// template
				UpdateAt: 100,
			},
			{
				ID:       "text2",
				Type:     model.TypeText,
				ParentID: "card2",
				BoardID:  "board2",
				UpdateAt: 200,
			},
			// a content block that references a card and a board,
			// both absent
			{
				ID:       "image3",
				Type:     model.TypeImage,
				ParentID: "card3",
				BoardID:  "board3",
				UpdateAt: 100,
			},
		}

		card1 := &model.Block{
			ID:       "card1",
			Type:     model.TypeCard,
			ParentID: "board1",
			BoardID:  "board1",
			UpdateAt: 200,
		}

		card3 := &model.Block{
			ID:       "card3",
			Type:     model.TypeCard,
			ParentID: "board3",
			BoardID:  "board3",
			UpdateAt: 200,
		}

		board1 := &model.Board{
			ID:   "board1",
			Type: model.BoardTypeOpen,
		}

		board2 := &model.Board{
			ID:         "board2",
			Type:       model.BoardTypeOpen,
			IsTemplate: true,
		}

		board3 := &model.Board{
			ID:   "board3",
			Type: model.BoardTypePrivate,
		}

		th.App.SetCardLimit(500)
		cardLimitTimestamp := int64(150)
		th.Store.EXPECT().GetCardLimitTimestamp().Return(cardLimitTimestamp, nil)
		th.Store.EXPECT().GetBlocksByIDs(gomock.InAnyOrder([]string{"card1", "card3"})).Return([]*model.Block{card1, card3}, nil)
		th.Store.EXPECT().GetBoard("board1").Return(board1, nil)
		th.Store.EXPECT().GetBoard("board2").Return(board2, nil)
		th.Store.EXPECT().GetBoard("board3").Return(board3, nil)

		containsLimitedBlocks, err := th.App.ContainsLimitedBlocks(blocks)
		require.NoError(t, err)
		require.False(t, containsLimitedBlocks)
	})
}

func TestNotifyPortalAdminsUpgradeRequest(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("should send message", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		servicesAPI := mockservicesapi.NewMockServicesAPI(ctrl)

		sysAdmin1 := &mm_model.User{
			Id:       "michael-scott",
			Username: "Michael Scott",
		}

		sysAdmin2 := &mm_model.User{
			Id:       "dwight-schrute",
			Username: "Dwight Schrute",
		}

		getUsersOptionsPage0 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    0,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage0).Return([]*mm_model.User{sysAdmin1, sysAdmin2}, nil)

		getUsersOptionsPage1 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    1,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage1).Return([]*mm_model.User{}, nil)

		th.App.servicesAPI = servicesAPI

		team := &model.Team{
			Title: "Dunder Mifflin",
		}

		th.Store.EXPECT().GetTeam("team-id-1").Return(team, nil)
		th.Store.EXPECT().SendMessage(gomock.Any(), "custom_cloud_upgrade_nudge", gomock.Any()).Return(nil).Times(1)

		err := th.App.NotifyPortalAdminsUpgradeRequest("team-id-1")
		assert.NoError(t, err)
	})

	t.Run("no sys admins found", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		servicesAPI := mockservicesapi.NewMockServicesAPI(ctrl)

		getUsersOptionsPage0 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    0,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage0).Return([]*mm_model.User{}, nil)

		th.App.servicesAPI = servicesAPI

		team := &model.Team{
			Title: "Dunder Mifflin",
		}

		th.Store.EXPECT().GetTeam("team-id-1").Return(team, nil)

		err := th.App.NotifyPortalAdminsUpgradeRequest("team-id-1")
		assert.NoError(t, err)
	})

	t.Run("iterate multiple pages", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		servicesAPI := mockservicesapi.NewMockServicesAPI(ctrl)

		sysAdmin1 := &mm_model.User{
			Id:       "michael-scott",
			Username: "Michael Scott",
		}

		sysAdmin2 := &mm_model.User{
			Id:       "dwight-schrute",
			Username: "Dwight Schrute",
		}

		getUsersOptionsPage0 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    0,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage0).Return([]*mm_model.User{sysAdmin1}, nil)

		getUsersOptionsPage1 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    1,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage1).Return([]*mm_model.User{sysAdmin2}, nil)

		getUsersOptionsPage2 := &mm_model.UserGetOptions{
			Active:  true,
			Role:    mm_model.SystemAdminRoleId,
			PerPage: 50,
			Page:    2,
		}
		servicesAPI.EXPECT().GetUsersFromProfiles(getUsersOptionsPage2).Return([]*mm_model.User{}, nil)

		th.App.servicesAPI = servicesAPI

		team := &model.Team{
			Title: "Dunder Mifflin",
		}

		th.Store.EXPECT().GetTeam("team-id-1").Return(team, nil)
		th.Store.EXPECT().SendMessage(gomock.Any(), "custom_cloud_upgrade_nudge", gomock.Any()).Return(nil).Times(2)

		err := th.App.NotifyPortalAdminsUpgradeRequest("team-id-1")
		assert.NoError(t, err)
	})
}
