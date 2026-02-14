-- CJK Search Performance Benchmark Queries
-- Run against a database populated with cjk-perf-test.
-- Usage: psql -f bench.sql mattermost_test
--
-- Each query is prefixed with \timing to show execution time.

\timing on

-- 1. Baseline: English full-text search (uses GIN index)
\echo '--- 1. English full-text search (to_tsvector) ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE to_tsvector('english', Message) @@ to_tsquery('english', 'testing')
ORDER BY CreateAt DESC LIMIT 100;

-- 2. CJK: ILIKE search for Chinese term
\echo '--- 2. Chinese ILIKE search ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%测试%'
ORDER BY CreateAt DESC LIMIT 100;

-- 3. CJK: ILIKE search for Japanese term
\echo '--- 3. Japanese ILIKE search ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%テスト%'
ORDER BY CreateAt DESC LIMIT 100;

-- 4. CJK: ILIKE search for Korean term
\echo '--- 4. Korean ILIKE search ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%테스트%'
ORDER BY CreateAt DESC LIMIT 100;

-- 5. CJK: ILIKE with AND (two terms)
\echo '--- 5. Chinese ILIKE with AND (two terms) ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%搜索%' AND Message ILIKE '%功能%'
ORDER BY CreateAt DESC LIMIT 100;

-- 6. CJK: ILIKE with OR (two terms)
\echo '--- 6. Chinese ILIKE with OR (two terms) ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE (Message ILIKE '%搜索%' OR Message ILIKE '%测试%')
ORDER BY CreateAt DESC LIMIT 100;

-- 7. CJK: ILIKE with NOT ILIKE exclusion
\echo '--- 7. Chinese ILIKE with exclusion ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%测试%' AND Message NOT ILIKE '%错误%'
ORDER BY CreateAt DESC LIMIT 100;

-- 8. Mixed: ILIKE for mixed CJK + Latin
\echo '--- 8. Mixed CJK + Latin ILIKE search ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%Hello%' AND Message ILIKE '%你好%'
ORDER BY CreateAt DESC LIMIT 100;

-- 9. Worst case: CJK term that matches nothing (full index scan)
\echo '--- 9. Chinese ILIKE no match (worst case) ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE Message ILIKE '%完全不存在的词语%'
ORDER BY CreateAt DESC LIMIT 100;

-- 10. Worst case: English to_tsvector no match (for comparison)
\echo '--- 10. English full-text search no match ---'
EXPLAIN ANALYZE
SELECT id, message FROM Posts
WHERE to_tsvector('english', Message) @@ to_tsquery('english', 'xyznonexistent')
ORDER BY CreateAt DESC LIMIT 100;

-- 11. Count of posts by content type (for verifying distribution)
\echo '--- 11. Post distribution ---'
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE message ~ '[一-龥]') AS chinese,
  COUNT(*) FILTER (WHERE message ~ '[ぁ-んァ-ヶ]') AS japanese,
  COUNT(*) FILTER (WHERE message ~ '[가-힣]') AS korean,
  COUNT(*) FILTER (WHERE message ~ '^[[:ascii:]]+$') AS latin_only
FROM Posts
WHERE props::text LIKE '%cjk-perf-%';

\timing off
