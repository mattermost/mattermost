package migrate

import (
	"bufio"
	"fmt"
	"io"
	"time"
)

// DefaultBufferSize sets the in memory buffer size (in Bytes) for every
// pre-read migration (see DefaultPrefetchMigrations).
var DefaultBufferSize = uint(100000)

// Migration holds information about a migration.
// It is initially created from data coming from the source and then
// used when run against the database.
type Migration struct {
	// Identifier can be any string to help identifying
	// the migration in the source.
	Identifier string

	// Version is the version of this migration.
	Version uint

	// TargetVersion is the migration version after this migration
	// has been applied to the database.
	// Can be -1, implying that this is a NilVersion.
	TargetVersion int

	// Body holds an io.ReadCloser to the source.
	Body io.ReadCloser

	// BufferedBody holds an buffered io.Reader to the underlying Body.
	BufferedBody io.Reader

	// BufferSize defaults to DefaultBufferSize
	BufferSize uint

	// bufferWriter holds an io.WriteCloser and pipes to BufferBody.
	// It's an *Closer for flow control.
	bufferWriter io.WriteCloser

	// Scheduled is the time when the migration was scheduled/ queued.
	Scheduled time.Time

	// StartedBuffering is the time when buffering of the migration source started.
	StartedBuffering time.Time

	// FinishedBuffering is the time when buffering of the migration source finished.
	FinishedBuffering time.Time

	// FinishedReading is the time when the migration source is fully read.
	FinishedReading time.Time

	// BytesRead holds the number of Bytes read from the migration source.
	BytesRead int64
}

// NewMigration returns a new Migration and sets the body, identifier,
// version and targetVersion. Body can be nil, which turns this migration
// into a "NilMigration". If no identifier is provided, it will default to "<empty>".
// targetVersion can be -1, implying it is a NilVersion.
//
// What is a NilMigration?
// Usually each migration version coming from source is expected to have an
// Up and Down migration. This is not a hard requirement though, leading to
// a situation where only the Up or Down migration is present. So let's say
// the user wants to migrate up to a version that doesn't have the actual Up
// migration, in that case we still want to apply the version, but with an empty
// body. We are calling that a NilMigration, a migration with an empty body.
//
// What is a NilVersion?
// NilVersion is a const(-1). When running down migrations and we are at the
// last down migration, there is no next down migration, the targetVersion should
// be nil. Nil in this case is represented by -1 (because type int).
func NewMigration(body io.ReadCloser, identifier string,
	version uint, targetVersion int) (*Migration, error) {
	tnow := time.Now()
	m := &Migration{
		Identifier:    identifier,
		Version:       version,
		TargetVersion: targetVersion,
		Scheduled:     tnow,
	}

	if body == nil {
		if len(identifier) == 0 {
			m.Identifier = "<empty>"
		}

		m.StartedBuffering = tnow
		m.FinishedBuffering = tnow
		m.FinishedReading = tnow
		return m, nil
	}

	br, bw := io.Pipe()
	m.Body = body // want to simulate low latency? newSlowReader(body)
	m.BufferSize = DefaultBufferSize
	m.BufferedBody = br
	m.bufferWriter = bw
	return m, nil
}

// String implements string.Stringer and is used in tests.
func (m *Migration) String() string {
	return fmt.Sprintf("%v [%v=>%v]", m.Identifier, m.Version, m.TargetVersion)
}

// LogString returns a string describing this migration to humans.
func (m *Migration) LogString() string {
	directionStr := "u"
	if m.TargetVersion < int(m.Version) {
		directionStr = "d"
	}
	return fmt.Sprintf("%v/%v %v", m.Version, directionStr, m.Identifier)
}

// Buffer buffers Body up to BufferSize.
// Calling this function blocks. Call with goroutine.
func (m *Migration) Buffer() error {
	if m.Body == nil {
		return nil
	}

	m.StartedBuffering = time.Now()

	b := bufio.NewReaderSize(m.Body, int(m.BufferSize))

	// start reading from body, peek won't move the read pointer though
	// poor man's solution?
	if _, err := b.Peek(int(m.BufferSize)); err != nil && err != io.EOF {
		return err
	}

	m.FinishedBuffering = time.Now()

	// write to bufferWriter, this will block until
	// something starts reading from m.Buffer
	n, err := b.WriteTo(m.bufferWriter)
	if err != nil {
		return err
	}

	m.FinishedReading = time.Now()
	m.BytesRead = n

	// close bufferWriter so Buffer knows that there is no
	// more data coming
	if err := m.bufferWriter.Close(); err != nil {
		return err
	}

	// it's safe to close the Body too
	if err := m.Body.Close(); err != nil {
		return err
	}

	return nil
}
