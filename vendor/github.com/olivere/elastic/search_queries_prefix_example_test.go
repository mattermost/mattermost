// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic_test

import (
	"context"

	"github.com/olivere/elastic"
)

func ExamplePrefixQuery() {
	// Get a client to the local Elasticsearch instance.
	client, err := elastic.NewClient()
	if err != nil {
		// Handle error
		panic(err)
	}

	// Define wildcard query
	q := elastic.NewPrefixQuery("user", "oli")
	q = q.QueryName("my_query_name")

	searchResult, err := client.Search().
		Index("twitter").
		Query(q).
		Pretty(true).
		Do(context.Background())
	if err != nil {
		// Handle error
		panic(err)
	}
	_ = searchResult
}
