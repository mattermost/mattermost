// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"context"
	"testing"
)

func TestSearchShards(t *testing.T) {
	client := setupTestClientAndCreateIndex(t)

	indexes := []string{testIndexName}

	shardsInfo, err := client.SearchShards(indexes...).Do(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	if shardsInfo == nil {
		t.Fatal("expected to return an shards information")
	}
	if len(shardsInfo.Shards) < 1 {
		t.Fatal("expected to return minimun one shard information")
	}

	if shardsInfo.Shards[0][0].Index != testIndexName {
		t.Fatal("expected to return shard info concerning requested index")
	}

	if shardsInfo.Shards[0][0].State != "STARTED" {
		t.Fatal("expected to return STARTED status for running shards")
	}
}
