package immutable

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStack(t *testing.T) {
	var s Stack
	assert.True(t, s.Empty())
	s2 := s.Push("foo")
	assert.True(t, s.Empty())
	assert.False(t, s2.Empty())
	assert.Equal(t, s2.Peek(), "foo")
	s3 := s2.Push("bar")
	assert.Equal(t, s3.Peek(), "bar")
	assert.Equal(t, s3.Pop().Peek(), "foo")
}
