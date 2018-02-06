package immutable

import (
	"sync"
)

type lazyList struct {
	value      interface{}
	lazyNext   func() *lazyList
	next       *lazyList
	evaluation sync.Once
}

func newLazyList(front interface{}, next func() *lazyList) *lazyList {
	return &lazyList{
		value:    front,
		lazyNext: next,
	}
}

func (l *lazyList) Front() interface{} {
	return l.value
}

func (l *lazyList) PopFront() *lazyList {
	l.evaluation.Do(func() {
		if l.lazyNext != nil {
			l.next = l.lazyNext()
			l.lazyNext = nil
		}
	})
	return l.next
}

func (l *lazyList) PushFront(value interface{}) *lazyList {
	return &lazyList{
		value: value,
		next:  l,
	}
}
