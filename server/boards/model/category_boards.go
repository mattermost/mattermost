package model

const CategoryBoardsSortOrderGap = 10

// CategoryBoards is a board category and associated boards
// swagger:model
type CategoryBoards struct {
	Category

	// The IDs of boards in this category
	// required: true
	BoardMetadata []CategoryBoardMetadata `json:"boardMetadata"`

	// The relative sort order of this board in its category
	// required: true
	SortOrder int `json:"sortOrder"`
}

type BoardCategoryWebsocketData struct {
	BoardID    string `json:"boardID"`
	CategoryID string `json:"categoryID"`
	Hidden     bool   `json:"hidden"`
}

type CategoryBoardMetadata struct {
	BoardID string `json:"boardID"`
	Hidden  bool   `json:"hidden"`
}
