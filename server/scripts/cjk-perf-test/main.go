// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Tool for generating posts to benchmark CJK search performance.
//
// Usage:
//
//	go run ./scripts/cjk-perf-test -count 10000
//	go run ./scripts/cjk-perf-test -count 100000
//	go run ./scripts/cjk-perf-test -count 1000000
//	go run ./scripts/cjk-perf-test -count 10000 -team myteam
//	go run ./scripts/cjk-perf-test -count 10000 -user admin
//	go run ./scripts/cjk-perf-test -count 10000 -team myteam -user admin
//	go run ./scripts/cjk-perf-test -count 10000 -dsn "postgres://user:pass@host:5432/dbname?sslmode=disable"
//	go run ./scripts/cjk-perf-test -cleanup  # remove generated posts
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

const (
	batchSize = 1000
	idLen     = 26
	idChars   = "abcdefghijklmnopqrstuvwxyz0123456789"
	tagPrefix = "cjk-perf-"
)

// Post content pools — a mix of CJK, Latin, and mixed messages
// so that the benchmark reflects real-world mixed-content search.
var (
	chineseMessages = []string{
		"你好世界",
		"这是一个测试消息",
		"搜索功能正常工作",
		"我们需要更好的搜索",
		"数据库性能测试中",
		"中文搜索支持很重要",
		"请查看这个问题",
		"产品发布计划讨论",
		"这个功能还在开发中",
		"需要修复这个错误",
	}
	japaneseMessages = []string{
		"こんにちは世界",
		"テストメッセージです",
		"検索機能が正常に動作",
		"パフォーマンステスト中",
		"日本語の検索サポート",
		"この問題を確認してください",
		"新しい機能を開発中",
		"データベースの最適化",
		"カタカナとひらがなのテスト",
		"バグを修正する必要がある",
	}
	koreanMessages = []string{
		"안녕하세요 세계",
		"테스트 메시지입니다",
		"검색 기능이 정상 작동",
		"성능 테스트 중입니다",
		"한국어 검색 지원",
		"이 문제를 확인해주세요",
		"새로운 기능을 개발중",
		"데이터베이스 최적화",
		"한글 검색 테스트",
		"버그를 수정해야 합니다",
	}
	latinMessages = []string{
		"Hello world from the team",
		"This is a test message for search",
		"Please review this pull request",
		"The deployment is scheduled for tomorrow",
		"Database migration completed successfully",
		"Performance testing in progress",
		"Bug fix for the login page",
		"New feature development started",
		"Code review feedback addressed",
		"Release notes updated",
	}
	mixedMessages = []string{
		"Hello 你好 testing",
		"Bug fix for 搜索功能",
		"Meeting about 日本語サポート at 3pm",
		"한국어 search test results look good",
		"Review PR for 中文搜索 feature",
		"Updated 데이터베이스 migration script",
		"テスト results are in the spreadsheet",
		"Fixed the 错误 in authentication",
		"New 기능 deployment plan",
		"検索 performance improved by 50%",
	}
)

func newID() string {
	b := make([]byte, idLen)
	for i := range b {
		b[i] = idChars[rand.Intn(len(idChars))]
	}
	return string(b)
}

// randomSuffix generates random filler text to make each message unique.
// This prevents PostgreSQL from benefiting from buffer cache hits on
// repeated identical content, which would give unrealistically fast benchmarks.
func randomSuffix() string {
	words := []string{
		"alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf",
		"hotel", "india", "juliet", "kilo", "lima", "mike", "november",
		"oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform",
		"victor", "whiskey", "xray", "yankee", "zulu",
	}
	n := 3 + rand.Intn(6) // 3-8 words
	parts := make([]string, n)
	for i := range parts {
		parts[i] = words[rand.Intn(len(words))]
	}
	return strings.Join(parts, " ")
}

func randomMessage() string {
	// Distribution: 25% Chinese, 20% Japanese, 20% Korean, 20% Latin, 15% mixed
	// Each message gets a unique random suffix to ensure high cardinality.
	r := rand.Intn(100)
	var base string
	switch {
	case r < 25:
		base = chineseMessages[rand.Intn(len(chineseMessages))]
	case r < 45:
		base = japaneseMessages[rand.Intn(len(japaneseMessages))]
	case r < 65:
		base = koreanMessages[rand.Intn(len(koreanMessages))]
	case r < 85:
		base = latinMessages[rand.Intn(len(latinMessages))]
	default:
		base = mixedMessages[rand.Intn(len(mixedMessages))]
	}
	return base + " " + randomSuffix()
}

func main() {
	defaultDSN := "postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable"

	count := flag.Int("count", 10000, "Number of posts to generate (e.g. 10000, 100000, 1000000)")
	dsn := flag.String("dsn", defaultDSN, "PostgreSQL connection string")
	team := flag.String("team", "", "Team name to target (uses that team's town-square). If empty, picks the first town-square found.")
	user := flag.String("user", "", "Username to author posts as. If empty, picks the first member of town-square.")
	cleanup := flag.Bool("cleanup", false, "Remove previously generated perf-test posts instead of inserting")
	flag.Parse()

	db, err := sql.Open("postgres", *dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error connecting to database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	err = db.Ping()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error pinging database: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Connected to database.")

	if *cleanup {
		doCleanup(db)
		return
	}

	// Find the town-square channel and a valid user
	channelID, teamName, userID, username, err := findChannelAndUser(db, *team, *user)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		fmt.Fprintln(os.Stderr, "Make sure the database has at least one team with a town-square channel and one user.")
		os.Exit(1)
	}

	fmt.Printf("Using team=%s, channel_id=%s (town-square), user=%s (id=%s)\n", teamName, channelID, username, userID)
	fmt.Printf("Generating %d posts in batches of %d...\n", *count, batchSize)

	insertPosts(db, *count, channelID, userID)
}

func findChannelAndUser(db *sql.DB, teamName, userName string) (channelID, resolvedTeamName, userID, resolvedUsername string, err error) {
	if teamName != "" {
		err = db.QueryRow(
			`SELECT c.id, t.name FROM Channels c
			 JOIN Teams t ON c.teamid = t.id
			 WHERE c.name = 'town-square' AND t.name = $1
			 LIMIT 1`, teamName,
		).Scan(&channelID, &resolvedTeamName)
		if err != nil {
			return "", "", "", "", fmt.Errorf("could not find town-square for team %q: %w", teamName, err)
		}
	} else {
		err = db.QueryRow(
			`SELECT c.id, t.name FROM Channels c
			 JOIN Teams t ON c.teamid = t.id
			 WHERE c.name = 'town-square'
			 LIMIT 1`,
		).Scan(&channelID, &resolvedTeamName)
		if err != nil {
			return "", "", "", "", fmt.Errorf("could not find any town-square channel: %w", err)
		}
	}

	if userName != "" {
		err = db.QueryRow(
			`SELECT u.id, u.username FROM Users u
			 JOIN ChannelMembers cm ON cm.userid = u.id
			 WHERE cm.channelid = $1 AND u.username = $2
			 LIMIT 1`, channelID, userName,
		).Scan(&userID, &resolvedUsername)
		if err != nil {
			return "", "", "", "", fmt.Errorf("could not find user %q in town-square: %w", userName, err)
		}
	} else {
		err = db.QueryRow(
			`SELECT u.id, u.username FROM Users u
			 JOIN ChannelMembers cm ON cm.userid = u.id
			 WHERE cm.channelid = $1
			 LIMIT 1`, channelID,
		).Scan(&userID, &resolvedUsername)
		if err != nil {
			return "", "", "", "", fmt.Errorf("could not find a user in town-square: %w", err)
		}
	}

	return channelID, resolvedTeamName, userID, resolvedUsername, nil
}

func insertPosts(db *sql.DB, count int, channelID, userID string) {
	start := time.Now()
	inserted := 0

	for inserted < count {
		thisBatch := batchSize
		if inserted+thisBatch > count {
			thisBatch = count - inserted
		}

		if err := insertBatch(db, thisBatch, channelID, userID); err != nil {
			fmt.Fprintf(os.Stderr, "Error inserting batch at offset %d: %v\n", inserted, err)
			os.Exit(1)
		}

		inserted += thisBatch
		elapsed := time.Since(start)
		rate := float64(inserted) / elapsed.Seconds()
		fmt.Printf("\r  Inserted %d / %d posts (%.0f posts/sec)", inserted, count, rate)
	}

	// Update channel counters so the UI knows there are new messages.
	// This mirrors what SaveMultiple does after inserting posts.
	now := time.Now().UnixMilli()
	_, err := db.Exec(`UPDATE Channels
		SET LastPostAt = GREATEST($1, LastPostAt),
			LastRootPostAt = GREATEST($1, LastRootPostAt),
			TotalMsgCount = TotalMsgCount + $2,
			TotalMsgCountRoot = TotalMsgCountRoot + $2
		WHERE Id = $3`, now, count, channelID)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nWarning: failed to update channel counters: %v\n", err)
	}

	elapsed := time.Since(start)
	fmt.Printf("\nDone. Inserted %d posts in %s (%.0f posts/sec)\n", count, elapsed.Round(time.Millisecond), float64(count)/elapsed.Seconds())
}

const columnsPerRow = 18

func insertBatch(db *sql.DB, n int, channelID, userID string) error {
	// Build a multi-row INSERT statement with all columns the ORM expects.
	valueStrings := make([]string, 0, n)
	valueArgs := make([]any, 0, n*columnsPerRow)

	now := time.Now().UnixMilli()

	for i := range n {
		id := newID()
		createAt := now - int64(rand.Intn(86400000)) // spread over last 24h
		msg := randomMessage()

		paramBase := i * columnsPerRow
		placeholders := make([]string, columnsPerRow)
		for j := range placeholders {
			placeholders[j] = fmt.Sprintf("$%d", paramBase+j+1)
		}
		valueStrings = append(valueStrings, "("+strings.Join(placeholders, ",")+")")

		propsJSON := fmt.Sprintf(`{"cjk_perf_tag":"%s%s"}`, tagPrefix, id[0:10])
		valueArgs = append(valueArgs,
			id,        // Id
			createAt,  // CreateAt
			createAt,  // UpdateAt
			int64(0),  // EditAt
			int64(0),  // DeleteAt
			false,     // IsPinned
			userID,    // UserId
			channelID, // ChannelId
			"",        // RootId
			"",        // OriginalId
			msg,       // Message
			"",        // Type
			propsJSON, // Props
			"",        // Hashtags
			"[]",      // Filenames
			"[]",      // FileIds
			false,     // HasReactions
			"",        // RemoteId
		)
	}

	query := fmt.Sprintf(
		`INSERT INTO Posts (Id, CreateAt, UpdateAt, EditAt, DeleteAt, IsPinned, UserId, ChannelId, RootId, OriginalId, Message, Type, Props, Hashtags, Filenames, FileIds, HasReactions, RemoteId) VALUES %s`,
		strings.Join(valueStrings, ","),
	)

	_, err := db.Exec(query, valueArgs...)
	return err
}

func doCleanup(db *sql.DB) {
	fmt.Println("Cleaning up perf-test posts...")

	// Decrement channel counters for affected channels before deleting.
	_, err := db.Exec(`UPDATE Channels c
		SET TotalMsgCount = GREATEST(0, c.TotalMsgCount - sub.cnt),
			TotalMsgCountRoot = GREATEST(0, c.TotalMsgCountRoot - sub.cnt)
		FROM (
			SELECT channelid, COUNT(*) AS cnt
			FROM Posts
			WHERE props::text LIKE $1
			GROUP BY channelid
		) sub
		WHERE c.Id = sub.channelid`, "%"+tagPrefix+"%")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to update channel counters: %v\n", err)
	}

	result, err := db.Exec(`DELETE FROM Posts WHERE props::text LIKE $1`, "%"+tagPrefix+"%")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error cleaning up: %v\n", err)
		os.Exit(1)
	}
	rows, _ := result.RowsAffected()
	fmt.Printf("Deleted %d perf-test posts.\n", rows)
}
