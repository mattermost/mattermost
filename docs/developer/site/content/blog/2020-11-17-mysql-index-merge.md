---
title: Tuning MySQL and the Ghost of Index Merge Intersection
slug: mysql-index-merge
date: 2020-11-17
categories:
    - "go"
author: Agniva De Sarker
github: agnivade
community: agnivade
canonicalUrl: https://mattermost.com/blog/tuning-mysql-and-the-ghost-of-index-merge-intersection/
---

Optimizing SQL queries is always fun, except when it isn't. If you're a MySQL veteran and have read the title, you already know where this is heading 😉. In that case, allow me to regale the uninitiated reader.

This is the story of an (apparently) smart optimization to a SQL query that backfired spectacularly and how we finally fixed it.

### Act I: A slow query

It started off with a customer noticing that a SQL query was running slowly in their environment. The query was:

```sql
SELECT Id FROM Posts WHERE ChannelId = '9tne5g44z7f1zn4z1whebb7jna'
	AND DeleteAt = 0
	AND CreateAt < 1582683608013
	ORDER BY CreateAt DESC
	LIMIT 1;
```

After asking for more information, we got the `EXPLAIN` output:

```
EXPLAIN SELECT Id FROM Posts WHERE ChannelId = '9tne5g44z7f1zn4z1whebb7jna' AND DeleteAt = 0 AND CreateAt < 1582683608013 ORDER BY CreateAt DESC LIMIT 1;
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+------+------+----------+----------------------------------+
| id | select_type | table | partitions | type | possible_keys | key | key_len | ref | rows | filtered | Extra |
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+------+------+----------+----------------------------------+
| 1 | SIMPLE | Posts | NULL | index | idx_posts_create_at,idx_posts_delete_at,idx_posts_channel_id,idx_posts_channel_id_update_at,idx_posts_channel_id_delete_at_create_at | idx_posts_create_at | 9 | NULL | 3 | 10.57 | Using where; Backward index scan |
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+------+------+----------+----------------------------------+
1 row in set (0.06 sec)
```

This was taking several minutes to run in their environment, and apparently, if they `USE INDEX (idx_posts_channel_id_delete_at_create_at)`, it ran in less than a second. From the above `EXPLAIN` output, we can see that it is choosing the `idx_posts_create_at` index, whereas choosing `idx_posts_channel_id_delete_at_create_at` is clearly the better one.

Before we dive any further, let us look at the table schema and layout.

```sql
mysql> show CREATE TABLE Posts;
CREATE TABLE `Posts` (
  `Id` varchar(26) NOT NULL,
  `CreateAt` bigint(20) DEFAULT NULL,
  `UpdateAt` bigint(20) DEFAULT NULL,
  `EditAt` bigint(20) DEFAULT NULL,
  `DeleteAt` bigint(20) DEFAULT NULL,
  `UserId` varchar(26) DEFAULT NULL,
  `ChannelId` varchar(26) DEFAULT NULL,
  `Message` text,
  PRIMARY KEY (`Id`),
  KEY `idx_posts_update_at` (`UpdateAt`),
  KEY `idx_posts_create_at` (`CreateAt`),
  KEY `idx_posts_delete_at` (`DeleteAt`),
  KEY `idx_posts_channel_id` (`ChannelId`),
  KEY `idx_posts_user_id` (`UserId`),
  KEY `idx_posts_channel_id_update_at` (`ChannelId`,`UpdateAt`),
  KEY `idx_posts_channel_id_delete_at_create_at` (`ChannelId`,`DeleteAt`,`CreateAt`),
  FULLTEXT KEY `idx_posts_message_txt` (`Message`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
```

This is an abridged version of the `Posts` table for brevity. But it contains the essential elements for us to understand the problem. Our main columns of interest are `CreateAt`, `DeleteAt`, `UpdateAt`, and `ChannelId`. Each of them have their individual indices, and there are two additional multi-column indices. One having `ChannelId` and `UpdateAt`. Another involving `ChannelId`, `DeleteAt`, and `CreateAt`.

Now let's look into the query again.

```sql
SELECT Id FROM Posts WHERE ChannelId = 'x' AND DeleteAt = y AND CreateAt < z
	ORDER BY CreateAt DESC
	LIMIT 1
```

We're filtering the table by three columns: `ChannelId`, `DeleteAt`, and `CreateAt`. And then ordering by `CreateAt` and just getting the first row. It becomes clear why choosing the multi-column index is faster than choosing the one for `CreateAt`. Simply because the query filters by all three columns which leads to scanning a much smaller dataset. But then, why is MySQL choosing the wrong index in the first place? Using `USE INDEX` was the nuclear button which I didn't want to use unless there were no other options.

I wasn't able to reproduce the problem locally, so it wasn't feasible to try different variations of the query. But after some googling, I had a pretty good theory of what was happening. It was the "ORDER BY" clause. MySQL tries to be smart and decides that although using the `CreateAt` index might have to scan through more rows, it avoids the sorting at the end. Whereas actually, using the multi-column index leads to scanning fewer rows, which gets sorted in practically no time at all.

Now that we understand the problem, how can we coax MySQL into choosing the right index? Well, if MySQL is acting smart, we can outsmart it. What could possibly go wrong? Right?

Since the choice of the index is dictated by the "ORDER BY" clause rather than the "WHERE" clause, what if we can include that decision in the "ORDER BY" clause itself? If we change `ORDER BY CreateAt` to `ORDER BY ChannelId, DeleteAt, CreateAt`, the query result remains exactly the same. Because `ChannelId` and `DeleteAt` are equality checks. But now MySQL goes- "Aha, now I have to sort by these three columns. So I'd better use the multi-column index". And that's exactly what we want!

With much trepidation, I asked the customer to try out the result of:

```sql
SELECT Id FROM Posts WHERE ChannelId = '9tne5g44z7f1zn4z1whebb7jna'
	AND DeleteAt = 0
	AND CreateAt < 1582683608013
	ORDER BY ChannelId, DeleteAt, CreateAt DESC
	LIMIT 1;
```

and they come back saying it ran successfully in the expected time.

I pat myself on the back for a job well done, send a {{< newtabref href="https://github.com/mattermost/mattermost/pull/14119" title="PR" >}}, and call it a day.

### Act II: The relapse

Several months pass by. I have nearly forgotten about this whole thing. And then the same customer comes back with saying that they just upgraded to the release containing the fix, and everything just became unbearably slow. We check the slow query logs, and surprise surprise, it was the exact query which I optimized. This was shocking and embarassing at the same time.

I did some quick mental back-tracking. Let's say hypothetically the optimization somehow failed to work again (perhaps because months have gone by and the table has more data now). It should fall back to using the `CreateAt` index which was already happening in their DB. So something crazy had happened, which didn't improve performance at all, but actually made it worse, far worse.

We asked for the `EXPLAIN` output again and got this:

```
+------------------------------------------+---------+-------+--------+----------+----------------------------------------------------------------------------------------+
| id | select_type | table | partitions | type        | possible_keys                                                                                                                        | key                                      | key_len | ref   | rows   | filtered | Extra                                                                                  |
+----+-------------+-------+------------+-------------+--------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------+---------+-------+--------+----------+----------------------------------------------------------------------------------------+
|  1 | PRIMARY     | p     | NULL       | index_merge | idx_posts_create_at,idx_posts_delete_at,idx_posts_channel_id,idx_posts_channel_id_update_at,idx_posts_channel_id_delete_at_create_at | idx_posts_channel_id,idx_posts_delete_at | 107,9   | NULL  | 195092 |    50.00 | Using intersect(idx_posts_channel_id,idx_posts_delete_at); Using where; Using filesort |
|  2 | SUBQUERY    | Posts | NULL       | const       | PRIMARY                                                                                                                              | PRIMARY                                  | 106     | const |      1 |   100.00 | NULL                                                                                   |
+----+-------------+-------+------------+-------------+--------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------+---------+-------+--------+----------+----------------------------------------------------------------------------------------+
2 rows in set (0.00 sec)
```

This was strange. Instead of using an index, it was doing an `index_merge` of `idx_posts_channel_id` and `idx_posts_delete_at`. We also ran the old query just to be sure that nothing odd was happening:

```
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+-------+---------+----------+----------------------------------+
| id | select_type | table | partitions | type  | possible_keys                                                                                                                        | key                 | key_len | ref   | rows    | filtered | Extra                            |
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+-------+---------+----------+----------------------------------+
|  1 | PRIMARY     | p     | NULL       | range | idx_posts_create_at,idx_posts_delete_at,idx_posts_channel_id,idx_posts_channel_id_update_at,idx_posts_channel_id_delete_at_create_at | idx_posts_create_at | 9       | NULL  | 6175639 |     1.58 | Using where; Backward index scan |
|  2 | SUBQUERY    | Posts | NULL       | const | PRIMARY                                                                                                                              | PRIMARY             | 106     | const |       1 |   100.00 | NULL                             |
+----+-------------+-------+------------+-------+--------------------------------------------------------------------------------------------------------------------------------------+---------------------+---------+-------+---------+----------+----------------------------------+
```

As expected, the old query was selecting only `idx_posts_create_at`, but now the new query had decided to do something completely different. I wasn't too familiar with what an index merge intersection was, so I had to do some reading to understand what exactly was happening.

Essentially, an index merge is an optimization, where multiple range scans are made with different indices, and the results are merged into one. There are different modes of merging the rows: intersection, union, and sort-union. From our `EXPLAIN` output, we see `Using intersect(idx_posts_channel_id,idx_posts_delete_at)`, which means it's doing an index merge intersection of the rows.

Unlike last time, theorizing again on how to fix this, clearly will not work. I needed to reproduce this. And by some stroke of luck, I was successful this time. For some particular query inputs, MySQL was choosing `index_merge` pretty consistently. At last, some good news.

I immediately tried all the usual tricks of `ANALYZE TABLE` and `OPTIMIZE TABLE` just to rule out any usual suspects. No dice. Then I started to dissect the query itself to bring it down to the smallest possible form in which the issue manifested. I removed the "ORDER BY" and "LIMIT 1". The query had come down to:

```sql
SELECT Id FROM Posts WHERE ChannelId = 'x' AND DeleteAt = y AND CreateAt < z
```

This was interesting. Because the "ORDER BY" doesn't come into play at all. Irrespective of the number of columns in "ORDER BY", or even in the absence of it, MySQL chose an index merge. But as luck would have it, somehow in the customer's DB, only when the "ORDER BY" would have those three columns, it would go for the index merge. Otherwise, it would use the single `CreateAt` index.

On the bright side, the query was now simplified to a great extent. This is where things stood:

- We're filtering the result by three columns; two of them are equality checks, and one is a range check.
- We have individual indices for all three columns, and also a covering index including all three of them.
- MySQL was choosing to do an index merge intersection of the `ChannelId` and `DeleteAt` indices rather than using the multi-column index.

The general advice on the internet was to use a covering index for all the columns. But that's exactly what we already had, and MySQL was still hell-bent on doing an index merge.

That's when it hit me. It's the `DeleteAt = 0` condition. It wasn't about the particular column, but the condition `= 0`. Whenever we delete a post in our table, we set the `DeleteAt` column to the current timestamp. Of course a super-admin can permanently delete posts. But when a normal user deletes their post, the DB retains them. So then what is the search space of `DeleteAt = 0`? **All** undeleted posts. Which is basically the entire Posts table!

And here's where the query planner was getting it wrong. It was deciding the cost of a query based on the search space _after_ the intersection, not for the individual columns. Indeed, with the index merge, it has to scan only 195092 rows instead of 6175639 which had to be done with the `CreateAt` case (refer to the EXPLAIN outputs above). Unfortunately, I don't have the value for the multi-column index, but it must have been higher than 195092. So MySQL thought that it had to scan 195k rows, whereas actually it was scanning the entire table plus all rows with a given `ChannelId`, which was approximately 13 million. We had been outsmarted again.

![image](/blog/2020-11-17-mysql-index-merge/table_flip.jpg)

The situation looked pretty bleak. I was left with only a couple of approaches. Either we block "index_merge_intersection" from the optimizer plan, or we coerce the right index to be selected. Blocking an index merge would mean doing a `SET SESSION optimizer_switch="index_merge_intersection=off"` before the query, run the query, and then turn it back on. Alternatively, we can use an index hint in the form of "USE INDEX".

Using a "USE INDEX" has the problem that we would be overriding MySQL's decision making, which might not be right every time. But toggling the optimizer switch was at a session level, not at the query level, and it looked very ugly. After a bit of back and forth, I gave in, and {{< newtabref href="https://github.com/mattermost/mattermost/pull/15207" title="went" >}} with "USE INDEX".

### Finale

Several months have gone by after that, and the query performance has remained stable thus far. The exorcism was finally successful.

If there's one thing that I would like you to take away from this post, it is that making obscure optimizations may seem smart; but two can play this game. If you ever find yourself trying to coerce MySQL to choose an index, it _may_ be safer to just go for "USE INDEX". And keep an eye out for columns with low selectivity.

Alternatively, there's also this DB called Postgres which people keep talking about. Maybe try that?

**References**

- https://www.percona.com/blog/2012/12/14/the-optimization-that-often-isnt-index-merge-intersection/
- https://code.openark.org/blog/mysql/7-ways-to-convince-mysql-to-use-the-right-index
- https://dev.mysql.com/doc/refman/5.7/en/index-merge-optimization.html

P.S. If you think I have missed something, or perhaps there is a cleaner way to solve this, please feel free to hop on to our {{< newtabref href="https://community.mattermost.com/core/channels/developers-performance" title="~Developers: Performance" >}} channel on our community server and we can talk more!
