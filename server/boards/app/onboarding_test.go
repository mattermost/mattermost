package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

const (
	testTeamID = "team_id"
)

func TestPrepareOnboardingTour(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		teamID := testTeamID
		userID := "user_id_1"
		welcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Welcome to Boards!",
			TeamID:     "0",
			IsTemplate: true,
		}

		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{&welcomeBoard}, nil)
		th.Store.EXPECT().DuplicateBoard(welcomeBoard.ID, userID, teamID, false).Return(&model.BoardsAndBlocks{Boards: []*model.Board{
			{
				ID:         "board_id_2",
				Title:      "Welcome to Boards!",
				TeamID:     "0",
				IsTemplate: true,
			},
		}},
			nil, nil)
		th.Store.EXPECT().GetMembersForBoard(welcomeBoard.ID).Return([]*model.BoardMember{}, nil).Times(2)
		th.Store.EXPECT().GetMembersForBoard("board_id_2").Return([]*model.BoardMember{}, nil).Times(1)
		th.Store.EXPECT().GetBoard(welcomeBoard.ID).Return(&welcomeBoard, nil).Times(2)
		th.Store.EXPECT().GetBoard("board_id_2").Return(&welcomeBoard, nil).Times(1)
		th.Store.EXPECT().GetUsersByTeam("0", "", false, false).Return([]*model.User{}, nil)

		privateWelcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Welcome to Boards!",
			TeamID:     "0",
			IsTemplate: true,
			Type:       model.BoardTypePrivate,
		}
		newType := model.BoardTypePrivate
		th.Store.EXPECT().PatchBoard("board_id_2", &model.BoardPatch{Type: &newType}, "user_id_1").Return(&privateWelcomeBoard, nil)
		th.Store.EXPECT().GetMembersForUser("user_id_1").Return([]*model.BoardMember{}, nil)

		userPreferencesPatch := model.UserPreferencesPatch{
			UpdatedFields: map[string]string{
				KeyOnboardingTourStarted:  "1",
				KeyOnboardingTourStep:     ValueOnboardingFirstStep,
				KeyOnboardingTourCategory: ValueTourCategoryOnboarding,
			},
		}

		th.Store.EXPECT().PatchUserPreferences(userID, userPreferencesPatch).Return(nil, nil)
		th.Store.EXPECT().GetUserCategoryBoards(userID, "team_id").Return([]model.CategoryBoards{}, nil).Times(1)

		// when this is called the second time, the default category is created so we need to include that in the response list
		th.Store.EXPECT().GetUserCategoryBoards(userID, "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "boards_category_id", Name: "Boards"},
			},
		}, nil).Times(2)

		th.Store.EXPECT().CreateCategory(utils.Anything).Return(nil).Times(1)
		th.Store.EXPECT().GetCategory(utils.Anything).Return(&model.Category{
			ID:   "boards_category",
			Name: "Boards",
		}, nil)
		th.Store.EXPECT().GetBoardsForUserAndTeam("user_id_1", teamID, false).Return([]*model.Board{}, nil)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id_1", "boards_category_id", []string{"board_id_2"}).Return(nil)

		teamID, boardID, err := th.App.PrepareOnboardingTour(userID, teamID)
		assert.NoError(t, err)
		assert.Equal(t, testTeamID, teamID)
		assert.NotEmpty(t, boardID)
	})
}

func TestCreateWelcomeBoard(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		teamID := testTeamID
		userID := "user_id_1"
		welcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Welcome to Boards!",
			TeamID:     "0",
			IsTemplate: true,
		}
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{&welcomeBoard}, nil)
		th.Store.EXPECT().DuplicateBoard(welcomeBoard.ID, userID, teamID, false).
			Return(&model.BoardsAndBlocks{Boards: []*model.Board{&welcomeBoard}}, nil, nil)
		th.Store.EXPECT().GetMembersForBoard(welcomeBoard.ID).Return([]*model.BoardMember{}, nil).Times(3)
		th.Store.EXPECT().GetBoard(welcomeBoard.ID).Return(&welcomeBoard, nil).AnyTimes()
		th.Store.EXPECT().GetUsersByTeam("0", "", false, false).Return([]*model.User{}, nil)

		privateWelcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Welcome to Boards!",
			TeamID:     "0",
			IsTemplate: true,
			Type:       model.BoardTypePrivate,
		}
		newType := model.BoardTypePrivate
		th.Store.EXPECT().PatchBoard("board_id_1", &model.BoardPatch{Type: &newType}, "user_id_1").Return(&privateWelcomeBoard, nil)
		th.Store.EXPECT().GetUserCategoryBoards(userID, "team_id").Return([]model.CategoryBoards{
			{
				Category: model.Category{ID: "boards_category_id", Name: "Boards"},
			},
		}, nil).Times(3)
		th.Store.EXPECT().AddUpdateCategoryBoard("user_id_1", "boards_category_id", []string{"board_id_1"}).Return(nil)

		boardID, err := th.App.createWelcomeBoard(userID, teamID)
		assert.Nil(t, err)
		assert.NotEmpty(t, boardID)
	})

	t.Run("template doesn't contain a board", func(t *testing.T) {
		teamID := testTeamID
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{}, nil)
		boardID, err := th.App.createWelcomeBoard("user_id_1", teamID)
		assert.Error(t, err)
		assert.Empty(t, boardID)
	})

	t.Run("template doesn't contain the welcome board", func(t *testing.T) {
		teamID := testTeamID
		welcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Other template",
			TeamID:     teamID,
			IsTemplate: true,
		}
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{&welcomeBoard}, nil)
		boardID, err := th.App.createWelcomeBoard("user_id_1", "workspace_id_1")
		assert.Error(t, err)
		assert.Empty(t, boardID)
	})
}

func TestGetOnboardingBoardID(t *testing.T) {
	th, tearDown := SetupTestHelper(t)
	defer tearDown()

	t.Run("base case", func(t *testing.T) {
		welcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Welcome to Boards!",
			TeamID:     "0",
			IsTemplate: true,
		}
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{&welcomeBoard}, nil)

		onboardingBoardID, err := th.App.getOnboardingBoardID()
		assert.NoError(t, err)
		assert.Equal(t, "board_id_1", onboardingBoardID)
	})

	t.Run("no blocks found", func(t *testing.T) {
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{}, nil)

		onboardingBoardID, err := th.App.getOnboardingBoardID()
		assert.Error(t, err)
		assert.Empty(t, onboardingBoardID)
	})

	t.Run("onboarding board doesn't exists", func(t *testing.T) {
		welcomeBoard := model.Board{
			ID:         "board_id_1",
			Title:      "Other template",
			TeamID:     "0",
			IsTemplate: true,
		}
		th.Store.EXPECT().GetTemplateBoards("0", "").Return([]*model.Board{&welcomeBoard}, nil)

		onboardingBoardID, err := th.App.getOnboardingBoardID()
		assert.Error(t, err)
		assert.Empty(t, onboardingBoardID)
	})
}
