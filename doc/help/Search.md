# Search

The search box in Mattermost brings back results from any channel of which you’re a member. No results are returned from channels where you are not a member - even if they are open channels.

Some things to know about search: 

- Multiple search terms are connected with “OR” by default. Typing in `Mattermost website` returns results containing “Mattermost” or “website”
- You can use quotes to return search results for exact terms, like `"Mattermost website"` will only return messages containing the entire phrase `"Mattermost website"` and not return messages with only `Mattermost` or `website`
- You can use the `*` character for wildcard searches that match within words. For example: Searching for `rea*` brings back messages containing `reach`, `reason` and other words starting with `rea`.

#### Limitations

- Search in Mattermost uses the full text search features included in either a MySQL or Postgres database, which has some limitations
  - Special cases that are not supported in default full text search, such as searching for IP addresses like `10.100.200.101`, can be added in future as the search feature evolves
  - Searches with fewer than three characters will return no results, so for searching in Chinese try adding * to the end of queries
