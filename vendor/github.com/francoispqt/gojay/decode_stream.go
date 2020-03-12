package gojay

import (
	"sync"
	"time"
)

// UnmarshalerStream is the interface to implement for a slice, an array or a slice
// to decode a line delimited JSON to.
type UnmarshalerStream interface {
	UnmarshalStream(*StreamDecoder) error
}

// Stream is a struct holding the Stream api
var Stream = stream{}

type stream struct{}

// A StreamDecoder reads and decodes JSON values from an input stream.
//
// It implements conext.Context and provide a channel to notify interruption.
type StreamDecoder struct {
	mux sync.RWMutex
	*Decoder
	done     chan struct{}
	deadline *time.Time
}

// DecodeStream reads the next line delimited JSON-encoded value from the decoder's input (io.Reader) and stores it in the value pointed to by c.
//
// c must implement UnmarshalerStream. Ideally c is a channel. See example for implementation.
//
// See the documentation for Unmarshal for details about the conversion of JSON into a Go value.
func (dec *StreamDecoder) DecodeStream(c UnmarshalerStream) error {
	if dec.isPooled == 1 {
		panic(InvalidUsagePooledDecoderError("Invalid usage of pooled decoder"))
	}
	if dec.r == nil {
		dec.err = NoReaderError("No reader given to decode stream")
		close(dec.done)
		return dec.err
	}
	for ; dec.cursor < dec.length || dec.read(); dec.cursor++ {
		switch dec.data[dec.cursor] {
		case ' ', '\n', '\t', '\r', ',':
			continue
		default:
			// char is not space start reading
			for dec.nextChar() != 0 {
				// calling unmarshal stream
				err := c.UnmarshalStream(dec)
				if err != nil {
					dec.err = err
					close(dec.done)
					return err
				}
				// garbage collects buffer
				// we don't want the buffer to grow extensively
				dec.data = dec.data[dec.cursor:]
				dec.length = dec.length - dec.cursor
				dec.cursor = 0
			}
			// close the done channel to signal the end of the job
			close(dec.done)
			return nil
		}
	}
	close(dec.done)
	dec.mux.Lock()
	err := dec.raiseInvalidJSONErr(dec.cursor)
	dec.mux.Unlock()
	return err
}

// context.Context implementation

// Done returns a channel that's closed when work is done.
// It implements context.Context
func (dec *StreamDecoder) Done() <-chan struct{} {
	return dec.done
}

// Deadline returns the time when work done on behalf of this context
// should be canceled. Deadline returns ok==false when no deadline is
// set. Successive calls to Deadline return the same results.
func (dec *StreamDecoder) Deadline() (time.Time, bool) {
	if dec.deadline != nil {
		return *dec.deadline, true
	}
	return time.Time{}, false
}

// SetDeadline sets the deadline
func (dec *StreamDecoder) SetDeadline(t time.Time) {
	dec.deadline = &t
}

// Err returns nil if Done is not yet closed.
// If Done is closed, Err returns a non-nil error explaining why.
// It implements context.Context
func (dec *StreamDecoder) Err() error {
	select {
	case <-dec.done:
		dec.mux.RLock()
		defer dec.mux.RUnlock()
		return dec.err
	default:
		return nil
	}
}

// Value implements context.Context
func (dec *StreamDecoder) Value(key interface{}) interface{} {
	return nil
}
