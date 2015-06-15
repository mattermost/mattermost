package aws

import "testing"

func TestHandlerList(t *testing.T) {
	r := &Request{}
	l := HandlerList{}
	l.PushBack(func(r *Request) { r.Data = Boolean(true) })
	l.Run(r)
	if r.Data == nil {
		t.Error("Expected handler to execute")
	}
}

func TestMultipleHandlers(t *testing.T) {
	r := &Request{}
	l := HandlerList{}
	l.PushBack(func(r *Request) { r.Data = Boolean(true) })
	l.PushBack(func(r *Request) { r.Data = nil })
	l.Run(r)
	if r.Data != nil {
		t.Error("Expected handler to execute")
	}
}
