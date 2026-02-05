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

	// Demo conversation posts (Discord-style casual chat)
	// MinAgo is minutes before "now" - higher = older
	demoConversations := map[string][]Post{
		"general": {
			{User: "admin", Message: "welcome everyone to the new server :tada:", MinAgo: 200},
			{User: "alice", Message: "ayo", MinAgo: 199},
			{User: "bob", Message: "finally we're here", MinAgo: 198},
			{User: "charlie", Message: "this place looks clean", MinAgo: 197},
			{User: "dana", Message: "glad to be out of the old one lol", MinAgo: 196},
			{User: "eve", Message: "the old one was so cluttered, this is much better", MinAgo: 195},
			{User: "alice", Message: "wait where's the deleted message placeholder? did it actually vanish?", MinAgo: 194},
			{User: "admin", Message: "yeah enabled HideDeletedPlaceholder. way less ghosting in the chat", MinAgo: 193},
			{User: "bob", Message: "big W", MinAgo: 192},
			{User: "charlie", Message: "also noticed the sidebar settings are different now", MinAgo: 191},
			{User: "dana", Message: "sidebar looks way better with the custom settings, actually readable now", MinAgo: 190},
			{User: "eve", Message: "true true", MinAgo: 189},
			{User: "admin", Message: "feel free to test around in the other channels, everything is live", MinAgo: 188},
			{User: "alice", Message: "bet :fire:", MinAgo: 187},
		},
		"status-demo": {
			{User: "alice", Message: "yo charlie why you always online lol", MinAgo: 180},
			{User: "charlie", Message: "accurate statuses baby. no more \"away\" while i'm literally typing", MinAgo: 179},
			{User: "bob", Message: "wait is NoOffline on?", MinAgo: 178},
			{User: "alice", Message: "yeah admin enabled it", MinAgo: 177},
			{User: "bob", Message: "sick so we can see who's actually around even if they try to hide :eyes:", MinAgo: 176},
			{User: "dana", Message: "status logs are showing everything too", MinAgo: 175},
			{User: "eve", Message: "wait what logs?", MinAgo: 174},
			{User: "dana", Message: "the transition logs in the console, helps with debugging the heartbeat", MinAgo: 173},
			{User: "charlie", Message: "no more fake away status while i'm gaming in the background", MinAgo: 172},
			{User: "alice", Message: "finally. the old heartbeat was so laggy", MinAgo: 171},
			{User: "bob", Message: "literally. it would show me away while i was in the middle of a call", MinAgo: 170},
			{User: "charlie", Message: "same lol", MinAgo: 169},
			{User: "admin", Message: "testing the new transition manager, seems solid so far", MinAgo: 168},
			{User: "alice", Message: "huge improvement honestly", MinAgo: 167},
			{User: "bob", Message: "massive", MinAgo: 166},
		},
		"media-demo": {
			{User: "alice", Message: "check these out, the multi-upload is working", MinAgo: 155},
			{User: "bob", Message: "wait multiple images in one post? that's actually huge", MinAgo: 153},
			{User: "charlie", Message: "they look smaller too, not taking up the whole screen", MinAgo: 152},
			{User: "dana", Message: "yeah ImageSmaller is a life saver for my vertical monitor", MinAgo: 151},
			{User: "eve", Message: "the captions look good too", MinAgo: 150},
			{User: "alice", Message: "![test image](cat.jpg \"cyberpunk vibes\")", MinAgo: 149},
			{User: "bob", Message: "clean af", MinAgo: 148},
			{User: "charlie", Message: "does video embedding work yet?", MinAgo: 147},
			{User: "dana", Message: "let's see", MinAgo: 146},
			{User: "bob", Message: "yup it embeds perfectly", MinAgo: 144},
			{User: "alice", Message: "it's finally a real chat app lol :fire:", MinAgo: 143},
		},
		"youtube-demo": {
			{User: "alice", Message: "guys look at this lol", MinAgo: 135},
			{User: "alice", Message: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", MinAgo: 134},
			{User: "bob", Message: "i knew it. i saw the thumbnail and still clicked :skull:", MinAgo: 133},
			{User: "charlie", Message: "the embed is actually fast now", MinAgo: 132},
			{User: "dana", Message: "check this out https://www.youtube.com/watch?v=9bZkp7q19f0", MinAgo: 131},
			{User: "eve", Message: "psy? what year is it lol", MinAgo: 130},
			{User: "dana", Message: "classic never dies", MinAgo: 129},
			{User: "bob", Message: "the youtube embed looks way better than the generic one", MinAgo: 128},
			{User: "alice", Message: "https://www.youtube.com/watch?v=jNQXAC9IVRw", MinAgo: 127},
			{User: "charlie", Message: "first youtube video ever, a classic", MinAgo: 126},
			{User: "eve", Message: "facts", MinAgo: 125},
		},
		"encryption-demo": {
			{User: "admin", Message: "encryption is now live in this channel", MinAgo: 95},
			{User: "alice", Message: "wait so admin can't even read our messages?", MinAgo: 94},
			{User: "bob", Message: "nope, that's the point of e2e :lock:", MinAgo: 93},
			{User: "charlie", Message: "how do we know it's working?", MinAgo: 92},
			{User: "dana", Message: "check the recipient list in the editor, it shows who has the keys", MinAgo: 91},
			{User: "eve", Message: "oh i see it, shows exactly who can decrypt", MinAgo: 90},
			{User: "alice", Message: "this is actually huge for privacy", MinAgo: 89},
			{User: "bob", Message: "finally i can talk about [REDACTED] lol", MinAgo: 88},
			{User: "charlie", Message: "the encryption mode UI looks really clean too", MinAgo: 87},
			{User: "dana", Message: "glad we finally got this implemented", MinAgo: 86},
			{User: "admin", Message: "stay safe out there", MinAgo: 85},
		},
	}

	// Threaded conversations for threads-demo channel
	demoThreads := []Thread{
		{
			User:    "alice",
			Message: "starting a thread for the new project planning",
			MinAgo:  120,
			Replies: []Post{
				{User: "bob", Message: "i'm in", MinAgo: 119},
				{User: "charlie", Message: "what's the plan?", MinAgo: 118},
				{User: "alice", Message: "check the sidebar, it should show up there now", MinAgo: 117},
				{User: "dana", Message: "oh yeah ThreadsInSidebar is clutch, i can see all of them", MinAgo: 116},
				{User: "eve", Message: "can we rename these?", MinAgo: 115},
				{User: "alice", Message: "yeah i just renamed it to \"Project X Planning\"", MinAgo: 114},
				{User: "bob", Message: "sick, custom names make it so much easier to find stuff", MinAgo: 113},
				{User: "charlie", Message: "actually organized for once :thumbsup:", MinAgo: 112},
			},
		},
		{
			User:    "bob",
			Message: "anyone want to play val later?",
			MinAgo:  110,
			Replies: []Post{
				{User: "dana", Message: "me", MinAgo: 109},
				{User: "eve", Message: "i'm down", MinAgo: 108},
				{User: "charlie", Message: "count me in", MinAgo: 107},
				{User: "alice", Message: "i'll be on in an hour", MinAgo: 106},
				{User: "bob", Message: "renamed thread to \"Val 5-stack\" so people can find it", MinAgo: 105},
				{User: "dana", Message: "perfect", MinAgo: 104},
			},
		},
	}

	// Suppress unused variable warnings (will be used in post seeding)
	_ = demoConversations
	_ = demoThreads

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
