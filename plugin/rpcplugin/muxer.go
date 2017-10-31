// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package rpcplugin

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
)

// Muxer allows multiple bidirectional streams to be transmitted over a single connection.
//
// Muxer is safe for use by multiple goroutines.
//
// Streams opened on the muxer must be periodically drained in order to reclaim read buffer memory.
// In other words, readers must consume incoming data as it comes in.
type Muxer struct {
	// writeMutex guards conn writes
	writeMutex sync.Mutex
	conn       io.ReadWriteCloser

	// didCloseConn is a boolean (0 or 1) used from multiple goroutines via atomic operations
	didCloseConn int32

	// streamsMutex guards streams and nextId
	streamsMutex sync.Mutex
	nextId       int64
	streams      map[int64]*muxerStream

	stream0Reader *io.PipeReader
	stream0Writer *io.PipeWriter
	result        chan error
}

// Creates a new Muxer.
//
// conn must be safe for simultaneous reads by one goroutine and writes by another.
//
// For two muxers communicating with each other via a connection, parity must be true for exactly
// one of them.
func NewMuxer(conn io.ReadWriteCloser, parity bool) *Muxer {
	s0r, s0w := io.Pipe()
	muxer := &Muxer{
		conn:          conn,
		streams:       make(map[int64]*muxerStream),
		result:        make(chan error, 1),
		nextId:        1,
		stream0Reader: s0r,
		stream0Writer: s0w,
	}
	if parity {
		muxer.nextId = 2
	}
	go muxer.run()
	return muxer
}

// Opens a new stream with a unique id.
//
// Writes made to the stream before the other end calls Connect will be discarded.
func (m *Muxer) Serve() (int64, io.ReadWriteCloser) {
	m.streamsMutex.Lock()
	id := m.nextId
	m.nextId += 2
	m.streamsMutex.Unlock()
	return id, m.Connect(id)
}

// Opens a remotely opened stream.
func (m *Muxer) Connect(id int64) io.ReadWriteCloser {
	m.streamsMutex.Lock()
	defer m.streamsMutex.Unlock()
	mutex := &sync.Mutex{}
	stream := &muxerStream{
		id:       id,
		muxer:    m,
		mutex:    mutex,
		readWake: sync.NewCond(mutex),
	}
	m.streams[id] = stream
	return stream
}

// Calling Read on the muxer directly performs a read on a dedicated, always-open channel.
func (m *Muxer) Read(p []byte) (int, error) {
	return m.stream0Reader.Read(p)
}

// Calling Write on the muxer directly performs a write on a dedicated, always-open channel.
func (m *Muxer) Write(p []byte) (int, error) {
	return m.write(p, 0)
}

// Closes the muxer.
func (m *Muxer) Close() error {
	if atomic.CompareAndSwapInt32(&m.didCloseConn, 0, 1) {
		m.conn.Close()
	}
	m.stream0Reader.Close()
	m.stream0Writer.Close()
	<-m.result
	return nil
}

func (m *Muxer) IsClosed() bool {
	return atomic.LoadInt32(&m.didCloseConn) > 0
}

func (m *Muxer) write(p []byte, sid int64) (int, error) {
	m.writeMutex.Lock()
	defer m.writeMutex.Unlock()
	if m.IsClosed() {
		return 0, fmt.Errorf("muxer closed")
	}
	var buf [10]byte
	n := binary.PutVarint(buf[:], sid)
	if _, err := m.conn.Write(buf[:n]); err != nil {
		m.shutdown(err)
		return 0, err
	}
	n = binary.PutVarint(buf[:], int64(len(p)))
	if _, err := m.conn.Write(buf[:n]); err != nil {
		m.shutdown(err)
		return 0, err
	}
	if len(p) > 0 {
		if _, err := m.conn.Write(p); err != nil {
			m.shutdown(err)
			return 0, err
		}
	}
	return len(p), nil
}

func (m *Muxer) rm(sid int64) {
	m.streamsMutex.Lock()
	defer m.streamsMutex.Unlock()
	delete(m.streams, sid)
}

func (m *Muxer) run() {
	m.shutdown(m.loop())
}

func (m *Muxer) loop() error {
	reader := bufio.NewReader(m.conn)

	for {
		sid, err := binary.ReadVarint(reader)
		if err != nil {
			return err
		}
		len, err := binary.ReadVarint(reader)
		if err != nil {
			return err
		}

		if sid == 0 {
			if _, err := io.CopyN(m.stream0Writer, reader, len); err != nil {
				return err
			}
			continue
		}

		m.streamsMutex.Lock()
		stream, ok := m.streams[sid]
		m.streamsMutex.Unlock()
		if !ok {
			if _, err := reader.Discard(int(len)); err != nil {
				return err
			}
			continue
		}

		stream.mutex.Lock()
		if stream.isClosed {
			stream.mutex.Unlock()
			if _, err := reader.Discard(int(len)); err != nil {
				return err
			}
			continue
		}
		if len == 0 {
			stream.remoteClosed = true
		} else {
			_, err = io.CopyN(&stream.readBuf, reader, len)
		}
		stream.mutex.Unlock()
		if err != nil {
			return err
		}
		stream.readWake.Signal()
	}
}

func (m *Muxer) shutdown(err error) {
	if atomic.CompareAndSwapInt32(&m.didCloseConn, 0, 1) {
		m.conn.Close()
	}
	go func() {
		m.streamsMutex.Lock()
		for _, stream := range m.streams {
			stream.mutex.Lock()
			stream.readWake.Signal()
			stream.mutex.Unlock()
		}
		m.streams = make(map[int64]*muxerStream)
		m.streamsMutex.Unlock()
	}()
	m.result <- err
}

type muxerStream struct {
	id           int64
	muxer        *Muxer
	readBuf      bytes.Buffer
	mutex        *sync.Mutex
	readWake     *sync.Cond
	isClosed     bool
	remoteClosed bool
}

func (s *muxerStream) Read(p []byte) (int, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	for {
		if s.muxer.IsClosed() {
			return 0, fmt.Errorf("muxer closed")
		} else if s.isClosed {
			return 0, io.EOF
		} else if s.readBuf.Len() > 0 {
			return s.readBuf.Read(p)
		} else if s.remoteClosed {
			return 0, io.EOF
		}
		s.readWake.Wait()
	}
}

func (s *muxerStream) Write(p []byte) (int, error) {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if s.isClosed {
		return 0, fmt.Errorf("stream closed")
	}
	return s.muxer.write(p, s.id)
}

func (s *muxerStream) Close() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()
	if !s.isClosed {
		s.muxer.write(nil, s.id)
		s.isClosed = true
		s.muxer.rm(s.id)
	}
	s.readWake.Signal()
	return nil
}
