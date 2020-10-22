package source

import "os"

// ErrDuplicateMigration is an error type for reporting duplicate migration
// files.
type ErrDuplicateMigration struct {
	Migration
	os.FileInfo
}

// Error implements error interface.
func (e ErrDuplicateMigration) Error() string {
	return "duplicate migration file: " + e.Name()
}
