// +build darwin dragonfly freebsd netbsd openbsd

package netpoll

import (
	"os"
)

// New creates new kqueue-based Poller instance with given config.
func New(c *Config) (Poller, error) {
	cfg := c.withDefaults()

	kq, err := KqueueCreate(&KqueueConfig{
		OnWaitError: cfg.OnWaitError,
	})
	if err != nil {
		return nil, err
	}

	return poller{kq}, nil
}

type poller struct {
	*Kqueue
}

func (p poller) Start(desc *Desc, cb CallbackFn) error {
	n, events := toKevents(desc.event, true)
	err := p.Add(desc.fd(), events, n, func(kev Kevent) {
		var (
			event Event

			flags  = kev.Flags
			filter = kev.Filter
		)

		// Set EventHup for any EOF flag. Below will be more precise detection
		// of what exatcly HUP occured.
		if flags&EV_EOF != 0 {
			event |= EventHup
		}

		if filter == EVFILT_READ {
			event |= EventRead
			if flags&EV_EOF != 0 {
				event |= EventReadHup
			}
		}
		if filter == EVFILT_WRITE {
			event |= EventWrite
			if flags&EV_EOF != 0 {
				event |= EventWriteHup
			}
		}
		if flags&EV_ERROR != 0 {
			event |= EventErr
		}
		if filter == _EVFILT_CLOSED {
			event |= EventPollerClosed
		}

		cb(event)
	})
	if err == nil {
		if err = setNonblock(desc.fd(), true); err != nil {
			return os.NewSyscallError("setnonblock", err)
		}
	}
	return err
}

func (p poller) Stop(desc *Desc) error {
	n, events := toKevents(desc.event, false)
	if err := p.Del(desc.fd()); err != nil {
		return err
	}
	if err := p.Mod(desc.fd(), events, n); err != nil && err != ErrNotRegistered {
		return err
	}
	return nil
}

func (p poller) Resume(desc *Desc) error {
	n, events := toKevents(desc.event, true)
	return p.Mod(desc.fd(), events, n)
}

func toKevents(event Event, add bool) (n int, ks Kevents) {
	var flags KeventFlag
	if add {
		flags = EV_ADD
		if event&EventOneShot != 0 {
			flags |= EV_ONESHOT
		}
		if event&EventEdgeTriggered != 0 {
			flags |= EV_CLEAR
		}
	} else {
		flags = EV_DELETE
	}
	if event&EventRead != 0 {
		ks[n].Flags = flags
		ks[n].Filter = EVFILT_READ
		n++
	}
	if event&EventWrite != 0 {
		ks[n].Flags = flags
		ks[n].Filter = EVFILT_WRITE
		n++
	}
	return
}
