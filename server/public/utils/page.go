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

// FetchUntilMaxRounds caps how many source pages FetchUntil will read for one
// output page. A caller denied nearly every item would otherwise drive an
// unbounded number of round trips to fill a single page.
const FetchUntilMaxRounds = 20

// FetchUntil assembles one page of `want` items that satisfy `keep`, re-reading
// the source until the page is full or the source is exhausted.
//
// It exists for the case where a page has to be filtered *after* the database has
// already paginated it: returning the survivors alone would hand the caller a
// short page, and a short page is how clients recognise the end of the results.
//
// fetch reads the next source page starting at `cursor`; advance derives the
// cursor for the page after the one it is given. Both are called with the raw,
// unfiltered page, so filtering can never move the cursor past unseen items.
// A source page shorter than `want` means the source is exhausted.
//
// The second return value reports whether the cap was reached with the page still
// unfilled — the caller has a short page that is not the end of the results, and
// should say so rather than let the client stop paginating.
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

		// Short page: the source has nothing more to offer, so the page is as
		// full as it will get and this is a genuine end of results.
		if len(page) < want {
			return kept, false, nil
		}

		cursor = advance(page)
	}

	return kept, true, nil
}
