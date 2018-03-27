package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// This is a test to ensure that we don't accidentally add more permissions than can fit
// in the database column for role permissions.
func TestPermissionsLength(t *testing.T) {
	permissionsString := ""
	for _, permission := range ALL_PERMISSIONS {
		permissionsString += " " + permission.Id
	}

	assert.True(t, len(permissionsString) < 4096)
}
