// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

const (
	FetchUntilMaxRounds = 10
)

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

func FetchUntil[T any, C any](
	cursor C,
	want int,
	fetch func(cursor C) ([]T, error),
	keep func(T) bool,
	advance func(page []T) C,
) (kept []T, truncated bool, err error) {
	if want <= 0 {
		return nil, false, nil
	}

	kept = make([]T, 0, want)
	for range FetchUntilMaxRounds {
		page, err := fetch(cursor)
		if err != nil {
			return kept, false, err
		}

		for _, item := range page {
			if !keep(item) {
				continue
			}
			kept = append(kept, item)
			if len(kept) == want {
				return kept, false, nil
			}
		}

		if len(page) < want {
			return kept, false, nil
		}

		cursor = advance(page)
	}

	return kept, true, nil
}
