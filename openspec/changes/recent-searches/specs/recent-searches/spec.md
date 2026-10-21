# Spec Delta

## Purpose

Persists each user's last five message and file searches so they can recover, rerun, and delete them across sessions.

## ADDED Requirements

### Requirement: Record a confirmed search
The system MUST persist a recent-search entry when the session user confirms a non-empty `messages` or `files` search. The server MUST assign `create_at` and `update_at`. Plugin search types MUST NOT be persisted. Empty terms after trim MUST NOT create an entry. A history-write failure MUST NOT prevent the search itself from running.

#### Scenario: First confirmed message search
- **WHEN** the authenticated user confirms a non-empty messages search
- **THEN** the system stores one entry with the trimmed terms, type `messages`, team scope, and server timestamps

#### Scenario: Plugin search is ignored
- **WHEN** the user confirms a plugin search type
- **THEN** the system MUST NOT create or update a recent-search entry

#### Scenario: History write failure is non-blocking
- **WHEN** persisting the entry fails
- **THEN** the search results MUST still be produced and the client MUST remain usable

### Requirement: Deduplicate and retain five entries
The system MUST treat `(user_id, terms, search_type, team_id)` after trim as the uniqueness key and MUST NOT rewrite search operators. Repeating the same key MUST update `update_at` only. The system MUST keep at most five entries per user, dropping the oldest by `update_at` after an insert or refresh.

#### Scenario: Repeat updates recency
- **WHEN** the user confirms a search matching an existing key
- **THEN** the system MUST NOT add a second row and MUST set `update_at` to the current server time

#### Scenario: Sixth distinct search drops the oldest
- **WHEN** the user already has five distinct entries and confirms a new distinct search
- **THEN** the system MUST store the new entry and MUST remove the entry with the oldest `update_at`

### Requirement: List owned history
The system MUST return the session user's recent searches, newest `update_at` first, at most five items. A request for another user's `user_id` MUST be rejected with 403. Unauthenticated requests MUST be rejected with 401.

#### Scenario: Owner lists history
- **WHEN** the session user requests their recent searches
- **THEN** the system returns at most five of their entries ordered by `update_at` descending

#### Scenario: Other user is forbidden
- **WHEN** an authenticated user requests another user's recent searches
- **THEN** the system MUST respond 403 and MUST NOT return those entries

### Requirement: Delete owned entry
The system MUST delete an entry only when it belongs to the session user. A missing or foreign id MUST return 404. Successful delete MUST remove that entry only.

#### Scenario: Owner deletes one entry
- **WHEN** the session user deletes one of their entry ids
- **THEN** that entry is gone and other entries remain

#### Scenario: Foreign id is not distinguishable
- **WHEN** the session user deletes an id owned by another user
- **THEN** the system MUST respond 404

### Requirement: Authorize and validate writes
`user_id` in the path MUST be the session user or `me`. Invalid `search_type` or terms longer than 2048 runes MUST return 400. The server MUST NOT log search terms at info level.

#### Scenario: Invalid type rejected
- **WHEN** a write uses `search_type` other than `messages` or `files`
- **THEN** the system MUST respond 400 and MUST NOT persist the body

### Requirement: Notify the user's other sessions
After a successful create, update, or delete, the system MUST publish a user-scoped WebSocket event `recent_search_updated` to that user's sessions only. Clients MUST refetch on reconnect rather than relying only on the event.

#### Scenario: Other session is notified
- **WHEN** one session persists or deletes an entry
- **THEN** other connected sessions of the same user MUST receive `recent_search_updated`

#### Scenario: Other users are not notified
- **WHEN** a user's history changes
- **THEN** sessions of other users MUST NOT receive that event
