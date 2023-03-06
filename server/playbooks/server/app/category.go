package app

import (
	"errors"
	"strings"
)

type CategoryItemType string

const (
	PlaybookItemType CategoryItemType = "p"
	RunItemType      CategoryItemType = "r"
)

func StringToItemType(item string) (CategoryItemType, error) {
	var convertedItem CategoryItemType
	if item == string(PlaybookItemType) {
		convertedItem = PlaybookItemType
	} else if item == string(RunItemType) {
		convertedItem = RunItemType
	} else {
		return PlaybookItemType, errors.New("unknown item type")
	}
	return convertedItem, nil
}

type CategoryItem struct {
	ItemID string           `json:"item_id"`
	Type   CategoryItemType `json:"type"`
	Name   string           `json:"name"`
	Public bool             `json:"public"`
}

// Category represents sidebar category with items
type Category struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	TeamID    string         `json:"team_id"`
	UserID    string         `json:"user_id"`
	Collapsed bool           `json:"collapsed"`
	CreateAt  int64          `json:"create_at"`
	UpdateAt  int64          `json:"update_at"`
	DeleteAt  int64          `json:"delete_at"`
	Items     []CategoryItem `json:"items"`
}

func (c *Category) IsValid() error {
	if strings.TrimSpace(c.ID) == "" {
		return errors.New("category ID cannot be empty")
	}

	if strings.TrimSpace(c.Name) == "" {
		return errors.New("category name cannot be empty")
	}

	if strings.TrimSpace(c.UserID) == "" {
		return errors.New("category user ID cannot be empty")
	}

	if strings.TrimSpace(c.TeamID) == "" {
		return errors.New("category team id ID cannot be empty")
	}

	for _, item := range c.Items {
		if item.ItemID == "" {
			return errors.New("item ID cannot be empty")
		}
		if item.Type != PlaybookItemType && item.Type != RunItemType {
			return errors.New("item type is incorrect")
		}
	}

	return nil
}

func (c *Category) ContainsItem(item CategoryItem) bool {
	for _, catItem := range c.Items {
		if catItem.ItemID == item.ItemID && catItem.Type == item.Type {
			return true
		}
	}
	return false
}

// CategoryService is the category service for managing categories
type CategoryService interface {
	// Create creates a new Category
	Create(category Category) (string, error)

	// Get retrieves category with categoryID for user for team
	Get(categoryID string) (Category, error)

	// GetCategories retrieves all categories for user for team
	GetCategories(teamID, userID string) ([]Category, error)

	// Update updates a category
	Update(category Category) error

	// Delete deletes a category
	Delete(categoryID string) error

	// AddFavorite favorites an item, which may be either run or playbook
	AddFavorite(item CategoryItem, teamID, userID string) error

	// DeleteFavorite unfavorites an item, which may be either run or playbook
	DeleteFavorite(item CategoryItem, teamID, userID string) error

	// IsItemFavorite returns whether item was favorited or not
	IsItemFavorite(item CategoryItem, teamID, userID string) (bool, error)

	AreItemsFavorites(items []CategoryItem, teamID, userID string) ([]bool, error)
}

type CategoryStore interface {
	// Get retrieves a Category. Returns ErrNotFound if not found.
	Get(id string) (Category, error)

	// Create creates a new Category
	Create(category Category) error

	// GetCategories retrieves all categories for user for team
	GetCategories(teamID, userID string) ([]Category, error)

	// Update updates a category
	Update(category Category) error

	// Delete deletes a category
	Delete(categoryID string) error

	// GetFavoriteCategory returns favorite category
	GetFavoriteCategory(teamID, userID string) (Category, error)

	// AddItemToFavoriteCategory adds an item to favorite category,
	// if favorite category does not exist it creates one
	AddItemToFavoriteCategory(item CategoryItem, teamID, userID string) error

	// AddItemToCategory adds an item to category
	AddItemToCategory(item CategoryItem, categoryID string) error

	// DeleteItemFromCategory adds an item to category
	DeleteItemFromCategory(item CategoryItem, categoryID string) error
}

type CategoryTelemetry interface {
	// FavoriteItem tracks run favoriting of an item. Item can be run or a playbook
	FavoriteItem(item CategoryItem, userID string)

	// UnfavoriteItem tracks run unfavoriting of an item. Item can be run or a playbook
	UnfavoriteItem(item CategoryItem, userID string)
}
