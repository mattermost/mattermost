// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

// Pager fetches all items from a paginated API.
// Pager is a generic function that fetches and aggregates paginated data.
// It takes a fetch function and a perPage parameter as arguments.
//
// The fetch function is responsible for retrieving a slice of items of type T
// for a given page number. It returns the fetched items and an error, if any.
// Ideally a developer may want to use a closure to create a fetch function.
//
// The perPage parameter specifies the number of items to fetch per page.
//
// Example usage:
//
//	items, err := Pager(fetchFunc, 10)
//	if err != nil {
//	    // handle error
//	}
//	// process items
func Pager[T any](fetch func(page int) ([]T, error), perPage int) ([]T, error) {
	var list []T
	var page int

	for {
		fetched, err := fetch(page)
		if err != nil {
			return list, err
		}

		list = append(list, fetched...)

		if len(fetched) < perPage {
			break
		}

		page++
	}

	return list, nil
}
