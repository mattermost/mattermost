package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	Username  string
	Email     string
	FirstName string
	LastName  string
	Nickname  string
	Roles     string
}

type Post struct {
	User    string
	Message string
	MinAgo  int // minutes ago from "now"
}

type Thread struct {
	User    string
	Message string
	MinAgo  int
	Replies []Post
}

func createPost(db *sql.DB, channelId, userId, message string, createAt int64) (string, error) {
	postId := generateId()
	_, err := db.Exec(`
		INSERT INTO posts (
			id, createat, updateat, deleteat, userid, channelid,
			rootid, originalid, message, type, props, hashtags,
			filenames, fileids, hasreactions, editat, ispinned, remoteid
		) VALUES (
			$1, $2, $2, 0, $3, $4,
			'', '', $5, '', '{}', '',
			'[]', '[]', false, 0, false, NULL
		)`,
		postId, createAt, userId, channelId, message,
	)
	return postId, err
}

func createReply(db *sql.DB, channelId, userId, rootId, message string, createAt int64) error {
	postId := generateId()
	_, err := db.Exec(`
		INSERT INTO posts (
			id, createat, updateat, deleteat, userid, channelid,
			rootid, originalid, message, type, props, hashtags,
			filenames, fileids, hasreactions, editat, ispinned, remoteid
		) VALUES (
			$1, $2, $2, 0, $3, $4,
			$5, $5, $6, '', '{}', '',
			'[]', '[]', false, 0, false, NULL
		)`,
		postId, createAt, userId, channelId, rootId, message,
	)
	return err
}

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: seed-demo-users <postgres-connection-string> [password]")
		fmt.Println("Example: seed-demo-users \"postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable\" demo123")
		os.Exit(1)
	}

	connStr := os.Args[1]
	password := "demo123"
	if len(os.Args) >= 3 {
		password = os.Args[2]
	}

	// Generate bcrypt hash
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		fmt.Printf("Error generating hash: %v\n", err)
		os.Exit(1)
	}

	// Connect to database
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		fmt.Printf("Error connecting to database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// Test connection
	if err := db.Ping(); err != nil {
		fmt.Printf("Error pinging database: %v\n", err)
		os.Exit(1)
	}

	now := time.Now().UnixNano() / int64(time.Millisecond)

	users := []User{
		{Username: "admin", Email: "admin@demo.local", FirstName: "Demo", LastName: "Admin", Nickname: "Admin", Roles: "system_admin system_user"},
		{Username: "alice", Email: "alice@demo.local", FirstName: "Alice", LastName: "Anderson", Nickname: "Alice", Roles: "system_user"},
		{Username: "bob", Email: "bob@demo.local", FirstName: "Bob", LastName: "Baker", Nickname: "Bob", Roles: "system_user"},
		{Username: "charlie", Email: "charlie@demo.local", FirstName: "Charlie", LastName: "Chen", Nickname: "Charlie", Roles: "system_user"},
		{Username: "dana", Email: "dana@demo.local", FirstName: "Dana", LastName: "Davis", Nickname: "Dana", Roles: "system_user"},
		{Username: "eve", Email: "eve@demo.local", FirstName: "Eve", LastName: "Edwards", Nickname: "Eve", Roles: "system_user"},
	}

	// Create users
	created := 0
	for _, u := range users {
		// Check if user exists
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)", u.Username).Scan(&exists)
		if err != nil {
			fmt.Printf("Error checking user %s: %v\n", u.Username, err)
			continue
		}

		if exists {
			fmt.Printf("User %s already exists, skipping\n", u.Username)
			continue
		}

		// Generate unique ID (26 char like Mattermost uses)
		id := generateId()

		// Insert user
		_, err = db.Exec(`
			INSERT INTO users (
				id, createat, updateat, deleteat, username, password,
				authdata, authservice, email, emailverified, nickname,
				firstname, lastname, roles, allowmarketing, props,
				notifyprops, lastpasswordupdate, lastpictureupdate,
				failedattempts, locale, mfaactive, mfasecret, position,
				timezone, remoteid
			) VALUES (
				$1, $2, $2, 0, $3, $4,
				NULL, '', $5, true, $6,
				$7, $8, $9, false, '{}',
				'{"channel":"true","comments":"never","desktop":"mention","desktop_sound":"true","email":"true","first_name":"false","mention_keys":"","push":"mention","push_status":"away"}',
				$2, 0, 0, 'en', false, '', '',
				'{"automaticTimezone":"","manualTimezone":"","useAutomaticTimezone":"true"}',
				NULL
			)`,
			id, now, u.Username, string(hash),
			u.Email, u.Nickname,
			u.FirstName, u.LastName, u.Roles,
		)

		if err != nil {
			fmt.Printf("Error creating user %s: %v\n", u.Username, err)
			continue
		}

		fmt.Printf("Created user: %s (%s)\n", u.Username, u.Email)
		created++
	}

	fmt.Printf("\nCreated %d users with password '%s'\n", created, password)

	// Create or get demo team
	var teamId string
	err = db.QueryRow("SELECT id FROM teams WHERE name = 'demo'").Scan(&teamId)
	if err == sql.ErrNoRows {
		// Create the team
		teamId = generateId()
		_, err = db.Exec(`
			INSERT INTO teams (
				id, createat, updateat, deleteat, displayname, name,
				description, email, type, companyname, alloweddomains,
				inviteid, allowopeninvite, lastteamiconupdate, schemeid,
				groupconstrained, cloudlimitsarchived
			) VALUES (
				$1, $2, $2, 0, 'Feature Demo', 'demo',
				'Showcase of Mattermost Extended features', '', 'O', '', '',
				$3, true, 0, NULL, NULL, false
			)`,
			teamId, now, generateId(),
		)
		if err != nil {
			fmt.Printf("Error creating team: %v\n", err)
			return
		}
		fmt.Println("Created team: demo (Feature Demo)")
	} else if err != nil {
		fmt.Printf("Error checking team: %v\n", err)
		return
	} else {
		// Team exists - ensure it has correct settings for demo mode
		_, err = db.Exec(`
			UPDATE teams SET
				displayname = 'Feature Demo',
				description = 'Showcase of Mattermost Extended features',
				type = 'O',
				allowopeninvite = true,
				deleteat = 0,
				updateat = $1
			WHERE id = $2`,
			now, teamId,
		)
		if err != nil {
			fmt.Printf("Error updating team: %v\n", err)
			return
		}
		fmt.Println("Updated team 'demo' with demo settings (allowopeninvite=true)")
	}

	// Create demo channels
	channels := []struct {
		name        string
		displayName string
		purpose     string
	}{
		{"town-square", "Town Square", "General discussion for the team"},
		{"off-topic", "Off-Topic", "Off-topic conversations"},
		{"general", "General", "General chat and feature testing"},
		{"status-demo", "Status Demo", "AccurateStatuses, NoOffline, Status Logs"},
		{"media-demo", "Media Demo", "ImageMulti, ImageSmaller, ImageCaptions, VideoEmbed"},
		{"youtube-demo", "YouTube Demo", "EmbedYoutube - Discord-style embeds"},
		{"threads-demo", "Threads Demo", "ThreadsInSidebar, CustomThreadNames"},
		{"encryption-demo", "Encryption Demo", "End-to-End Encryption"},
	}

	channelIds := make(map[string]string)
	for _, ch := range channels {
		var channelId string
		err = db.QueryRow("SELECT id FROM channels WHERE name = $1 AND teamid = $2", ch.name, teamId).Scan(&channelId)
		if err == sql.ErrNoRows {
			channelId = generateId()
			_, err = db.Exec(`
				INSERT INTO channels (
					id, createat, updateat, deleteat, teamid, type, displayname,
					name, header, purpose, lastpostat, totalmsgcount, extraupdateat,
					creatorid, schemeid, groupconstrained, shared, totalmsgcountroot,
					lastrootpostat
				) VALUES (
					$1, $2, $2, 0, $3, 'O', $4,
					$5, '', $6, $2, 0, 0,
					'', NULL, NULL, NULL, 0, $2
				)`,
				channelId, now, teamId, ch.displayName, ch.name, ch.purpose,
			)
			if err != nil {
				fmt.Printf("Error creating channel %s: %v\n", ch.name, err)
				continue
			}
			fmt.Printf("Created channel: %s\n", ch.displayName)
		} else if err != nil {
			fmt.Printf("Error checking channel %s: %v\n", ch.name, err)
			continue
		} else {
			fmt.Printf("Channel %s already exists\n", ch.displayName)
		}
		channelIds[ch.name] = channelId
	}

	// Add all users to the team and channels
	addedToTeam := 0
	addedToChannels := 0
	for _, u := range users {
		var userId string
		err := db.QueryRow("SELECT id FROM users WHERE username = $1", u.Username).Scan(&userId)
		if err != nil {
			fmt.Printf("Warning: user %s not found, skipping\n", u.Username)
			continue
		}

		// Add to team
		roles := "team_user"
		isAdmin := u.Username == "admin"
		if isAdmin {
			roles = "team_admin team_user"
		}

		result, err := db.Exec(`
			INSERT INTO teammembers (teamid, userid, roles, deleteat, schemeguest, schemeuser, schemeadmin, createat)
			VALUES ($1, $2, $3, 0, false, true, $4, $5)
			ON CONFLICT (teamid, userid) DO UPDATE SET
				deleteat = 0,
				schemeuser = true,
				roles = EXCLUDED.roles,
				schemeadmin = EXCLUDED.schemeadmin`,
			teamId, userId, roles, isAdmin, now,
		)
		if err != nil {
			fmt.Printf("Error adding %s to team: %v\n", u.Username, err)
		} else {
			rowsAffected, _ := result.RowsAffected()
			if rowsAffected > 0 {
				addedToTeam++
			}
		}

		// Add to default channels
		for chName, chId := range channelIds {
			chRoles := "channel_user"
			chIsAdmin := isAdmin
			if isAdmin {
				chRoles = "channel_admin channel_user"
			}

			_, err := db.Exec(`
				INSERT INTO channelmembers (channelid, userid, roles, lastviewedat, msgcount, mentioncount,
					notifyprops, lastupdateat, schemeuser, schemeadmin, schemeguest, mentioncountroot, msgcountroot, urgentmentioncount)
				VALUES ($1, $2, $3, $4, 0, 0,
					'{"desktop":"default","email":"default","ignore_channel_mentions":"default","mark_unread":"all","push":"default"}',
					$4, true, $5, false, 0, 0, 0)
				ON CONFLICT (channelid, userid) DO UPDATE SET
					lastupdateat = EXCLUDED.lastupdateat,
					schemeuser = true`,
				chId, userId, chRoles, now, chIsAdmin,
			)
			if err != nil {
				fmt.Printf("Error adding %s to channel %s: %v\n", u.Username, chName, err)
			} else {
				addedToChannels++
			}
		}

		// Create sidebar categories for this user+team
		createSidebarCategories(db, userId, teamId, now)
	}

	fmt.Printf("\nAdded %d users to demo team\n", addedToTeam)
	fmt.Printf("Created %d channel memberships\n", addedToChannels)
	fmt.Println("\nDemo data seeding complete!")
}

// createSidebarCategories creates the default sidebar categories for a user in a team
func createSidebarCategories(db *sql.DB, userId, teamId string, now int64) {
	categories := []struct {
		catType     string
		displayName string
		sortOrder   int
	}{
		{"favorites", "Favorites", 0},
		{"channels", "Channels", 10},
		{"direct_messages", "Direct Messages", 20},
	}

	for _, cat := range categories {
		catId := generateId()
		_, err := db.Exec(`
			INSERT INTO sidebarcategories (id, userid, teamid, sortorder, sorting, type, displayname, muted, collapsed)
			VALUES ($1, $2, $3, $4, 'alpha', $5, $6, false, false)
			ON CONFLICT (id) DO NOTHING`,
			catId, userId, teamId, cat.sortOrder, cat.catType, cat.displayName,
		)
		if err != nil {
			// Ignore errors - categories might already exist with different IDs
		}
	}
}

// generateId creates a 26-character ID similar to Mattermost's format
func generateId() string {
	b := make([]byte, 16)
	rand.Read(b)
	// Use base32 encoding without padding, lowercase
	id := strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))
	if len(id) > 26 {
		id = id[:26]
	}
	return id
}
