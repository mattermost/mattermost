# Card Post Exclusion — Session Log

## Session — getPostsAround card exclusion
- **Task**: getPostsAround (line 1687) excludes card posts — add sq.NotEq to conditions (line 1724)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/GetPostsBeforeAfter/should_exclude" -v -count=1` — PASS
- **Notes**: Added `sq.NotEq{"p.Type": model.PostTypeCard}` to the conditions slice in `getPostsAround`. Added test subtest "should exclude card posts" that creates a card post between two normal posts and verifies both GetPostsBefore and GetPostsAfter skip it.

## Session — GetPostAfterTime card exclusion verification
- **Task**: GetPostAfterTime (line 1836) excludes card posts via postsQuery
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetPostBeforeAfter" -v -count=1` — PASS
- **Notes**: No code change needed — GetPostAfterTime already uses `s.postsQuery` which excludes cards. Added test case to `testPostStoreGetPostBeforeAfter` that creates a card post after the last normal post and verifies GetPostAfterTime returns empty (skips the card).

## Session — getRootPosts card exclusion (all 4 raw SQL variants)
- **Task**: getRootPosts (line 1860) excludes card posts — all 4 raw SQL variants (lines 1866-1873)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetPosts/should_exclude_card" -v -count=1` — PASS
- **Notes**: Added `AND p.Type != 'card'` / `AND Posts.Type != 'card'` to all 4 raw SQL query variants in `getRootPosts` (skipFetchThreads=true/false x includeDeleted=true/false). Added test subtest "should exclude card posts from all getRootPosts variants" that creates a card post in a fresh channel and verifies it is excluded in all 4 combinations.

## Session — getParentsPosts card exclusion
- **Task**: getParentsPosts (line 1884) excludes card posts — inner subquery (line 1918) and outer WHERE (line 1924)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetPosts/should_exclude_card_posts_from_getParentsPosts" -v -count=1` — PASS
- **Notes**: Added `AND Posts.Type != 'card'` to the inner subquery WHERE clause and `AND q2.Type != 'card'` to the outer WHERE clause in `getParentsPosts`. Added test that creates a channel with a threaded conversation plus a card post, then verifies GetPosts (non-collapsed) excludes the card from results.

## Session — getFlaggedPosts card exclusion
- **Task**: getFlaggedPosts (line 525) excludes card posts — add AND Posts.Type != 'card' (line 553)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetFlaggedPosts" -v -count=1` — all 3 subtests PASS
- **Notes**: Added `AND Posts.Type != 'card'` to the raw SQL WHERE clause in `getFlaggedPosts`, alongside the existing `AND Posts.DeleteAt = 0`. Added test case at the end of `testPostStoreGetFlaggedPosts` that creates a card post, flags it, and verifies it doesn't appear in flagged post results.

## Session — search() card exclusion
- **Task**: search() function (line 2146) excludes card posts — add filter after system post filter (line 2161)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run TestSearchPostStore -v -count=1` — all subtests PASS
- **Notes**: Added `Where(fmt.Sprintf("q2.Type != '%s'", model.PostTypeCard))` to the baseQuery builder in the `search()` function, right after the existing system message prefix filter. The search function builds its own query (not using `postsQuery`), so this explicit filter is needed. No new test added — existing search tests all pass, confirming the filter doesn't break anything.

## Session — GetPostsByIds card exclusion
- **Task**: GetPostsByIds (line 2495) excludes card posts — add .Where(sq.NotEq) (line 2500)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/GetPostsByIds" -v -count=1` — PASS (including new `excludes_card_posts` subtest)
- **Notes**: Added `Where(sq.NotEq{"p.Type": model.PostTypeCard})` to the query builder in `GetPostsByIds`. Added test subtest that creates a card post and a normal post, calls GetPostsByIds with both IDs, and verifies only the normal post is returned.
