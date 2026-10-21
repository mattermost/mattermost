#### Summary
Add per-user recent message and file search history (last 5), persisted server-side and shown under the search box hints. Users can rerun or clear an entry; another user's history is never readable or writable, including by admins.

#### Ticket Link
Fixes: https://github.com/mattermost/mattermost/issues/15976

#### Screenshots
(Add a screenshot of the search box with Recent searches after the first successful search.)

#### Release Note
```release-note
Added recent message and file search history (last 5 per user) in the search box, with GET/POST /api/v4/users/{user_id}/recent_searches, DELETE /api/v4/users/{user_id}/recent_searches/{search_id}, table recentsearchqueries, and websocket event recent_search_updated.
```
