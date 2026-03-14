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
