package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: reset-passwords <postgres-connection-string> [password]")
		fmt.Println("Example: reset-passwords \"postgres://mmuser:mostest@localhost:5432/mattermost_test?sslmode=disable\" test")
		os.Exit(1)
	}

	connStr := os.Args[1]
	password := "test"
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

	now := time.Now().UnixNano() / int64(time.Millisecond)

	// Update all non-deleted user passwords and clear authentication overrides
	// We clear AuthService and AuthData to ensure users can login with email/password
	// We also clear MFA settings and reset failed attempts
	// Exclude bots by checking they don't have an entry in the bots table
	result, err := db.Exec(`
		UPDATE users
		SET password = $1,
		    authservice = '',
		    authdata = NULL,
		    mfaactive = false,
		    mfasecret = '',
		    emailverified = true,
		    failedattempts = 0,
		    updateat = $2,
		    lastpasswordupdate = $2
		WHERE deleteat = 0
		  AND id NOT IN (SELECT userid FROM bots WHERE deleteat = 0)`, string(hash), now)
	if err != nil {
		fmt.Printf("Error updating passwords: %v\n", err)
		os.Exit(1)
	}


	rowsAffected, _ := result.RowsAffected()
	fmt.Printf("Reset %d user passwords to '%s' and cleared auth overrides\n", rowsAffected, password)
}