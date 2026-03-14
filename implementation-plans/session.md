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

## Session — GetPostsBatchForIndexing card exclusion
- **Task**: GetPostsBatchForIndexing (line 2530) excludes card posts — add AND Posts.Type != 'card' (line 2550)
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/GetPostsBatchForIndexing" -v -count=1` — PASS
- **Notes**: Added `Posts.Type != 'card'` to the raw SQL WHERE clause in `GetPostsBatchForIndexing`. Added test case at the end of `testPostStoreGetPostsBatchForIndexing` that creates a card post and verifies it doesn't appear in indexing batch results.

## Session — GetRepliesForExport card exclusion verification
- **Task**: GetRepliesForExport (line 2719) excludes card posts via postsQuery
- **Status**: PASS
- **Changes**: `implementation-plans/card-post-type-exclusion-tasks.json`, `implementation-plans/session.md`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetRepliesForExport" -v -count=1` — PASS
- **Notes**: No code change needed — GetRepliesForExport already uses `s.postsQuery` (line 2737) which excludes card posts via the base builder's `Where(sq.NotEq{"Posts.Type": model.PostTypeCard})`. Existing test passes.

## Session — AnalyticsUserCountsWithPostsByDay card exclusion
- **Task**: AnalyticsUserCountsWithPostsByDay (~line 2298) excludes card posts — add AND Posts.Type != 'card'
- **Status**: PASS
- **Changes**: `server/channels/store/sqlstore/post_store.go`, `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/UserCountsWithPostsByDay" -v -count=1` — PASS
- **Notes**: Added `AND Posts.Type != 'card'` to the raw SQL WHERE clause in `AnalyticsUserCountsWithPostsByDay`. Added a card post with a unique UserId to the existing test to verify it doesn't inflate the distinct user count.

## Session — Get() unfiltered verification
- **Task**: Get() single post by ID (line 747, raw SQL) is LEFT UNFILTERED — returns card posts
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/Get$" -v -count=1` — PASS
- **Notes**: Added card post assertions to `testPostStoreGet` — saves a card post, calls Get() by ID, verifies it's returned with correct type. Confirms Get() is intentionally unfiltered for targeted lookups.

## Session — GetPostsCreatedAt unfiltered verification
- **Task**: GetPostsCreatedAt (line 2483, raw SQL) is LEFT UNFILTERED — returns card posts
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetPostsCreatedAt" -v -count=1` — PASS
- **Notes**: No code change needed — GetPostsCreatedAt uses raw SQL without card filter, which is intentional (import dedup, targeted lookup). Added card post to existing test: creates a card post at the same CreateAt, verifies GetPostsCreatedAt returns it alongside normal posts (count goes from 2 to 3).

## Session — Delete operations unfiltered verification
- **Task**: Delete operations (PermanentDeleteByUser, PermanentDeleteByChannel, PermanentDeleteBatch) are LEFT UNFILTERED — can delete card posts
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/DeleteCardPosts" -v -count=1` — PASS (both subtests)
- **Notes**: No code change needed — delete operations are intentionally unfiltered so they can delete card posts. Added new test function `testPostStoreDeleteCardPosts` with two subtests: PermanentDeleteByChannel and PermanentDeleteByUser. Both create a card post, delete via the respective method, and verify the card post no longer exists.

## Session — GetOldest unfiltered verification
- **Task**: GetOldest (line 2608) is LEFT UNFILTERED — may return card posts
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/GetOldest" -v -count=1` — PASS
- **Notes**: No code change needed — GetOldest uses raw SQL (`SELECT ... FROM Posts ORDER BY CreateAt LIMIT 1`) without any type filter, which is intentional (system-level query). Added card post with CreateAt=1 to existing test and verified GetOldest still returns a post with the earliest CreateAt without excluding card type.

## Session — GetNthRecentPostTime unfiltered verification
- **Task**: GetNthRecentPostTime (line 1933) is LEFT UNFILTERED — already filters Type=''
- **Status**: PASS
- **Changes**: `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `cd server && go build ./...` — PASS (no store-level test exists for this function)
- **Notes**: No code change needed — GetNthRecentPostTime already uses `sq.Eq{"p.Type": ""}` which only matches empty-string type posts (standard user posts for cloud limits). Card posts (Type="card") are naturally excluded. No dedicated store test exists; the only reference is in app_test.go via a mock. Build verification confirms no regressions.

## Session — SetPostReminder unfiltered verification
- **Task**: SetPostReminder existence check (line 3177) is LEFT UNFILTERED — can set reminders on card posts
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/.*/SetPostReminder" -v -count=1` — PASS
- **Notes**: No code change needed — SetPostReminder uses raw SQL `SELECT EXISTS (SELECT 1 FROM Posts WHERE Id=?)` without any type filter, which is intentional (should be able to set reminders on card posts). Added card post test case to existing `testSetPostReminder` that creates a card post and verifies SetPostReminder succeeds on it.

## Session — Thread metadata subqueries unfiltered verification
- **Task**: Thread metadata subqueries (reply counts at lines 3097-3114) are LEFT UNFILTERED
- **Status**: PASS
- **Changes**: `server/channels/store/storetest/post_store.go`, `implementation-plans/card-post-type-exclusion-tasks.json`
- **Tests run**: `go test ./channels/store/sqlstore/ -run "TestPostStore/PostgreSQL/ThreadMetadataCountsCardReplies" -v -count=1` — PASS
- **Notes**: No code change needed — thread metadata subqueries (participant calculation at line 3111, reply count at line 3122) use raw SQL without type filters, which is intentional (internal bookkeeping should count all post types). Added new test `testThreadMetadataCountsCardReplies` that creates a thread with both a normal reply and a card reply, then verifies `Thread.ReplyCount == 2` and `len(Thread.Participants) == 2`, confirming card replies are counted.
