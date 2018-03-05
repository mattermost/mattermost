package immutable

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestQueue(t *testing.T) {
	var q Queue
	assert.True(t, q.Empty())
	q2 := q.PushBack("foo")
	assert.True(t, q.Empty())
	assert.False(t, q2.Empty())
	assert.Equal(t, q2.Front(), "foo")
	q3 := q2.PushBack("bar")
	assert.Equal(t, q3.Front(), "foo")
	assert.Equal(t, q3.PopFront().Front(), "bar")
	q4 := q3.PushBack("baz")
	assert.Equal(t, q4.Front(), "foo")
	assert.Equal(t, q4.PopFront().Front(), "bar")
	assert.Equal(t, q4.PopFront().PopFront().Front(), "baz")
	assert.True(t, q4.PopFront().PopFront().PopFront().Empty())
}

var queueResult *Queue

func BenchmarkQueue_PushBack(b *testing.B) {
	for _, n := range []int{100, 10000, 1000000} {
		q := &Queue{}
		for i := 0; i < n; i++ {
			q = q.PushBack("foo")
		}
		b.Run(fmt.Sprintf("n=%v", n), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				queueResult = q.PushBack("foo")
			}
		})
	}
}

func BenchmarkQueue_PopFront(b *testing.B) {
	for _, n := range []int{100, 10000, 200000} {
		q := &Queue{}
		for i := 0; i < n; i++ {
			q = q.PushBack(i)
		}
		b.Run(fmt.Sprintf("n=%v", n), func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				queueResult = q.PopFront()
			}
		})
	}
}
