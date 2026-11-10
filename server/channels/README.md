# Server Channels Review Guidelines

When reviewing or writing code in the server channels package, focus on SQL query performance and API layer efficiency.

## SQL Store Layer

- Run `EXPLAIN ANALYZE` on new or modified queries against a large dataset before merging. A query that performs well on a 12M-post database may degrade significantly at 100M+ posts.
- Watch for sequential scans on large tables. Ensure appropriate indexes exist for new query patterns.
- When adding new queries to the store, check whether an existing query already fetches the needed data. Avoid duplicate round trips to the database.

## API Layer

- Minimize database round trips. If an endpoint calls a `Get` followed by a `Delete` on the same row, consider using `DELETE ... RETURNING` to combine them into a single query.
- Don't add queries that are unnecessary for the operation. The most efficient work is the work you don't do.
- When adding new API endpoints, add them to the load test tooling so performance can be validated under realistic concurrency.

## Permissions and Security

- Verify that new endpoints enforce appropriate permissions. Rely on the dedicated security review for thorough coverage, but flag anything obviously missing (e.g., an endpoint that skips permission checks entirely).
