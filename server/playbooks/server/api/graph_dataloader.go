// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"github.com/graph-gophers/dataloader/v7"
)

const loaderBatchCapacity = 200

func populateResultWithError[K any](err error, result []*dataloader.Result[K]) []*dataloader.Result[K] {
	for i := range result {
		result[i] = &dataloader.Result[K]{Error: err}
	}
	return result
}
