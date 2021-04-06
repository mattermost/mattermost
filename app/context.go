// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
)

// WithMaster adds the context value that master DB should be selected for this request.
func WithMaster(ctx context.Context) context.Context {
	return sqlstore.WithMaster(ctx)
}
