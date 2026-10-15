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

// FetchUntil fills a page of want items that pass keep, reading raw pages from fetch
// and moving the cursor with advance, for at most FetchUntilMaxRounds reads. truncated
// reports that it gave up before filling the page.
//
// It stops as soon as the page is full, which can be partway through a raw page, and it
// does not report how far it read. A caller that pages by offset or page number therefore
// starts its next request at rows this one already read: pages can repeat a row, but they
// never skip one. That trade is deliberate. A short page makes clients stop paging, so
// filling it is what keeps a filter from truncating the list. A caller that can resume
// after the last returned item, as a cursor does, avoids the repeats.
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
