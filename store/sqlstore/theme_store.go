// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SqlThemeStore struct {
	SqlStore
}

func NewSqlThemeStore(sqlStore SqlStore) store.ThemeStore {
	s := &SqlThemeStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.Theme{}, "Themes").SetKeys(false, "Id")
		table.ColMap("Id").SetMaxSize(26)
		table.ColMap("DisplayName").SetMaxSize(64)
		table.ColMap("SidebarBackground").SetMaxSize(8)
		table.ColMap("SidebarText").SetMaxSize(8)
		table.ColMap("SidebarUnreadText").SetMaxSize(8)
		table.ColMap("SidebarTextHoverBackground").SetMaxSize(8)
		table.ColMap("SidebarTextActiveBorder").SetMaxSize(8)
		table.ColMap("SidebarTextActiveColor").SetMaxSize(8)
		table.ColMap("SidebarHeaderBackground").SetMaxSize(8)
		table.ColMap("SidebarHeaderTextColor").SetMaxSize(8)
		table.ColMap("OnlineIndicator").SetMaxSize(8)
		table.ColMap("AwayIndicator").SetMaxSize(8)
		table.ColMap("DndIndicator").SetMaxSize(8)
		table.ColMap("MentionBackground").SetMaxSize(8)
		table.ColMap("MentionColor").SetMaxSize(8)
		table.ColMap("CenterChannelBackground").SetMaxSize(8)
		table.ColMap("CenterChannelColor").SetMaxSize(8)
		table.ColMap("NewMessageSeparator").SetMaxSize(8)
		table.ColMap("LinkColor").SetMaxSize(8)
		table.ColMap("ButtonBackground").SetMaxSize(8)
		table.ColMap("ButtonColor").SetMaxSize(8)
		table.ColMap("ErrorTextColor").SetMaxSize(8)
		table.ColMap("MentionHighlightBackground").SetMaxSize(8)
		table.ColMap("MentionHighlightLink").SetMaxSize(8)
		table.ColMap("CodeTheme").SetMaxSize(64)
	}

	return s
}

// TODO add localization strings

func (s SqlThemeStore) CreateIndexesIfNotExists() {
}

func (s SqlThemeStore) Save(theme *model.Theme) (*model.Theme, *model.AppError) {
	theme.PreSave()

	insertErr := s.GetMaster().Insert(theme)
	if insertErr != nil {
		if !IsUniqueConstraintError(insertErr, []string{"Id", "themes_pkey", "PRIMARY"}) {
			return nil, model.NewAppError("SqlThemeStore.Save", "store.sql_theme.save.app_error", nil, insertErr.Error(), http.StatusInternalServerError)
		}

		_, updateErr := s.GetMaster().Update(theme)
		if updateErr != nil {
			return nil, model.NewAppError("SqlThemeStore.Save", "store.sql_theme.save.app_error", nil, insertErr.Error(), http.StatusInternalServerError)
		}
	}

	return theme, nil
}

func (s SqlThemeStore) Get(id string) (*model.Theme, *model.AppError) {
	var theme *model.Theme

	err := s.GetReplica().SelectOne(&theme,
		`SELECT
			*
		FROM
			Themes
		WHERE
			Id = :Id`, map[string]interface{}{"Id": id})
	if err != nil {
		return nil, model.NewAppError("SqlThemeStore.Get", "store.sql_theme.get.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return theme, nil
}

func (s SqlThemeStore) GetAll() ([]*model.Theme, *model.AppError) {
	var themes []*model.Theme
	_, err := s.GetReplica().Select(
		&themes,
		`SELECT
			*
		FROM
			Themes`)
	if err != nil {
		return nil, model.NewAppError("SqlThemeStore.GetAll", "store.sql_theme.get_all.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return themes, nil
}

func (s SqlThemeStore) Delete(id string) *model.AppError {
	result, err := s.GetMaster().Exec(`DELETE FROM Themes WHERE ID = :Id`, map[string]interface{}{"Id": id})
	if err != nil {
		return model.NewAppError("SqlThemeStore.Delete", "store.sql_theme.delete.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	count, _ := result.RowsAffected()
	if count == 0 {
		return model.NewAppError("SqlThemeStore.Delete", "store.sql_theme.delete.not_found", nil, err.Error(), http.StatusNotFound)
	}

	return nil
}
