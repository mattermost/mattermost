package sqlstore

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
)

// playbookStore is a sql store for playbooks. Use NewPlaybookStore to create it.
type categoryStore struct {
	pluginAPI          PluginAPIClient
	store              *SQLStore
	queryBuilder       sq.StatementBuilderType
	categorySelect     sq.SelectBuilder
	categoryItemSelect sq.SelectBuilder
}

// Ensure playbookStore implements the playbook.Store interface.
var _ app.CategoryStore = (*categoryStore)(nil)

func NewCategoryStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.CategoryStore {
	categorySelect := sqlStore.builder.
		Select(
			"c.ID",
			"c.Name",
			"c.TeamID",
			"c.UserID",
			"c.Collapsed",
			"c.CreateAt",
			"c.UpdateAt",
			"c.DeleteAt",
		).
		From("IR_Category c")

	categoryItemSelect := sqlStore.builder.
		Select(
			"ci.ItemID",
			"ci.Type",
		).
		From("IR_Category_Item ci")

	return &categoryStore{
		pluginAPI:          pluginAPI,
		store:              sqlStore,
		queryBuilder:       sqlStore.builder,
		categorySelect:     categorySelect,
		categoryItemSelect: categoryItemSelect,
	}
}

// Get retrieves a Category. Returns ErrNotFound if not found.
func (c *categoryStore) Get(id string) (app.Category, error) {
	if !model.IsValidId(id) {
		return app.Category{}, errors.New("ID is not valid")
	}

	var category app.Category
	err := c.store.getBuilder(c.store.db, &category, c.categorySelect.Where(sq.Eq{"c.ID": id}))
	if err == sql.ErrNoRows {
		return app.Category{}, errors.Wrapf(app.ErrNotFound, "category does not exist for id %q", id)
	} else if err != nil {
		return app.Category{}, errors.Wrapf(err, "failed to get category by id %q", id)
	}

	items, err := c.getItems(id)
	if err != nil {
		return app.Category{}, errors.Wrapf(err, "failed to get category items by id %q", id)
	}
	category.Items = items
	return category, nil
}

func (c *categoryStore) getItems(id string) ([]app.CategoryItem, error) {
	var items []app.CategoryItem
	var playbookItems []app.CategoryItem
	queryPlaybooks := c.queryBuilder.
		Select(
			"ci.ItemID",
			"ci.Type",
			"COALESCE(p.title, '') AS Name",
			"COALESCE(p.public, false) AS Public",
		).
		From("IR_Category_Item ci").
		LeftJoin("IR_Playbook as p on ci.ItemID=p.id").
		Where(sq.And{sq.Eq{"ci.CategoryID": id}, sq.Eq{"ci.Type": "p"}})
	err := c.store.selectBuilder(c.store.db, &playbookItems, queryPlaybooks)
	if err == sql.ErrNoRows {
		items = []app.CategoryItem{}
	} else if err != nil {
		return []app.CategoryItem{}, err
	} else {
		items = playbookItems
	}

	var runItems []app.CategoryItem
	queryRuns := c.queryBuilder.
		Select(
			"ci.ItemID",
			"ci.Type",
			"COALESCE(r.name, '') AS Name",
		).
		From("IR_Category_Item ci").
		LeftJoin("IR_Incident as r on ci.ItemID=r.id").
		Where(sq.And{sq.Eq{"ci.CategoryID": id}, sq.Eq{"ci.Type": "r"}})
	err = c.store.selectBuilder(c.store.db, &runItems, queryRuns)
	if err == sql.ErrNoRows {
		return items, nil
	} else if err != nil {
		return []app.CategoryItem{}, err
	}
	items = append(items, runItems...)
	return items, nil
}

// Create creates a new Category
func (c *categoryStore) Create(category app.Category) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Insert("IR_Category").
		SetMap(map[string]interface{}{
			"ID":        category.ID,
			"Name":      category.Name,
			"TeamID":    category.TeamID,
			"UserID":    category.UserID,
			"Collapsed": category.Collapsed,
			"CreateAt":  category.CreateAt,
			"UpdateAt":  category.UpdateAt,
		})); err != nil {
		return errors.Wrap(err, "failed to store new category")
	}

	return nil
}

// GetCategories retrieves all categories for user for team
func (c *categoryStore) GetCategories(teamID, userID string) ([]app.Category, error) {
	query := c.categorySelect.Where(sq.And{sq.Eq{"c.TeamID": teamID}, sq.Eq{"c.UserID": userID}})

	categories := []app.Category{}
	err := c.store.selectBuilder(c.store.db, &categories, query)
	if err == sql.ErrNoRows {
		return nil, errors.Wrapf(app.ErrNotFound, "no category for team id %q and user id %q", teamID, userID)
	} else if err != nil {
		return nil, errors.Wrapf(err, "failed to get categories for team id %q and user id %q", teamID, userID)
	}
	for i, category := range categories {
		items, err := c.getItems(category.ID)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to get category items for category id %q", category.ID)
		}
		categories[i].Items = items
	}
	return categories, nil
}

// Update updates a category
func (c *categoryStore) Update(category app.Category) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Category").
		Set("Name", category.Name).
		Set("UpdateAt", category.UpdateAt).
		Set("Collapsed", category.Collapsed).
		Where(sq.Eq{"ID": category.ID})); err != nil {
		return errors.Wrapf(err, "failed to update category with id '%s'", category.ID)
	}
	return nil
}

// Delete deletes a category
func (c *categoryStore) Delete(categoryID string) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Update("IR_Category").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{"ID": categoryID})); err != nil {
		return errors.Wrapf(err, "failed to delete category with id '%s'", categoryID)
	}
	return nil
}

// GetFavoriteCategory returns favorite category
func (c *categoryStore) GetFavoriteCategory(teamID, userID string) (app.Category, error) {
	var category app.Category
	err := c.store.getBuilder(c.store.db, &category, c.categorySelect.Where(sq.Eq{
		"c.Name":   "Favorite",
		"c.TeamID": teamID,
		"c.UserID": userID,
	}))
	if err == sql.ErrNoRows {
		return app.Category{}, err
	}
	category.Items, err = c.getItems(category.ID)
	if err != nil {
		return app.Category{}, errors.Wrap(err, "failed to get Items for category")
	}
	return category, nil
}

// createFavoriteCategory creates and returns favorite category
func (c *categoryStore) createFavoriteCategory(teamID, userID string) (app.Category, error) {
	now := model.GetMillis()
	favCat := app.Category{
		ID:        model.NewId(),
		Name:      "Favorite",
		TeamID:    teamID,
		UserID:    userID,
		Collapsed: false,
		CreateAt:  now,
		UpdateAt:  now,
		Items:     []app.CategoryItem{},
	}
	if err := c.Create(favCat); err != nil {
		return app.Category{}, errors.Wrap(err, "can't create favorite category")
	}
	return favCat, nil
}

// AddItemToFavoriteCategory adds an item to favorite category,
// if favorite category does not exist it creates one
func (c *categoryStore) AddItemToFavoriteCategory(item app.CategoryItem, teamID, userID string) error {
	favoriteCategory, err := c.GetFavoriteCategory(teamID, userID)
	if err == sql.ErrNoRows {
		// No favorite category, we should create one
		if favoriteCategory, err = c.createFavoriteCategory(teamID, userID); err != nil {
			return err
		}
	} else if err != nil {
		return errors.Wrap(err, "can't get favorite category")
	}
	for _, favItem := range favoriteCategory.Items {
		if favItem.ItemID == item.ItemID && favItem.Type == item.Type {
			return errors.New("Item already is favorite")
		}
	}
	if err := c.AddItemToCategory(item, favoriteCategory.ID); err != nil {
		return errors.Wrap(err, "can't add item to favorite category")
	}
	return nil
}

// AddItemToCategory adds an item to category
func (c *categoryStore) AddItemToCategory(item app.CategoryItem, categoryID string) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Insert("IR_Category_Item").
		SetMap(map[string]interface{}{
			"CategoryID": categoryID,
			"ItemID":     item.ItemID,
			"Type":       item.Type,
		})); err != nil {
		return errors.Wrap(err, "failed to store item in category")
	}
	return nil
}

// DeleteItemFromCategory deletes an item from category
func (c *categoryStore) DeleteItemFromCategory(item app.CategoryItem, categoryID string) error {
	if _, err := c.store.execBuilder(c.store.db, sq.
		Delete("IR_Category_Item").
		Where(sq.Eq{
			"CategoryID": categoryID,
			"ItemID":     item.ItemID,
			"Type":       item.Type,
		})); err != nil {
		return errors.Wrapf(err, "failed to delete category with item id '%s'", item.ItemID)
	}
	return nil
}
