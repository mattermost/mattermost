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
		fmt.Println("Team 'demo' already exists")
	}

	// Add all users to the team (always runs, handles existing memberships via ON CONFLICT)
	addedCount := 0
	for _, u := range users {
		var userId string
		err := db.QueryRow("SELECT id FROM users WHERE username = $1", u.Username).Scan(&userId)
		if err != nil {
			fmt.Printf("Warning: user %s not found, skipping team membership\n", u.Username)
			continue
		}

		roles := "team_user"
		if u.Username == "admin" {
			roles = "team_admin team_user"
		}

		result, err := db.Exec(`
			INSERT INTO teammembers (teamid, userid, roles, deleteat, schemeguest, schemeuser, schemeadmin, createat)
			VALUES ($1, $2, $3, 0, false, true, $4, $5)
			ON CONFLICT (teamid, userid) DO NOTHING`,
			teamId, userId, roles, u.Username == "admin", now,
		)
		if err != nil {
			fmt.Printf("Error adding %s to team: %v\n", u.Username, err)
		} else {
			rowsAffected, _ := result.RowsAffected()
			if rowsAffected > 0 {
				addedCount++
			}
		}
	}
	if addedCount > 0 {
		fmt.Printf("Added %d users to demo team\n", addedCount)
	} else {
		fmt.Println("All users already in demo team")
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
