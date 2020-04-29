package gojay

import (
	"strconv"
	"sync"
	"time"
)

// MarshalerStream is the interface to implement
// to continuously encode of stream of data.
type MarshalerStream interface {
	MarshalStream(enc *StreamEncoder)
}

// A StreamEncoder reads and encodes values to JSON from an input stream.
//
// It implements conext.Context and provide a channel to notify interruption.
type StreamEncoder struct {
	mux *sync.RWMutex
	*Encoder
	nConsumer int
	delimiter byte
	deadline  *time.Time
	done      chan struct{}
}

// EncodeStream spins up a defined number of non blocking consumers of the MarshalerStream m.
//
// m must implement MarshalerStream. Ideally m is a channel. See example for implementation.
//
// See the documentation for Marshal for details about the conversion of Go value to JSON.
func (s *StreamEncoder) EncodeStream(m MarshalerStream) {
	// if a single consumer, just use this encoder
	if s.nConsumer == 1 {
		go consume(s, s, m)
		return
	}
	// else use this Encoder only for first consumer
	// and use new encoders for other consumers
	// this is to avoid concurrent writing to same buffer
	// resulting in a weird JSON
	go consume(s, s, m)
	for i := 1; i < s.nConsumer; i++ {
		s.mux.RLock()
		select {
		case <-s.done:
		default:
			ss := Stream.borrowEncoder(s.w)
			ss.mux.Lock()
			ss.done = s.done
			ss.buf = make([]byte, 0, 512)
			ss.delimiter = s.delimiter
			go consume(s, ss, m)
			ss.mux.Unlock()
		}
		s.mux.RUnlock()
	}
	return
}

// LineDelimited sets the delimiter to a new line character.
//
// It will add a new line after each JSON marshaled by the MarshalerStream
func (s *StreamEncoder) LineDelimited() *StreamEncoder {
	s.delimiter = '\n'
	return s
}

// CommaDelimited sets the delimiter to a comma.
//
// It will add a new line after each JSON marshaled by the MarshalerStream
func (s *StreamEncoder) CommaDelimited() *StreamEncoder {
	s.delimiter = ','
	return s
}

// NConsumer sets the number of non blocking go routine to consume the stream.
func (s *StreamEncoder) NConsumer(n int) *StreamEncoder {
	s.nConsumer = n
	return s
}

// Release sends back a Decoder to the pool.
// If a decoder is used after calling Release
// a panic will be raised with an InvalidUsagePooledDecoderError error.
func (s *StreamEncoder) Release() {
	s.isPooled = 1
	streamEncPool.Put(s)
}

// Done returns a channel that's closed when work is done.
// It implements context.Context
func (s *StreamEncoder) Done() <-chan struct{} {
	return s.done
}

// Err returns nil if Done is not yet closed.
// If Done is closed, Err returns a non-nil error explaining why.
// It implements context.Context
func (s *StreamEncoder) Err() error {
	return s.err
}

// Deadline returns the time when work done on behalf of this context
// should be canceled. Deadline returns ok==false when no deadline is
// set. Successive calls to Deadline return the same results.
func (s *StreamEncoder) Deadline() (time.Time, bool) {
	if s.deadline != nil {
		return *s.deadline, true
	}
	return time.Time{}, false
}

// SetDeadline sets the deadline
func (s *StreamEncoder) SetDeadline(t time.Time) {
	s.deadline = &t
}

// Value implements context.Context
func (s *StreamEncoder) Value(key interface{}) interface{} {
	return nil
}

// Cancel cancels the consumers of the stream, interrupting the stream encoding.
//
// After calling cancel, Done() will return a closed channel.
func (s *StreamEncoder) Cancel(err error) {
	s.mux.Lock()
	defer s.mux.Unlock()
	
	select {
	case <-s.done:
	default:
		s.err = err
		close(s.done)
	}
}

// AddObject adds an object to be encoded.
// value must implement MarshalerJSONObject.
func (s *StreamEncoder) AddObject(v MarshalerJSONObject) {
	if v.IsNil() {
		return
	}
	s.Encoder.writeByte('{')
	v.MarshalJSONObject(s.Encoder)
	s.Encoder.writeByte('}')
	s.Encoder.writeByte(s.delimiter)
}

// AddString adds a string to be encoded.
func (s *StreamEncoder) AddString(v string) {
	s.Encoder.writeByte('"')
	s.Encoder.writeString(v)
	s.Encoder.writeByte('"')
	s.Encoder.writeByte(s.delimiter)
}

// AddArray adds an implementation of MarshalerJSONArray to be encoded.
func (s *StreamEncoder) AddArray(v MarshalerJSONArray) {
	s.Encoder.writeByte('[')
	v.MarshalJSONArray(s.Encoder)
	s.Encoder.writeByte(']')
	s.Encoder.writeByte(s.delimiter)
}

// AddInt adds an int to be encoded.
func (s *StreamEncoder) AddInt(value int) {
	s.buf = strconv.AppendInt(s.buf, int64(value), 10)
	s.Encoder.writeByte(s.delimiter)
}

// AddFloat64 adds a float64 to be encoded.
func (s *StreamEncoder) AddFloat64(value float64) {
	s.buf = strconv.AppendFloat(s.buf, value, 'f', -1, 64)
	s.Encoder.writeByte(s.delimiter)
}

// AddFloat adds a float64 to be encoded.
func (s *StreamEncoder) AddFloat(value float64) {
	s.AddFloat64(value)
}

// Non exposed

func consume(init *StreamEncoder, s *StreamEncoder, m MarshalerStream) {
	defer s.Release()
	for {
		select {
		case <-init.Done():
			return
		default:
			m.MarshalStream(s)
			if s.Encoder.err != nil {
				init.Cancel(s.Encoder.err)
				return
			}
			i, err := s.Encoder.Write()
			if err != nil || i == 0 {
				init.Cancel(err)
				return
			}
		}
	}
}
