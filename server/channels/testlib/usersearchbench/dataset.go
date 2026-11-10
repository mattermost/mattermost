// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package usersearchbench seeds a deterministic, production-shaped user
// directory for the user search benchmarks and reports database time per
// operation through pg_stat_statements.
package usersearchbench

import (
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/timezones"
)

// Config sizes the seeded dataset. Override the defaults with
// MM_USERSEARCH_BENCH_USERS, MM_USERSEARCH_BENCH_TEAMS and
// MM_USERSEARCH_BENCH_CHANNELS_PER_TEAM.
type Config struct {
	Users           int
	Teams           int
	ChannelsPerTeam int
}

// Share of all users, in permille, that belong to each team. Teams past the
// end of the list use the last value.
var teamPermille = []int{970, 400, 200, 100, 50}

// Share of a team's members, in permille, that belong to each channel after
// town-square and off-topic, which every team member joins.
var channelPermilleCycle = []int{300, 100, 30, 10, 3, 1}

const (
	townSquareIndex   = 0
	largeChannelIndex = 2
	mediumChanIndex   = 3
	smallChannelIndex = 7
)

// The flags below are evaluated per generated user index i. Keeping them as
// SQL fragments guarantees that Users, TeamMembers and ChannelMembers agree.
const (
	userIDSQL     = `substr(md5('usersearchbench-user-' || i), 1, 26)`
	isBotSQL      = `(abs(hashint8extended(i, 101)) % 100 = 0)`
	isGuestSQL    = `(NOT ` + isBotSQL + ` AND abs(hashint8extended(i, 102)) % 50 = 0)`
	isAdminSQL    = `(NOT ` + isBotSQL + ` AND abs(hashint8extended(i, 103)) % 1000 = 0)`
	isInactiveSQL = `(abs(hashint8extended(i, 104)) % 20 = 0)`
	baseCreateAt  = int64(1600000000000)
)

func ConfigFromEnv(tb testing.TB) Config {
	cfg := Config{
		Users:           envInt(tb, "MM_USERSEARCH_BENCH_USERS", 100_000),
		Teams:           envInt(tb, "MM_USERSEARCH_BENCH_TEAMS", 5),
		ChannelsPerTeam: envInt(tb, "MM_USERSEARCH_BENCH_CHANNELS_PER_TEAM", 50),
	}
	require.GreaterOrEqual(tb, cfg.Users, 1000, "MM_USERSEARCH_BENCH_USERS")
	require.GreaterOrEqual(tb, cfg.Teams, 2, "MM_USERSEARCH_BENCH_TEAMS")
	require.Greater(tb, cfg.ChannelsPerTeam, smallChannelIndex, "MM_USERSEARCH_BENCH_CHANNELS_PER_TEAM")
	return cfg
}

func envInt(tb testing.TB, name string, def int) int {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(strings.ReplaceAll(v, "_", ""))
	require.NoError(tb, err, name)
	return n
}

// Term is a search term shape exercised by every benchmarked scope.
type Term struct {
	Name  string
	Value string
}

// Dataset describes what Seed created. All channels live in the largest team.
type Dataset struct {
	Config          Config
	TeamIDs         []string
	TownSquareID    string
	LargeChannelID  string
	MediumChannelID string
	SmallChannelID  string
	Sample          *model.User
}

// LargeTeamID is the company-wide team, holding ~97% of users.
func (d *Dataset) LargeTeamID() string { return d.TeamIDs[0] }

// SmallTeamID is the smallest team, holding ~5% of users.
func (d *Dataset) SmallTeamID() string { return d.TeamIDs[len(d.TeamIDs)-1] }

// AllTerms covers every term shape. Exact-match terms come from Sample, an
// active human member of the small channel.
func (d *Dataset) AllTerms() []Term {
	return []Term{
		{"short1", "a"},
		{"short2", "ma"},
		{"prefix", strings.ToLower(d.Sample.Username[:4])},
		{"username", d.Sample.Username},
		{"fullname", d.Sample.FirstName + " " + d.Sample.LastName},
		{"nickname", d.Sample.Nickname},
		{"email", d.Sample.Email},
		{"unicode", "José"},
		{"nomatch", "zzxqjv"},
	}
}

// CoreTerms is the subset used for secondary scopes to bound run time.
func (d *Dataset) CoreTerms() []Term {
	return d.Terms("short1", "prefix", "fullname", "nomatch")
}

// Terms returns the named terms from AllTerms, in AllTerms order.
func (d *Dataset) Terms(names ...string) []Term {
	var terms []Term
	for _, t := range d.AllTerms() {
		if slices.Contains(names, t.Name) {
			terms = append(terms, t)
		}
	}
	return terms
}

func TeamID(k int) string { return md5ID(fmt.Sprintf("usersearchbench-team-%d", k)) }

func ChannelID(k, j int) string { return md5ID(fmt.Sprintf("usersearchbench-channel-%d-%d", k, j)) }

func md5ID(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])[:26]
}

var printConfigOnce sync.Once

// Seed inserts the dataset with set-based SQL, so the same rows are produced
// on every run, and analyzes the touched tables so plans are stable.
func Seed(tb testing.TB, db *sql.DB, cfg Config) *Dataset {
	start := time.Now()

	seedUsers(tb, db, cfg)
	seedTeamsAndChannels(tb, db, cfg)
	seedMemberships(tb, db, cfg)

	for _, table := range []string{"Users", "Bots", "Teams", "TeamMembers", "Channels", "ChannelMembers"} {
		// Parallel vacuum allocates maintenance_work_mem in /dev/shm, which is only 64MB in Docker.
		_, err := db.Exec("VACUUM (ANALYZE, PARALLEL 0) " + table)
		require.NoError(tb, err)
	}

	data := &Dataset{
		Config:          cfg,
		TownSquareID:    ChannelID(0, townSquareIndex),
		LargeChannelID:  ChannelID(0, largeChannelIndex),
		MediumChannelID: ChannelID(0, mediumChanIndex),
		SmallChannelID:  ChannelID(0, smallChannelIndex),
		Sample:          sampleUser(tb, db, cfg),
	}
	for k := range cfg.Teams {
		data.TeamIDs = append(data.TeamIDs, TeamID(k))
	}

	tb.Logf("usersearchbench: seeded %d users, %d teams, %d channels/team in %s", cfg.Users, cfg.Teams, cfg.ChannelsPerTeam, time.Since(start).Round(time.Millisecond))

	// benchstat reads "key: value" lines as configuration, which keeps results
	// from differently sized datasets in separate tables.
	printConfigOnce.Do(func() {
		fmt.Printf("usersearch-users: %d\nusersearch-teams: %d\nusersearch-channels-per-team: %d\n", cfg.Users, cfg.Teams, cfg.ChannelsPerTeam)
	})

	return data
}

var (
	firstNames = [][2]string{
		{"James", "james"}, {"Mary", "mary"}, {"Michael", "michael"}, {"Patricia", "patricia"},
		{"John", "john"}, {"Jennifer", "jennifer"}, {"Robert", "robert"}, {"Linda", "linda"},
		{"David", "david"}, {"Elizabeth", "elizabeth"}, {"William", "william"}, {"Barbara", "barbara"},
		{"Maria", "maria"}, {"José", "jose"}, {"Richard", "richard"}, {"Susan", "susan"},
		{"Joseph", "joseph"}, {"Jessica", "jessica"}, {"Thomas", "thomas"}, {"Sarah", "sarah"},
		{"Mohammed", "mohammed"}, {"Fatima", "fatima"}, {"Wei", "wei"}, {"Priya", "priya"},
		{"Christopher", "christopher"}, {"Karen", "karen"}, {"Daniel", "daniel"}, {"Nancy", "nancy"},
		{"Juan", "juan"}, {"Ana", "ana"}, {"Ahmed", "ahmed"}, {"Aisha", "aisha"},
		{"Matthew", "matthew"}, {"Lisa", "lisa"}, {"Anthony", "anthony"}, {"Sandra", "sandra"},
		{"Hiroshi", "hiroshi"}, {"Yuki", "yuki"}, {"Arjun", "arjun"}, {"Olumide", "olumide"},
		{"Søren", "soren"}, {"Zoë", "zoe"}, {"Jürgen", "jurgen"}, {"François", "francois"},
		{"Łukasz", "lukasz"}, {"Siobhán", "siobhan"}, {"Björn", "bjorn"}, {"Ömer", "omer"},
		{"Иван", "ivan"}, {"Мария", "mariya"}, {"王芳", "wangfang"}, {"李娜", "lina"},
		{"Kwame", "kwame"}, {"Ngozi", "ngozi"}, {"Carmen", "carmen"}, {"Luis", "luis"},
		{"Mark", "mark"}, {"Margaret", "margaret"}, {"Steven", "steven"}, {"Emily", "emily"},
	}
	lastNames = [][2]string{
		{"Smith", "smith"}, {"Johnson", "johnson"}, {"Williams", "williams"}, {"Brown", "brown"},
		{"Jones", "jones"}, {"Garcia", "garcia"}, {"Miller", "miller"}, {"Davis", "davis"},
		{"Rodriguez", "rodriguez"}, {"Martinez", "martinez"}, {"Hernandez", "hernandez"}, {"Lopez", "lopez"},
		{"Nguyen", "nguyen"}, {"Patel", "patel"}, {"Kim", "kim"}, {"Singh", "singh"},
		{"Gonzalez", "gonzalez"}, {"Wilson", "wilson"}, {"Anderson", "anderson"}, {"Taylor", "taylor"},
		{"Thomas", "thomas"}, {"Moore", "moore"}, {"Jackson", "jackson"}, {"Martin", "martin"},
		{"Lee", "lee"}, {"Perez", "perez"}, {"Thompson", "thompson"}, {"White", "white"},
		{"Müller", "muller"}, {"Schröder", "schroder"}, {"Øvergaard", "overgaard"}, {"Kowalczyk", "kowalczyk"},
		{"Nováková", "novakova"}, {"Yılmaz", "yilmaz"}, {"Şahin", "sahin"}, {"Иванов", "ivanov"},
		{"Петрова", "petrova"}, {"王", "wang"}, {"李", "li"}, {"张", "zhang"},
		{"Tanaka", "tanaka"}, {"Suzuki", "suzuki"}, {"Park", "park"}, {"Okafor", "okafor"},
		{"Mensah", "mensah"}, {"O'Brien", "obrien"}, {"Harris", "harris"}, {"Clark", "clark"},
		{"Lewis", "lewis"}, {"Robinson", "robinson"}, {"Walker", "walker"}, {"Young", "young"},
		{"Allen", "allen"}, {"King", "king"}, {"Wright", "wright"}, {"Scott", "scott"},
	}
	nicknames = []string{
		"Jim", "Mo", "Ace", "Doc", "Sunny", "Kiki", "Tex", "Chip", "Skip", "Red",
		"Sparky", "Ziggy", "Bea", "Jojo", "Nico", "Pepe", "Tito", "Lulu", "Mimi", "Coco",
		"Rocky", "Duke", "Buzz", "Champ", "Pixel", "Señor", "Kōji", "Mavi", "Lolo", "Dex",
	}
	emailDomains = []string{"example.com", "corp.example.com", "eng.example.com", "partner.example.org", "contractor.example.net"}
	positions    = []string{"Software Engineer", "Senior Software Engineer", "Product Manager", "Designer", "Account Executive", "Support Engineer", "Engineering Manager", "Data Scientist", ""}
	botNames     = []string{"github", "jira", "jenkins", "standup", "remind", "polls", "zoom", "gitlab", "pagerduty", "sentry", "datadog", "feedback"}
	teamNames    = []string{"Everyone", "Engineering", "Sales", "Support", "Leadership"}
)

func column(pairs [][2]string, idx int) []string {
	out := make([]string, len(pairs))
	for i, p := range pairs {
		out[i] = p[idx]
	}
	return out
}

func mustJSON(tb testing.TB, v any) string {
	b, err := json.Marshal(v)
	require.NoError(tb, err)
	return string(b)
}

func seedUsers(tb testing.TB, db *sql.DB, cfg Config) {
	u := &model.User{}
	u.SetDefaultNotifications()

	// Names follow a skewed distribution so common names produce many matches
	// while rare ones produce a handful, as in a real directory.
	query := `
WITH s AS (
	SELECT i,
		` + isBotSQL + ` AS is_bot,
		` + isGuestSQL + ` AS is_guest,
		` + isAdminSQL + ` AS is_admin,
		` + isInactiveSQL + ` AS is_inactive,
		1 + floor(cardinality($2::text[]) * power((abs(hashint8extended(i, 11)) % 1000000) / 1000000.0, 1.3))::int AS fi,
		1 + floor(cardinality($4::text[]) * power((abs(hashint8extended(i, 12)) % 1000000) / 1000000.0, 1.3))::int AS li,
		1 + abs(hashint8extended(i, 13)) % cardinality($6::text[]) AS ni,
		abs(hashint8extended(i, 14)) % 10 < 3 AS has_nickname,
		1 + abs(hashint8extended(i, 15)) % cardinality($7::text[]) AS di,
		1 + abs(hashint8extended(i, 16)) % cardinality($8::text[]) AS pi,
		1 + abs(hashint8extended(i, 17)) % cardinality($9::text[]) AS bi,
		$10::bigint + i::bigint * 60000 AS createat
	FROM generate_series(0, $1::int - 1) AS i
), n AS (
	SELECT s.*,
		CASE
			WHEN is_bot THEN ($9::text[])[bi] || '-bot' || i
			WHEN i % 4 = 0 THEN ($3::text[])[fi] || '.' || ($5::text[])[li] || i
			WHEN i % 4 = 1 THEN left(($3::text[])[fi], 1) || ($5::text[])[li] || i
			WHEN i % 4 = 2 THEN ($3::text[])[fi] || '_' || left(($5::text[])[li], 1) || i
			ELSE ($5::text[])[li] || '.' || ($3::text[])[fi] || i
		END AS username
	FROM s
)
INSERT INTO Users (Id, CreateAt, UpdateAt, DeleteAt, Username, Password, AuthData, AuthService, Email,
	EmailVerified, Nickname, FirstName, LastName, Position, Roles, AllowMarketing, Props, NotifyProps,
	LastPasswordUpdate, LastPictureUpdate, FailedAttempts, Locale, Timezone, MfaActive, MfaSecret,
	MfaUsedTimestamps, RemoteId, LastLogin)
SELECT
	` + userIDSQL + `,
	createat,
	createat,
	CASE WHEN is_inactive THEN createat + 86400000 ELSE 0 END,
	username,
	'$2a$10$usersearchbenchusersearchbenchusersearchbenchuserse',
	NULL,
	'',
	CASE WHEN is_bot THEN username || '@localhost' ELSE username || '@' || ($7::text[])[di] END,
	true,
	CASE WHEN is_bot THEN initcap(($9::text[])[bi]) || ' Bot' WHEN has_nickname THEN ($6::text[])[ni] ELSE '' END,
	CASE WHEN is_bot THEN '' ELSE ($2::text[])[fi] END,
	CASE WHEN is_bot THEN '' ELSE ($4::text[])[li] END,
	CASE WHEN is_bot THEN '' ELSE ($8::text[])[pi] END,
	CASE WHEN is_guest THEN 'system_guest' WHEN is_admin THEN 'system_user system_admin' ELSE 'system_user' END,
	false,
	'{}'::jsonb,
	$11::jsonb,
	createat,
	0,
	0,
	'en',
	$12::jsonb,
	false,
	'',
	'[]'::jsonb,
	NULL,
	CASE WHEN is_inactive THEN 0 ELSE createat + 3600000 END
FROM n`

	_, err := db.Exec(query,
		cfg.Users,
		pq.Array(column(firstNames, 0)), pq.Array(column(firstNames, 1)),
		pq.Array(column(lastNames, 0)), pq.Array(column(lastNames, 1)),
		pq.Array(nicknames), pq.Array(emailDomains), pq.Array(positions), pq.Array(botNames),
		baseCreateAt,
		mustJSON(tb, u.NotifyProps), mustJSON(tb, timezones.DefaultUserTimezone()),
	)
	require.NoError(tb, err, "seed users")

	_, err = db.Exec(`
INSERT INTO Bots (UserId, Description, OwnerId, CreateAt, UpdateAt, DeleteAt, LastIconUpdate)
SELECT `+userIDSQL+`, 'Integration bot', 'usersearchbench', $2::bigint, $2::bigint, 0, 0
FROM generate_series(0, $1::int - 1) AS i
WHERE `+isBotSQL, cfg.Users, baseCreateAt)
	require.NoError(tb, err, "seed bots")
}

func seedTeamsAndChannels(tb testing.TB, db *sql.DB, cfg Config) {
	for k := range cfg.Teams {
		displayName := fmt.Sprintf("Team %d", k)
		if k < len(teamNames) {
			displayName = teamNames[k]
		}
		_, err := db.Exec(`
INSERT INTO Teams (Id, CreateAt, UpdateAt, DeleteAt, DisplayName, Name, Description, Email, Type,
	CompanyName, AllowedDomains, InviteId, SchemeId, AllowOpenInvite, LastTeamIconUpdate, GroupConstrained,
	CloudLimitsArchived)
VALUES ($1, $2, $2, 0, $3, $4, '', $5, 'O', '', '', $6, NULL, true, 0, false, false)`,
			TeamID(k), baseCreateAt, displayName, fmt.Sprintf("usersearchbench-team-%d", k),
			fmt.Sprintf("team%d@example.com", k), md5ID(fmt.Sprintf("usersearchbench-invite-%d", k)))
		require.NoError(tb, err, "seed team")

		ids := make([]string, cfg.ChannelsPerTeam)
		names := make([]string, cfg.ChannelsPerTeam)
		displayNames := make([]string, cfg.ChannelsPerTeam)
		types := make([]string, cfg.ChannelsPerTeam)
		for j := range cfg.ChannelsPerTeam {
			ids[j] = ChannelID(k, j)
			types[j] = string(model.ChannelTypeOpen)
			switch j {
			case 0:
				names[j], displayNames[j] = model.DefaultChannelName, "Town Square"
			case 1:
				names[j], displayNames[j] = "off-topic", "Off-Topic"
			default:
				names[j], displayNames[j] = fmt.Sprintf("channel-%d", j), fmt.Sprintf("Channel %d", j)
				if j%3 == 0 {
					types[j] = string(model.ChannelTypePrivate)
				}
			}
		}
		_, err = db.Exec(`
INSERT INTO Channels (Id, CreateAt, UpdateAt, DeleteAt, TeamId, Type, DisplayName, Name, Header, Purpose,
	LastPostAt, TotalMsgCount, ExtraUpdateAt, CreatorId, SchemeId, GroupConstrained, Shared,
	TotalMsgCountRoot, LastRootPostAt)
SELECT c.id, $2::bigint, $2::bigint, 0, $1, c.type::channel_type, c.display_name, c.name, '', '',
	$2::bigint, 0, 0, '', NULL, false, false, 0, $2::bigint
FROM unnest($3::text[], $4::text[], $5::text[], $6::text[]) AS c(id, name, display_name, type)`,
			TeamID(k), baseCreateAt, pq.Array(ids), pq.Array(names), pq.Array(displayNames), pq.Array(types))
		require.NoError(tb, err, "seed channels")
	}
}

func seedMemberships(tb testing.TB, db *sql.DB, cfg Config) {
	notifyProps := mustJSON(tb, model.GetDefaultChannelNotifyProps())

	for k := range cfg.Teams {
		permille := teamPermille[min(k, len(teamPermille)-1)]
		teamSalt := 1000 + k
		isMember := fmt.Sprintf("(abs(hashint8extended(i, %d)) %% 1000 < %d)", teamSalt, permille)
		hasLeft := fmt.Sprintf("(abs(hashint8extended(i, %d)) %% 50 = 0)", teamSalt+500)

		_, err := db.Exec(`
INSERT INTO TeamMembers (TeamId, UserId, Roles, DeleteAt, SchemeUser, SchemeAdmin, SchemeGuest, CreateAt)
SELECT $1, `+userIDSQL+`, '',
	CASE WHEN `+hasLeft+` THEN $3::bigint + 86400000 ELSE 0 END,
	NOT `+isGuestSQL+`, `+isAdminSQL+`, `+isGuestSQL+`, $3::bigint
FROM generate_series(0, $2::int - 1) AS i
WHERE `+isMember, TeamID(k), cfg.Users, baseCreateAt)
		require.NoError(tb, err, "seed team members")

		ids := make([]string, cfg.ChannelsPerTeam)
		salts := make([]int64, cfg.ChannelsPerTeam)
		shares := make([]int64, cfg.ChannelsPerTeam)
		for j := range cfg.ChannelsPerTeam {
			ids[j] = ChannelID(k, j)
			salts[j] = int64(100000 + k*1000 + j)
			shares[j] = 1000
			if j >= 2 {
				shares[j] = int64(channelPermilleCycle[(j-2)%len(channelPermilleCycle)])
			}
		}
		_, err = db.Exec(`
INSERT INTO ChannelMembers (ChannelId, UserId, Roles, LastViewedAt, MsgCount, MentionCount, NotifyProps,
	LastUpdateAt, SchemeUser, SchemeAdmin, SchemeGuest, MentionCountRoot, MsgCountRoot, UrgentMentionCount)
SELECT c.id, `+userIDSQL+`, '', $3::bigint, 0, 0, $4::jsonb, $3::bigint,
	NOT `+isGuestSQL+`, false, `+isGuestSQL+`, 0, 0, 0
FROM generate_series(0, $2::int - 1) AS i
CROSS JOIN unnest($1::text[], $5::bigint[], $6::bigint[]) AS c(id, salt, share)
WHERE `+isMember+` AND NOT `+hasLeft+`
	AND (c.share >= 1000 OR abs(hashint8extended(i, c.salt)) % 1000 < c.share)`,
			pq.Array(ids), cfg.Users, baseCreateAt, notifyProps, pq.Array(salts), pq.Array(shares))
		require.NoError(tb, err, "seed channel members")
	}
}

// sampleUser picks a deterministic active seeded human with a nickname and an
// ASCII first name, preferring members of the small channel so exact-match
// terms hit in every scope.
func sampleUser(tb testing.TB, db *sql.DB, cfg Config) *model.User {
	var u model.User
	err := db.QueryRow(`
SELECT u.Id, u.Username, u.FirstName, u.LastName, u.Nickname, u.Email
FROM Users u
LEFT JOIN ChannelMembers cm ON cm.UserId = u.Id AND cm.ChannelId = $1
LEFT JOIN Bots b ON b.UserId = u.Id
WHERE u.CreateAt BETWEEN $2::bigint AND $3::bigint
	AND u.DeleteAt = 0 AND b.UserId IS NULL AND u.Roles = 'system_user'
	AND u.Nickname <> '' AND u.FirstName ~ '^[A-Za-z]+$' AND length(u.Username) >= 4
ORDER BY (cm.UserId IS NOT NULL) DESC, u.Id
LIMIT 1`, ChannelID(0, smallChannelIndex), baseCreateAt, baseCreateAt+int64(cfg.Users)*60000).
		Scan(&u.Id, &u.Username, &u.FirstName, &u.LastName, &u.Nickname, &u.Email)
	require.NoError(tb, err, "pick sample user")
	return &u
}
