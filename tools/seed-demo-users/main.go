package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/base32"
	"encoding/json"
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

type Channel struct {
	Name        string
	DisplayName string
	Purpose     string
	Icon        string // e.g., "mdi:rocket" - stored in props.custom_icon
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

	// =========================================================================
	// DEMO CHANNELS - Gaming server with custom icons
	// =========================================================================
	// Icon format: "library:icon-name" (e.g., "mdi:rocket", "lucide:code")
	// Supported libraries: mdi, lucide, tabler, feather, fontawesome, simple
	demoChannels := []Channel{
		// Default channels
		{Name: "town-square", DisplayName: "Town Square", Purpose: "main chat", Icon: ""},
		{Name: "off-topic", DisplayName: "Off-Topic", Purpose: "random stuff", Icon: ""},

		// Gaming channels with icons
		{Name: "general", DisplayName: "general", Purpose: "main hangout", Icon: "mdi:chat"},
		{Name: "valorant", DisplayName: "valorant", Purpose: "5 stack when", Icon: "mdi:gamepad-variant"},
		{Name: "minecraft", DisplayName: "minecraft", Purpose: "server coords and builds", Icon: "mdi:minecraft"},
		{Name: "music", DisplayName: "music", Purpose: "share bangers", Icon: "mdi:music"},
		{Name: "memes", DisplayName: "memes", Purpose: "quality content only", Icon: "mdi:emoticon-lol"},
		{Name: "clips", DisplayName: "clips", Purpose: "gaming clips and highlights", Icon: "simple:youtube"},
		{Name: "tech", DisplayName: "tech", Purpose: "pc builds and tech help", Icon: "mdi:desktop-tower"},
		{Name: "secret", DisplayName: "secret", Purpose: "encrypted chat :eyes:", Icon: "mdi:lock"},
	}

	// =========================================================================
	// DEMO CONVERSATIONS - Discord-style gaming chat
	// =========================================================================
	demoConversations := map[string][]Post{
		// General - main hangout
		"general": {
			{User: "admin", Message: "yo welcome to the server", MinAgo: 300},
			{User: "alice", Message: "lets gooo", MinAgo: 299},
			{User: "bob", Message: "finally a chat app that doesnt suck", MinAgo: 298},
			{User: "charlie", Message: "the icons in the sidebar are sick", MinAgo: 297},
			{User: "dana", Message: "wait you can customize channel icons??", MinAgo: 296},
			{User: "eve", Message: "yeah click the settings on any channel", MinAgo: 295},
			{User: "alice", Message: "theres like 30k icons to choose from lmao", MinAgo: 294},
			{User: "bob", Message: "ok thats actually insane", MinAgo: 293},
			{User: "charlie", Message: "the minecraft one is perfect :chef_kiss:", MinAgo: 292},
			{User: "admin", Message: "check out #clips too, youtube embeds look way better now", MinAgo: 290},
			{User: "dana", Message: "ooh discord style?", MinAgo: 289},
			{User: "admin", Message: "yep with the red bar and everything", MinAgo: 288},
		},

		// Valorant - gaming
		"valorant": {
			{User: "bob", Message: "5 stack?", MinAgo: 200},
			{User: "alice", Message: "im down", MinAgo: 199},
			{User: "charlie", Message: "same", MinAgo: 198},
			{User: "dana", Message: "need 2 more", MinAgo: 197},
			{User: "eve", Message: "im in", MinAgo: 196},
			{User: "bob", Message: "one more", MinAgo: 195},
			{User: "admin", Message: "i can play", MinAgo: 194},
			{User: "alice", Message: "lets go full send", MinAgo: 193},
			{User: "charlie", Message: "what rank we playing", MinAgo: 192},
			{User: "bob", Message: "gold lobby", MinAgo: 191},
			{User: "dana", Message: "perfect", MinAgo: 190},
			{User: "eve", Message: "im hardstuck silver but ill try lol", MinAgo: 189},
			{User: "alice", Message: "dw we got you", MinAgo: 188},
			{User: "bob", Message: "gg ez clap", MinAgo: 150},
			{User: "charlie", Message: "that last round was insane", MinAgo: 149},
			{User: "dana", Message: "eve popped off fr", MinAgo: 148},
			{User: "eve", Message: ":flushed:", MinAgo: 147},
		},

		// Minecraft
		"minecraft": {
			{User: "charlie", Message: "server ip?", MinAgo: 180},
			{User: "admin", Message: "mc.demo.local", MinAgo: 179},
			{User: "alice", Message: "is it modded", MinAgo: 178},
			{User: "admin", Message: "vanilla for now, might add create mod later", MinAgo: 177},
			{User: "bob", Message: "create mod is goated", MinAgo: 176},
			{User: "dana", Message: "anyone have spare diamonds", MinAgo: 175},
			{User: "eve", Message: "bro just mine lol", MinAgo: 174},
			{User: "dana", Message: ":skull:", MinAgo: 173},
			{User: "charlie", Message: "coords to the stronghold?", MinAgo: 172},
			{User: "alice", Message: "-1847 34 892", MinAgo: 171},
			{User: "charlie", Message: "ty", MinAgo: 170},
			{User: "bob", Message: "dont grief my house pls", MinAgo: 165},
			{User: "eve", Message: "no promises :smiling_imp:", MinAgo: 164},
			{User: "bob", Message: "EVE", MinAgo: 163},
		},

		// Music - share bangers
		"music": {
			{User: "dana", Message: "this song is stuck in my head", MinAgo: 160},
			{User: "dana", Message: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", MinAgo: 159},
			{User: "alice", Message: "i hate you", MinAgo: 158},
			{User: "bob", Message: "LMAOOO", MinAgo: 157},
			{User: "charlie", Message: "got me good ngl", MinAgo: 156},
			{User: "eve", Message: "ok but actually heres a banger", MinAgo: 155},
			{User: "eve", Message: "https://www.youtube.com/watch?v=9bZkp7q19f0", MinAgo: 154},
			{User: "dana", Message: "GANGNAM STYLE IN 2024???", MinAgo: 153},
			{User: "eve", Message: "its a classic", MinAgo: 152},
			{User: "alice", Message: "the youtube embeds look so clean btw", MinAgo: 151},
			{User: "bob", Message: "fr the red bar is chef kiss", MinAgo: 150},
			{User: "charlie", Message: "discord vibes", MinAgo: 149},
		},

		// Memes
		"memes": {
			{User: "bob", Message: "i regret nothing", MinAgo: 140},
			{User: "bob", Message: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", MinAgo: 139},
			{User: "alice", Message: "twice in one day??", MinAgo: 138},
			{User: "charlie", Message: "ban him", MinAgo: 137},
			{User: "dana", Message: ":skull: :skull: :skull:", MinAgo: 136},
			{User: "eve", Message: "L + ratio", MinAgo: 135},
			{User: "bob", Message: "worth it", MinAgo: 134},
			{User: "admin", Message: "im not banning anyone for rickrolls lol", MinAgo: 133},
			{User: "alice", Message: "admin is based", MinAgo: 132},
			{User: "charlie", Message: "rare admin W", MinAgo: 131},
		},

		// Clips - YouTube embeds showcase
		"clips": {
			{User: "alice", Message: "check out this insane play", MinAgo: 120},
			{User: "alice", Message: "https://www.youtube.com/watch?v=8aGhZQkoFbQ", MinAgo: 119},
			{User: "bob", Message: "the embed preview is so much better now", MinAgo: 118},
			{User: "charlie", Message: "wait it shows the thumbnail and everything??", MinAgo: 117},
			{User: "dana", Message: "yeah its discord style", MinAgo: 116},
			{User: "eve", Message: "finally", MinAgo: 115},
			{User: "bob", Message: "heres another one", MinAgo: 114},
			{User: "bob", Message: "https://www.youtube.com/watch?v=jNQXAC9IVRw", MinAgo: 113},
			{User: "alice", Message: "bro thats the first youtube video ever", MinAgo: 112},
			{User: "charlie", Message: "historical footage", MinAgo: 111},
			{User: "dana", Message: "me at the zoo", MinAgo: 110},
			{User: "eve", Message: "certified classic", MinAgo: 109},
		},

		// Tech
		"tech": {
			{User: "eve", Message: "thinking about upgrading my gpu", MinAgo: 100},
			{User: "bob", Message: "what do you have rn", MinAgo: 99},
			{User: "eve", Message: "3060", MinAgo: 98},
			{User: "alice", Message: "4070 super is solid rn", MinAgo: 97},
			{User: "charlie", Message: "or wait for 5000 series", MinAgo: 96},
			{User: "dana", Message: "5000 series is gonna be expensive af tho", MinAgo: 95},
			{User: "bob", Message: "true nvidia prices are crazy", MinAgo: 94},
			{User: "eve", Message: "might just get a 4070 then", MinAgo: 93},
			{User: "alice", Message: "good choice honestly", MinAgo: 92},
			{User: "charlie", Message: "make sure your psu can handle it", MinAgo: 91},
			{User: "eve", Message: "750w should be fine right", MinAgo: 90},
			{User: "bob", Message: "yeah youre good", MinAgo: 89},
		},

		// Secret - E2E Encryption showcase
		"secret": {
			{User: "admin", Message: "ok so this channel has encryption enabled :lock:", MinAgo: 80},
			{User: "alice", Message: "wait how does it work", MinAgo: 79},
			{User: "admin", Message: "click the lock icon when typing, messages get encrypted before sending", MinAgo: 78},
			{User: "bob", Message: "so not even admins can read them?", MinAgo: 77},
			{User: "admin", Message: "nope, server only sees encrypted blobs", MinAgo: 76},
			{User: "charlie", Message: "thats actually sick", MinAgo: 75},
			{User: "dana", Message: "the purple border looks cool too", MinAgo: 74},
			{User: "eve", Message: "finally i can share my deepest secrets", MinAgo: 73},
			{User: "alice", Message: "which are?", MinAgo: 72},
			{User: "eve", Message: "i prefer tabs over spaces", MinAgo: 71},
			{User: "bob", Message: "BAN", MinAgo: 70},
			{User: "charlie", Message: ":skull:", MinAgo: 69},
			{User: "dana", Message: "encrypted for a reason lmaooo", MinAgo: 68},
		},
	}

	// =========================================================================
	// THREADED CONVERSATIONS - Gaming discussions
	// =========================================================================
	demoThreads := []Thread{
		{
			User:    "alice",
			Message: "whos down for a minecraft session this weekend",
			MinAgo:  250,
			Replies: []Post{
				{User: "bob", Message: "im free saturday", MinAgo: 248},
				{User: "charlie", Message: "same", MinAgo: 246},
				{User: "dana", Message: "what time", MinAgo: 244},
				{User: "alice", Message: "like 8pm?", MinAgo: 242},
				{User: "eve", Message: "works for me", MinAgo: 240},
				{User: "bob", Message: "bet", MinAgo: 238},
				{User: "charlie", Message: "should we start a new world or continue the old one", MinAgo: 236},
				{User: "alice", Message: "new world, 1.21 just dropped", MinAgo: 234},
				{User: "dana", Message: "ooh the trial chambers update", MinAgo: 232},
				{User: "eve", Message: "lets gooo", MinAgo: 230},
			},
		},
		{
			User:    "bob",
			Message: "anyone know a good horror game to stream",
			MinAgo:  190,
			Replies: []Post{
				{User: "charlie", Message: "phasmophobia is always good", MinAgo: 188},
				{User: "dana", Message: "outlast trials if you have friends", MinAgo: 186},
				{User: "eve", Message: "lethal company lol", MinAgo: 184},
				{User: "alice", Message: "lethal company isnt scary its just chaos", MinAgo: 182},
				{User: "bob", Message: "chaos is content tho", MinAgo: 180},
				{User: "charlie", Message: "true", MinAgo: 178},
				{User: "dana", Message: "devour is underrated btw", MinAgo: 176},
				{User: "eve", Message: "oh yeah devour slaps", MinAgo: 174},
				{User: "bob", Message: "bet ill try devour, ty", MinAgo: 172},
			},
		},
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

	// Create demo channels with custom icons
	channelIds := make(map[string]string)
	for _, ch := range demoChannels {
		var channelId string
		err = db.QueryRow("SELECT id FROM channels WHERE name = $1 AND teamid = $2", ch.Name, teamId).Scan(&channelId)
		if err == sql.ErrNoRows {
			channelId = generateId()

			// Build props JSON for custom_icon if specified
			var propsJson string
			if ch.Icon != "" {
				props := map[string]string{"custom_icon": ch.Icon}
				propsBytes, _ := json.Marshal(props)
				propsJson = string(propsBytes)
			} else {
				propsJson = "{}"
			}

			_, err = db.Exec(`
				INSERT INTO channels (
					id, createat, updateat, deleteat, teamid, type, displayname,
					name, header, purpose, lastpostat, totalmsgcount, extraupdateat,
					creatorid, schemeid, groupconstrained, shared, totalmsgcountroot,
					lastrootpostat, props
				) VALUES (
					$1, $2, $2, 0, $3, 'O', $4,
					$5, '', $6, $2, 0, 0,
					'', NULL, NULL, NULL, 0, $2, $7
				)`,
				channelId, now, teamId, ch.DisplayName, ch.Name, ch.Purpose, propsJson,
			)
			if err != nil {
				fmt.Printf("Error creating channel %s: %v\n", ch.Name, err)
				continue
			}
			iconInfo := ""
			if ch.Icon != "" {
				iconInfo = fmt.Sprintf(" [%s]", ch.Icon)
			}
			fmt.Printf("Created channel: %s%s\n", ch.DisplayName, iconInfo)
		} else if err != nil {
			fmt.Printf("Error checking channel %s: %v\n", ch.Name, err)
			continue
		} else {
			// Update existing channel's icon if specified
			if ch.Icon != "" {
				props := map[string]string{"custom_icon": ch.Icon}
				propsBytes, _ := json.Marshal(props)
				_, err = db.Exec(`UPDATE channels SET props = $1, updateat = $2 WHERE id = $3`,
					string(propsBytes), now, channelId)
				if err != nil {
					fmt.Printf("Error updating channel icon for %s: %v\n", ch.Name, err)
				} else {
					fmt.Printf("Updated channel icon: %s [%s]\n", ch.DisplayName, ch.Icon)
				}
			} else {
				fmt.Printf("Channel %s already exists\n", ch.DisplayName)
			}
		}
		channelIds[ch.Name] = channelId
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

	// Build username -> userId map for post creation
	userIds := make(map[string]string)
	for _, u := range users {
		var userId string
		err := db.QueryRow("SELECT id FROM users WHERE username = $1", u.Username).Scan(&userId)
		if err == nil {
			userIds[u.Username] = userId
		}
	}

	// Seed demo posts
	fmt.Println("\nSeeding demo conversations...")
	postsCreated := 0

	for channelName, posts := range demoConversations {
		channelId, ok := channelIds[channelName]
		if !ok {
			fmt.Printf("Warning: channel %s not found, skipping posts\n", channelName)
			continue
		}

		for _, p := range posts {
			userId, ok := userIds[p.User]
			if !ok {
				fmt.Printf("Warning: user %s not found, skipping post\n", p.User)
				continue
			}

			createAt := now - int64(p.MinAgo*60*1000) // Convert minutes to milliseconds
			_, err := createPost(db, channelId, userId, p.Message, createAt)
			if err != nil {
				fmt.Printf("Error creating post in %s: %v\n", channelName, err)
				continue
			}
			postsCreated++
		}
	}

	fmt.Printf("Created %d posts in demo channels\n", postsCreated)

	// Seed threaded conversations
	fmt.Println("Seeding threaded conversations...")
	threadsCreated := 0
	repliesCreated := 0

	threadsChannelId, ok := channelIds["general"]
	if !ok {
		fmt.Println("Warning: general channel not found, skipping threads")
	} else {
		for _, thread := range demoThreads {
			userId, ok := userIds[thread.User]
			if !ok {
				fmt.Printf("Warning: user %s not found, skipping thread\n", thread.User)
				continue
			}

			createAt := now - int64(thread.MinAgo*60*1000)
			rootId, err := createPost(db, threadsChannelId, userId, thread.Message, createAt)
			if err != nil {
				fmt.Printf("Error creating thread root: %v\n", err)
				continue
			}
			threadsCreated++

			// Create replies
			for _, reply := range thread.Replies {
				replyUserId, ok := userIds[reply.User]
				if !ok {
					continue
				}
				replyCreateAt := now - int64(reply.MinAgo*60*1000)
				err := createReply(db, threadsChannelId, replyUserId, rootId, reply.Message, replyCreateAt)
				if err != nil {
					fmt.Printf("Error creating reply: %v\n", err)
					continue
				}
				repliesCreated++
			}
		}
	}

	fmt.Printf("Created %d threads with %d replies\n", threadsCreated, repliesCreated)

	// Update channel stats (totalmsgcount, lastpostat)
	fmt.Println("Updating channel statistics...")
	for channelName, channelId := range channelIds {
		_, err := db.Exec(`
			UPDATE channels SET
				totalmsgcount = (SELECT COUNT(*) FROM posts WHERE channelid = $1 AND deleteat = 0),
				totalmsgcountroot = (SELECT COUNT(*) FROM posts WHERE channelid = $1 AND deleteat = 0 AND rootid = ''),
				lastpostat = COALESCE((SELECT MAX(createat) FROM posts WHERE channelid = $1), $2),
				lastrootpostat = COALESCE((SELECT MAX(createat) FROM posts WHERE channelid = $1 AND rootid = ''), $2)
			WHERE id = $1`,
			channelId, now,
		)
		if err != nil {
			fmt.Printf("Error updating stats for %s: %v\n", channelName, err)
		}
	}
	fmt.Println("Channel statistics updated.")

	// Create admin session for auto-login
	fmt.Println("\nCreating admin session for auto-login...")
	adminUserId, ok := userIds["admin"]
	if ok {
		// Use a deterministic token for demo purposes (based on "demo" + padding)
		// Token format: 26 chars, alphanumeric lowercase
		demoToken := "demo" + strings.Repeat("0", 22) // "demo0000000000000000000000"
		demoToken = demoToken[:26]
		sessionId := generateId()

		// Session expires in 30 days
		expiresAt := now + int64(30*24*60*60*1000)

		// Delete any existing sessions with this token
		_, _ = db.Exec(`DELETE FROM sessions WHERE token = $1`, demoToken)

		_, err = db.Exec(`
			INSERT INTO sessions (
				id, token, createat, expiresat, lastactivityat,
				userid, deviceid, roles, isoauth, props
			) VALUES (
				$1, $2, $3, $4, $3,
				$5, 'demo-device', 'system_admin system_user', false, '{}'
			)`,
			sessionId, demoToken, now, expiresAt, adminUserId,
		)
		if err != nil {
			fmt.Printf("Error creating admin session: %v\n", err)
		} else {
			fmt.Println("Created admin session!")
			fmt.Println("")
			fmt.Println("=== AUTO-LOGIN INFO ===")
			fmt.Printf("Token: %s\n", demoToken)
			fmt.Println("")
			fmt.Println("To auto-login as admin, set this cookie in your browser:")
			fmt.Printf("  MMAUTHTOKEN=%s\n", demoToken)
			fmt.Println("")
			fmt.Println("Or use this JavaScript in the browser console:")
			fmt.Printf("  document.cookie = 'MMAUTHTOKEN=%s; path=/';\n", demoToken)
			fmt.Println("  location.reload();")
			fmt.Println("=======================")
		}
	}

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
