package aws

import "container/list"

type Handlers struct {
	Validate         HandlerList
	Build            HandlerList
	Sign             HandlerList
	Send             HandlerList
	ValidateResponse HandlerList
	Unmarshal        HandlerList
	UnmarshalMeta    HandlerList
	UnmarshalError   HandlerList
	Retry            HandlerList
	AfterRetry       HandlerList
}

func (h *Handlers) copy() Handlers {
	return Handlers{
		Validate:         h.Validate.copy(),
		Build:            h.Build.copy(),
		Sign:             h.Sign.copy(),
		Send:             h.Send.copy(),
		ValidateResponse: h.ValidateResponse.copy(),
		Unmarshal:        h.Unmarshal.copy(),
		UnmarshalError:   h.UnmarshalError.copy(),
		UnmarshalMeta:    h.UnmarshalMeta.copy(),
		Retry:            h.Retry.copy(),
		AfterRetry:       h.AfterRetry.copy(),
	}
}

// Clear removes callback functions for all handlers
func (h *Handlers) Clear() {
	h.Validate.Init()
	h.Build.Init()
	h.Send.Init()
	h.Sign.Init()
	h.Unmarshal.Init()
	h.UnmarshalMeta.Init()
	h.UnmarshalError.Init()
	h.ValidateResponse.Init()
	h.Retry.Init()
	h.AfterRetry.Init()
}

type HandlerList struct {
	list.List
}

func (l HandlerList) copy() HandlerList {
	var n HandlerList
	for e := l.Front(); e != nil; e = e.Next() {
		h := e.Value.(func(*Request))
		n.PushBack(h)
	}
	return n
}

func (l *HandlerList) Run(r *Request) {
	for e := l.Front(); e != nil; e = e.Next() {
		h := e.Value.(func(*Request))
		h(r)
	}
}
