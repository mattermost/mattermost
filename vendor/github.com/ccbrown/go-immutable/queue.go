package immutable

func queueRotate(f *lazyList, r *Stack, s *lazyList) *lazyList {
	if f == nil {
		return s.PushFront(r.Peek())
	}
	return newLazyList(f.Front(), func() *lazyList {
		return queueRotate(f.PopFront(), r.Pop(), s.PushFront(r.Peek()))
	})
}

func queueExec(f *lazyList, r *Stack, s *lazyList) *Queue {
	if s == nil {
		f2 := queueRotate(f, r, nil)
		return &Queue{f2, nil, f2}
	}
	return &Queue{f, r, s.PopFront()}
}

// Queue implements a first in, first out container.
//
// Nil and the zero value for Queue are both empty queues.
type Queue struct {
	f *lazyList
	r *Stack
	s *lazyList
}

// Empty returns true if the queue is empty.
//
// Complexity: O(1) worst-case
func (q *Queue) Empty() bool {
	return q == nil || q.f == nil
}

// Front returns the item at the front of the queue.
//
// Complexity: O(1) worst-case
func (q *Queue) Front() interface{} {
	return q.f.Front()
}

// PopFront removes the item at the front of the queue.
//
// Complexity: O(1) worst-case
func (q *Queue) PopFront() *Queue {
	return queueExec(q.f.PopFront(), q.r, q.s)
}

// PushBack pushes an item onto the back of the queue.
//
// Complexity: O(1) worst-case
func (q *Queue) PushBack(value interface{}) *Queue {
	return queueExec(q.f, q.r.Push(value), q.s)
}
