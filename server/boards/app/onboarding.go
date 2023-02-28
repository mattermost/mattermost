package app

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/boards/model"
)

const (
	KeyOnboardingTourStarted  = "onboardingTourStarted"
	KeyOnboardingTourCategory = "tourCategory"
	KeyOnboardingTourStep     = "onboardingTourStep"

	ValueOnboardingFirstStep    = "0"
	ValueTourCategoryOnboarding = "onboarding"

	WelcomeBoardTitle = "Welcome to Boards!"
)

var (
	errUnableToFindWelcomeBoard = errors.New("unable to find welcome board in newly created blocks")
	errCannotCreateBoard        = errors.New("new board wasn't created")
)

func (a *App) PrepareOnboardingTour(userID string, teamID string) (string, string, error) {
	// copy the welcome board into this workspace
	boardID, err := a.createWelcomeBoard(userID, teamID)
	if err != nil {
		return "", "", err
	}

	// set user's tour state to initial state
	userPreferencesPatch := model.UserPreferencesPatch{
		UpdatedFields: map[string]string{
			KeyOnboardingTourStarted:  "1",
			KeyOnboardingTourStep:     ValueOnboardingFirstStep,
			KeyOnboardingTourCategory: ValueTourCategoryOnboarding,
		},
	}
	if _, err := a.store.PatchUserPreferences(userID, userPreferencesPatch); err != nil {
		return "", "", err
	}

	return teamID, boardID, nil
}

func (a *App) getOnboardingBoardID() (string, error) {
	boards, err := a.store.GetTemplateBoards(model.GlobalTeamID, "")
	if err != nil {
		return "", err
	}

	var onboardingBoardID string
	for _, block := range boards {
		if block.Title == WelcomeBoardTitle && block.TeamID == model.GlobalTeamID {
			onboardingBoardID = block.ID
			break
		}
	}

	if onboardingBoardID == "" {
		return "", errUnableToFindWelcomeBoard
	}

	return onboardingBoardID, nil
}

func (a *App) createWelcomeBoard(userID, teamID string) (string, error) {
	onboardingBoardID, err := a.getOnboardingBoardID()
	if err != nil {
		return "", err
	}

	bab, _, err := a.DuplicateBoard(onboardingBoardID, userID, teamID, false)
	if err != nil {
		return "", err
	}

	if len(bab.Boards) != 1 {
		return "", errCannotCreateBoard
	}

	// need variable for this to
	// get reference for board patch
	newType := model.BoardTypePrivate

	patch := &model.BoardPatch{
		Type: &newType,
	}

	if _, err := a.PatchBoard(patch, bab.Boards[0].ID, userID); err != nil {
		return "", err
	}

	return bab.Boards[0].ID, nil
}
