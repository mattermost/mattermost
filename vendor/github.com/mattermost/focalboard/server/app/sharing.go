package app

import (
	"database/sql"
	"errors"

	"github.com/mattermost/focalboard/server/model"
	"github.com/mattermost/focalboard/server/services/store"
)

func (a *App) GetSharing(c store.Container, rootID string) (*model.Sharing, error) {
	sharing, err := a.store.GetSharing(c, rootID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return sharing, nil
}

func (a *App) UpsertSharing(c store.Container, sharing model.Sharing) error {
	return a.store.UpsertSharing(c, sharing)
}
