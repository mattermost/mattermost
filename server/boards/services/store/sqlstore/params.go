// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"fmt"

	mm_model "github.com/mattermost/mattermost-server/server/v7/model"

	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

// servicesAPI is the interface required my the Params to interact with the mattermost-server.
// You can use plugin-api or product-api adapter implementations.
type servicesAPI interface {
	GetChannelByID(string) (*mm_model.Channel, error)
}

type Params struct {
	DBType           string
	ConnectionString string
	TablePrefix      string
	Logger           mlog.LoggerIFace
	DB               *sql.DB
	IsPlugin         bool
	IsSingleUser     bool
	ServicesAPI      servicesAPI
	SkipMigrations   bool
	ConfigFn         func() *mm_model.Config
}

func (p Params) CheckValid() error {
	return nil
}

type ErrStoreParam struct {
	name  string
	issue string
}

func (e ErrStoreParam) Error() string {
	return fmt.Sprintf("invalid store params: %s %s", e.name, e.issue)
}
