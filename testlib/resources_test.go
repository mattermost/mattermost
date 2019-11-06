package testlib

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFindDir(t *testing.T) {
	t.Run("find root", func(t *testing.T) {
		path, found := findDir(root)
		assert.True(t, found, "failed to find root")
		assert.NotEmpty(t, path)
	})
}
