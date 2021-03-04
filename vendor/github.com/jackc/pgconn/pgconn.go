package pgconn

import (
	"context"
	"crypto/md5"
	"crypto/tls"
	"encoding/binary"
	"encoding/hex"
	"io"
	"math"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgconn/internal/ctxwatch"
	"github.com/jackc/pgio"
	"github.com/jackc/pgproto3/v2"
	errors "golang.org/x/xerrors"
)

const (
	connStatusUninitialized = iota
	connStatusConnecting
	connStatusClosed
	connStatusIdle
	connStatusBusy
)

const wbufLen = 1024

// Notice represents a notice response message reported by the PostgreSQL server. Be aware that this is distinct from
// LISTEN/NOTIFY notification.
type Notice PgError

// Notification is a message received from the PostgreSQL LISTEN/NOTIFY system
type Notification struct {
	PID     uint32 // backend pid that sent the notification
	Channel string // channel from which notification was received
	Payload string
}

// DialFunc is a function that can be used to connect to a PostgreSQL server.
type DialFunc func(ctx context.Context, network, addr string) (net.Conn, error)

// LookupFunc is a function that can be used to lookup IPs addrs from host.
type LookupFunc func(ctx context.Context, host string) (addrs []string, err error)

// BuildFrontendFunc is a function that can be used to create Frontend implementation for connection.
type BuildFrontendFunc func(r io.Reader, w io.Writer) Frontend

// NoticeHandler is a function that can handle notices received from the PostgreSQL server. Notices can be received at
// any time, usually during handling of a query response. The *PgConn is provided so the handler is aware of the origin
// of the notice, but it must not invoke any query method. Be aware that this is distinct from LISTEN/NOTIFY
// notification.
type NoticeHandler func(*PgConn, *Notice)

// NotificationHandler is a function that can handle notifications received from the PostgreSQL server. Notifications
// can be received at any time, usually during handling of a query response. The *PgConn is provided so the handler is
// aware of the origin of the notice, but it must not invoke any query method. Be aware that this is distinct from a
// notice event.
type NotificationHandler func(*PgConn, *Notification)

// Frontend used to receive messages from backend.
type Frontend interface {
	Receive() (pgproto3.BackendMessage, error)
}

// PgConn is a low-level PostgreSQL connection handle. It is not safe for concurrent usage.
type PgConn struct {
	conn              net.Conn          // the underlying TCP or unix domain socket connection
	pid               uint32            // backend pid
	secretKey         uint32            // key to use to send a cancel query message to the server
	parameterStatuses map[string]string // parameters that have been reported by the server
	txStatus          byte
	frontend          Frontend

	config *Config

	status byte // One of connStatus* constants

	bufferingReceive    bool
	bufferingReceiveMux sync.Mutex
	bufferingReceiveMsg pgproto3.BackendMessage
	bufferingReceiveErr error

	// Reusable / preallocated resources
	wbuf              []byte // write buffer
	resultReader      ResultReader
	multiResultReader MultiResultReader
	contextWatcher    *ctxwatch.ContextWatcher
}

// Connect establishes a connection to a PostgreSQL server using the environment and connString (in URL or DSN format)
// to provide configuration. See documention for ParseConfig for details. ctx can be used to cancel a connect attempt.
func Connect(ctx context.Context, connString string) (*PgConn, error) {
	config, err := ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	return ConnectConfig(ctx, config)
}

// Connect establishes a connection to a PostgreSQL server using config. config must have been constructed with
// ParseConfig. ctx can be used to cancel a connect attempt.
//
// If config.Fallbacks are present they will sequentially be tried in case of error establishing network connection. An
// authentication error will terminate the chain of attempts (like libpq:
// https://www.postgresql.org/docs/11/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS) and be returned as the error. Otherwise,
// if all attempts fail the last error is returned.
func ConnectConfig(ctx context.Context, config *Config) (pgConn *PgConn, err error) {
	// Default values are set in ParseConfig. Enforce initial creation by ParseConfig rather than setting defaults from
	// zero values.
	if !config.createdByParseConfig {
		panic("config must be created by ParseConfig")
	}

	// Simplify usage by treating primary config and fallbacks the same.
	fallbackConfigs := []*FallbackConfig{
		{
			Host:      config.Host,
			Port:      config.Port,
			TLSConfig: config.TLSConfig,
		},
	}
	fallbackConfigs = append(fallbackConfigs, config.Fallbacks...)

	fallbackConfigs, err = expandWithIPs(ctx, config.LookupFunc, fallbackConfigs)
	if err != nil {
		return nil, &connectError{config: config, msg: "hostname resolving error", err: err}
	}

	if len(fallbackConfigs) == 0 {
		return nil, &connectError{config: config, msg: "hostname resolving error", err: errors.New("ip addr wasn't found")}
	}

	for _, fc := range fallbackConfigs {
		pgConn, err = connect(ctx, config, fc)
		if err == nil {
			break
		} else if err, ok := err.(*PgError); ok {
			return nil, &connectError{config: config, msg: "server error", err: err}
		}
	}

	if err != nil {
		return nil, err // no need to wrap in connectError because it will already be wrapped in all cases except PgError
	}

	if config.AfterConnect != nil {
		err := config.AfterConnect(ctx, pgConn)
		if err != nil {
			pgConn.conn.Close()
			return nil, &connectError{config: config, msg: "AfterConnect error", err: err}
		}
	}

	return pgConn, nil
}

func expandWithIPs(ctx context.Context, lookupFn LookupFunc, fallbacks []*FallbackConfig) ([]*FallbackConfig, error) {
	var configs []*FallbackConfig

	for _, fb := range fallbacks {
		// skip resolve for unix sockets
		if strings.HasPrefix(fb.Host, "/") {
			configs = append(configs, &FallbackConfig{
				Host:      fb.Host,
				Port:      fb.Port,
				TLSConfig: fb.TLSConfig,
			})

			continue
		}

		ips, err := lookupFn(ctx, fb.Host)
		if err != nil {
			return nil, err
		}

		for _, ip := range ips {
			configs = append(configs, &FallbackConfig{
				Host:      ip,
				Port:      fb.Port,
				TLSConfig: fb.TLSConfig,
			})
		}
	}

	return configs, nil
}

func connect(ctx context.Context, config *Config, fallbackConfig *FallbackConfig) (*PgConn, error) {
	pgConn := new(PgConn)
	pgConn.config = config
	pgConn.wbuf = make([]byte, 0, wbufLen)

	var err error
	network, address := NetworkAddress(fallbackConfig.Host, fallbackConfig.Port)
	pgConn.conn, err = config.DialFunc(ctx, network, address)
	if err != nil {
		return nil, &connectError{config: config, msg: "dial error", err: err}
	}

	pgConn.parameterStatuses = make(map[string]string)

	if fallbackConfig.TLSConfig != nil {
		if err := pgConn.startTLS(fallbackConfig.TLSConfig); err != nil {
			pgConn.conn.Close()
			return nil, &connectError{config: config, msg: "tls error", err: err}
		}
	}

	pgConn.status = connStatusConnecting
	pgConn.contextWatcher = ctxwatch.NewContextWatcher(
		func() { pgConn.conn.SetDeadline(time.Date(1, 1, 1, 1, 1, 1, 1, time.UTC)) },
		func() { pgConn.conn.SetDeadline(time.Time{}) },
	)

	pgConn.contextWatcher.Watch(ctx)
	defer pgConn.contextWatcher.Unwatch()

	pgConn.frontend = config.BuildFrontend(pgConn.conn, pgConn.conn)

	startupMsg := pgproto3.StartupMessage{
		ProtocolVersion: pgproto3.ProtocolVersionNumber,
		Parameters:      make(map[string]string),
	}

	// Copy default run-time params
	for k, v := range config.RuntimeParams {
		startupMsg.Parameters[k] = v
	}

	startupMsg.Parameters["user"] = config.User
	if config.Database != "" {
		startupMsg.Parameters["database"] = config.Database
	}

	if _, err := pgConn.conn.Write(startupMsg.Encode(pgConn.wbuf)); err != nil {
		pgConn.conn.Close()
		return nil, &connectError{config: config, msg: "failed to write startup message", err: err}
	}

	for {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			pgConn.conn.Close()
			if err, ok := err.(*PgError); ok {
				return nil, err
			}
			return nil, &connectError{config: config, msg: "failed to receive message", err: err}
		}

		switch msg := msg.(type) {
		case *pgproto3.BackendKeyData:
			pgConn.pid = msg.ProcessID
			pgConn.secretKey = msg.SecretKey

		case *pgproto3.AuthenticationOk:
		case *pgproto3.AuthenticationCleartextPassword:
			err = pgConn.txPasswordMessage(pgConn.config.Password)
			if err != nil {
				pgConn.conn.Close()
				return nil, &connectError{config: config, msg: "failed to write password message", err: err}
			}
		case *pgproto3.AuthenticationMD5Password:
			digestedPassword := "md5" + hexMD5(hexMD5(pgConn.config.Password+pgConn.config.User)+string(msg.Salt[:]))
			err = pgConn.txPasswordMessage(digestedPassword)
			if err != nil {
				pgConn.conn.Close()
				return nil, &connectError{config: config, msg: "failed to write password message", err: err}
			}
		case *pgproto3.AuthenticationSASL:
			err = pgConn.scramAuth(msg.AuthMechanisms)
			if err != nil {
				pgConn.conn.Close()
				return nil, &connectError{config: config, msg: "failed SASL auth", err: err}
			}

		case *pgproto3.ReadyForQuery:
			pgConn.status = connStatusIdle
			if config.ValidateConnect != nil {
				err := config.ValidateConnect(ctx, pgConn)
				if err != nil {
					pgConn.conn.Close()
					return nil, &connectError{config: config, msg: "ValidateConnect failed", err: err}
				}
			}
			return pgConn, nil
		case *pgproto3.ParameterStatus:
			// handled by ReceiveMessage
		case *pgproto3.ErrorResponse:
			pgConn.conn.Close()
			return nil, ErrorResponseToPgError(msg)
		default:
			pgConn.conn.Close()
			return nil, &connectError{config: config, msg: "received unexpected message", err: err}
		}
	}
}

func (pgConn *PgConn) startTLS(tlsConfig *tls.Config) (err error) {
	err = binary.Write(pgConn.conn, binary.BigEndian, []int32{8, 80877103})
	if err != nil {
		return
	}

	response := make([]byte, 1)
	if _, err = io.ReadFull(pgConn.conn, response); err != nil {
		return
	}

	if response[0] != 'S' {
		return errors.New("server refused TLS connection")
	}

	pgConn.conn = tls.Client(pgConn.conn, tlsConfig)

	return nil
}

func (pgConn *PgConn) txPasswordMessage(password string) (err error) {
	msg := &pgproto3.PasswordMessage{Password: password}
	_, err = pgConn.conn.Write(msg.Encode(pgConn.wbuf))
	return err
}

func hexMD5(s string) string {
	hash := md5.New()
	io.WriteString(hash, s)
	return hex.EncodeToString(hash.Sum(nil))
}

func (pgConn *PgConn) signalMessage() chan struct{} {
	if pgConn.bufferingReceive {
		panic("BUG: signalMessage when already in progress")
	}

	pgConn.bufferingReceive = true
	pgConn.bufferingReceiveMux.Lock()

	ch := make(chan struct{})
	go func() {
		pgConn.bufferingReceiveMsg, pgConn.bufferingReceiveErr = pgConn.frontend.Receive()
		pgConn.bufferingReceiveMux.Unlock()
		close(ch)
	}()

	return ch
}

// SendBytes sends buf to the PostgreSQL server. It must only be used when the connection is not busy. e.g. It is as
// error to call SendBytes while reading the result of a query.
//
// This is a very low level method that requires deep understanding of the PostgreSQL wire protocol to use correctly.
// See https://www.postgresql.org/docs/current/protocol.html.
func (pgConn *PgConn) SendBytes(ctx context.Context, buf []byte) error {
	if err := pgConn.lock(); err != nil {
		return err
	}
	defer pgConn.unlock()

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			return &contextAlreadyDoneError{err: ctx.Err()}
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		return &writeError{err: err, safeToRetry: n == 0}
	}

	return nil
}

// ReceiveMessage receives one wire protocol message from the PostgreSQL server. It must only be used when the
// connection is not busy. e.g. It is an error to call ReceiveMessage while reading the result of a query. The messages
// are still handled by the core pgconn message handling system so receiving a NotificationResponse will still trigger
// the OnNotification callback.
//
// This is a very low level method that requires deep understanding of the PostgreSQL wire protocol to use correctly.
// See https://www.postgresql.org/docs/current/protocol.html.
func (pgConn *PgConn) ReceiveMessage(ctx context.Context) (pgproto3.BackendMessage, error) {
	if err := pgConn.lock(); err != nil {
		return nil, err
	}
	defer pgConn.unlock()

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			return nil, &contextAlreadyDoneError{err: ctx.Err()}
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	msg, err := pgConn.receiveMessage()
	if err != nil {
		err = &pgconnError{msg: "receive message failed", err: err, safeToRetry: true}
	}
	return msg, err
}

// receiveMessage receives a message without setting up context cancellation
func (pgConn *PgConn) receiveMessage() (pgproto3.BackendMessage, error) {
	var msg pgproto3.BackendMessage
	var err error
	if pgConn.bufferingReceive {
		pgConn.bufferingReceiveMux.Lock()
		msg = pgConn.bufferingReceiveMsg
		err = pgConn.bufferingReceiveErr
		pgConn.bufferingReceiveMux.Unlock()
		pgConn.bufferingReceive = false

		// If a timeout error happened in the background try the read again.
		if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
			msg, err = pgConn.frontend.Receive()
		}
	} else {
		msg, err = pgConn.frontend.Receive()
	}

	if err != nil {
		// Close on anything other than timeout error - everything else is fatal
		if err, ok := err.(net.Error); !(ok && err.Timeout()) {
			pgConn.asyncClose()
		}

		return nil, err
	}

	switch msg := msg.(type) {
	case *pgproto3.ReadyForQuery:
		pgConn.txStatus = msg.TxStatus
	case *pgproto3.ParameterStatus:
		pgConn.parameterStatuses[msg.Name] = msg.Value
	case *pgproto3.ErrorResponse:
		if msg.Severity == "FATAL" {
			pgConn.asyncClose()
			return nil, ErrorResponseToPgError(msg)
		}
	case *pgproto3.NoticeResponse:
		if pgConn.config.OnNotice != nil {
			pgConn.config.OnNotice(pgConn, noticeResponseToNotice(msg))
		}
	case *pgproto3.NotificationResponse:
		if pgConn.config.OnNotification != nil {
			pgConn.config.OnNotification(pgConn, &Notification{PID: msg.PID, Channel: msg.Channel, Payload: msg.Payload})
		}
	}

	return msg, nil
}

// Conn returns the underlying net.Conn.
func (pgConn *PgConn) Conn() net.Conn {
	return pgConn.conn
}

// PID returns the backend PID.
func (pgConn *PgConn) PID() uint32 {
	return pgConn.pid
}

// TxStatus returns the current TxStatus as reported by the server.
func (pgConn *PgConn) TxStatus() byte {
	return pgConn.txStatus
}

// SecretKey returns the backend secret key used to send a cancel query message to the server.
func (pgConn *PgConn) SecretKey() uint32 {
	return pgConn.secretKey
}

// Close closes a connection. It is safe to call Close on a already closed connection. Close attempts a clean close by
// sending the exit message to PostgreSQL. However, this could block so ctx is available to limit the time to wait. The
// underlying net.Conn.Close() will always be called regardless of any other errors.
func (pgConn *PgConn) Close(ctx context.Context) error {
	if pgConn.status == connStatusClosed {
		return nil
	}
	pgConn.status = connStatusClosed

	defer pgConn.conn.Close()

	if ctx != context.Background() {
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	// Ignore any errors sending Terminate message and waiting for server to close connection.
	// This mimics the behavior of libpq PQfinish. It calls closePGconn which calls sendTerminateConn which purposefully
	// ignores errors.
	//
	// See https://github.com/jackc/pgx/issues/637
	pgConn.conn.Write([]byte{'X', 0, 0, 0, 4})
	pgConn.conn.Read(make([]byte, 1))

	return pgConn.conn.Close()
}

// asyncClose marks the connection as closed and asynchronously sends a cancel query message and closes the underlying
// connection.
func (pgConn *PgConn) asyncClose() {
	if pgConn.status == connStatusClosed {
		return
	}
	pgConn.status = connStatusClosed

	go func() {
		defer pgConn.conn.Close()

		deadline := time.Now().Add(time.Second * 15)

		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		defer cancel()

		pgConn.CancelRequest(ctx)

		pgConn.conn.SetDeadline(deadline)

		pgConn.conn.Write([]byte{'X', 0, 0, 0, 4})
		pgConn.conn.Read(make([]byte, 1))
	}()
}

// IsClosed reports if the connection has been closed.
func (pgConn *PgConn) IsClosed() bool {
	return pgConn.status < connStatusIdle
}

// IsBusy reports if the connection is busy.
func (pgConn *PgConn) IsBusy() bool {
	return pgConn.status == connStatusBusy
}

// lock locks the connection.
func (pgConn *PgConn) lock() error {
	switch pgConn.status {
	case connStatusBusy:
		return &connLockError{status: "conn busy"} // This only should be possible in case of an application bug.
	case connStatusClosed:
		return &connLockError{status: "conn closed"}
	case connStatusUninitialized:
		return &connLockError{status: "conn uninitialized"}
	}
	pgConn.status = connStatusBusy
	return nil
}

func (pgConn *PgConn) unlock() {
	switch pgConn.status {
	case connStatusBusy:
		pgConn.status = connStatusIdle
	case connStatusClosed:
	default:
		panic("BUG: cannot unlock unlocked connection") // This should only be possible if there is a bug in this package.
	}
}

// ParameterStatus returns the value of a parameter reported by the server (e.g.
// server_version). Returns an empty string for unknown parameters.
func (pgConn *PgConn) ParameterStatus(key string) string {
	return pgConn.parameterStatuses[key]
}

// CommandTag is the result of an Exec function
type CommandTag []byte

// RowsAffected returns the number of rows affected. If the CommandTag was not
// for a row affecting command (e.g. "CREATE TABLE") then it returns 0.
func (ct CommandTag) RowsAffected() int64 {
	// Find last non-digit
	idx := -1
	for i := len(ct) - 1; i >= 0; i-- {
		if ct[i] >= '0' && ct[i] <= '9' {
			idx = i
		} else {
			break
		}
	}

	if idx == -1 {
		return 0
	}

	var n int64
	for _, b := range ct[idx:] {
		n = n*10 + int64(b-'0')
	}

	return n
}

func (ct CommandTag) String() string {
	return string(ct)
}

// Insert is true if the command tag starts with "INSERT".
func (ct CommandTag) Insert() bool {
	return len(ct) >= 6 &&
		ct[0] == 'I' &&
		ct[1] == 'N' &&
		ct[2] == 'S' &&
		ct[3] == 'E' &&
		ct[4] == 'R' &&
		ct[5] == 'T'
}

// Update is true if the command tag starts with "UPDATE".
func (ct CommandTag) Update() bool {
	return len(ct) >= 6 &&
		ct[0] == 'U' &&
		ct[1] == 'P' &&
		ct[2] == 'D' &&
		ct[3] == 'A' &&
		ct[4] == 'T' &&
		ct[5] == 'E'
}

// Delete is true if the command tag starts with "DELETE".
func (ct CommandTag) Delete() bool {
	return len(ct) >= 6 &&
		ct[0] == 'D' &&
		ct[1] == 'E' &&
		ct[2] == 'L' &&
		ct[3] == 'E' &&
		ct[4] == 'T' &&
		ct[5] == 'E'
}

// Select is true if the command tag starts with "SELECT".
func (ct CommandTag) Select() bool {
	return len(ct) >= 6 &&
		ct[0] == 'S' &&
		ct[1] == 'E' &&
		ct[2] == 'L' &&
		ct[3] == 'E' &&
		ct[4] == 'C' &&
		ct[5] == 'T'
}

type StatementDescription struct {
	Name      string
	SQL       string
	ParamOIDs []uint32
	Fields    []pgproto3.FieldDescription
}

// Prepare creates a prepared statement. If the name is empty, the anonymous prepared statement will be used. This
// allows Prepare to also to describe statements without creating a server-side prepared statement.
func (pgConn *PgConn) Prepare(ctx context.Context, name, sql string, paramOIDs []uint32) (*StatementDescription, error) {
	if err := pgConn.lock(); err != nil {
		return nil, err
	}
	defer pgConn.unlock()

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			return nil, &contextAlreadyDoneError{err: ctx.Err()}
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	buf := pgConn.wbuf
	buf = (&pgproto3.Parse{Name: name, Query: sql, ParameterOIDs: paramOIDs}).Encode(buf)
	buf = (&pgproto3.Describe{ObjectType: 'S', Name: name}).Encode(buf)
	buf = (&pgproto3.Sync{}).Encode(buf)

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		return nil, &writeError{err: err, safeToRetry: n == 0}
	}

	psd := &StatementDescription{Name: name, SQL: sql}

	var parseErr error

readloop:
	for {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			pgConn.asyncClose()
			return nil, err
		}

		switch msg := msg.(type) {
		case *pgproto3.ParameterDescription:
			psd.ParamOIDs = make([]uint32, len(msg.ParameterOIDs))
			copy(psd.ParamOIDs, msg.ParameterOIDs)
		case *pgproto3.RowDescription:
			psd.Fields = make([]pgproto3.FieldDescription, len(msg.Fields))
			copy(psd.Fields, msg.Fields)
		case *pgproto3.ErrorResponse:
			parseErr = ErrorResponseToPgError(msg)
		case *pgproto3.ReadyForQuery:
			break readloop
		}
	}

	if parseErr != nil {
		return nil, parseErr
	}
	return psd, nil
}

// ErrorResponseToPgError converts a wire protocol error message to a *PgError.
func ErrorResponseToPgError(msg *pgproto3.ErrorResponse) *PgError {
	return &PgError{
		Severity:         msg.Severity,
		Code:             string(msg.Code),
		Message:          string(msg.Message),
		Detail:           string(msg.Detail),
		Hint:             msg.Hint,
		Position:         msg.Position,
		InternalPosition: msg.InternalPosition,
		InternalQuery:    string(msg.InternalQuery),
		Where:            string(msg.Where),
		SchemaName:       string(msg.SchemaName),
		TableName:        string(msg.TableName),
		ColumnName:       string(msg.ColumnName),
		DataTypeName:     string(msg.DataTypeName),
		ConstraintName:   msg.ConstraintName,
		File:             string(msg.File),
		Line:             msg.Line,
		Routine:          string(msg.Routine),
	}
}

func noticeResponseToNotice(msg *pgproto3.NoticeResponse) *Notice {
	pgerr := ErrorResponseToPgError((*pgproto3.ErrorResponse)(msg))
	return (*Notice)(pgerr)
}

// CancelRequest sends a cancel request to the PostgreSQL server. It returns an error if unable to deliver the cancel
// request, but lack of an error does not ensure that the query was canceled. As specified in the documentation, there
// is no way to be sure a query was canceled. See https://www.postgresql.org/docs/11/protocol-flow.html#id-1.10.5.7.9
func (pgConn *PgConn) CancelRequest(ctx context.Context) error {
	// Open a cancellation request to the same server. The address is taken from the net.Conn directly instead of reusing
	// the connection config. This is important in high availability configurations where fallback connections may be
	// specified or DNS may be used to load balance.
	serverAddr := pgConn.conn.RemoteAddr()
	cancelConn, err := pgConn.config.DialFunc(ctx, serverAddr.Network(), serverAddr.String())
	if err != nil {
		return err
	}
	defer cancelConn.Close()

	if ctx != context.Background() {
		contextWatcher := ctxwatch.NewContextWatcher(
			func() { cancelConn.SetDeadline(time.Date(1, 1, 1, 1, 1, 1, 1, time.UTC)) },
			func() { cancelConn.SetDeadline(time.Time{}) },
		)
		contextWatcher.Watch(ctx)
		defer contextWatcher.Unwatch()
	}

	buf := make([]byte, 16)
	binary.BigEndian.PutUint32(buf[0:4], 16)
	binary.BigEndian.PutUint32(buf[4:8], 80877102)
	binary.BigEndian.PutUint32(buf[8:12], uint32(pgConn.pid))
	binary.BigEndian.PutUint32(buf[12:16], uint32(pgConn.secretKey))
	_, err = cancelConn.Write(buf)
	if err != nil {
		return err
	}

	_, err = cancelConn.Read(buf)
	if err != io.EOF {
		return err
	}

	return nil
}

// WaitForNotification waits for a LISTON/NOTIFY message to be received. It returns an error if a notification was not
// received.
func (pgConn *PgConn) WaitForNotification(ctx context.Context) error {
	if err := pgConn.lock(); err != nil {
		return err
	}
	defer pgConn.unlock()

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	for {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			return err
		}

		switch msg.(type) {
		case *pgproto3.NotificationResponse:
			return nil
		}
	}
}

// Exec executes SQL via the PostgreSQL simple query protocol. SQL may contain multiple queries. Execution is
// implicitly wrapped in a transaction unless a transaction is already in progress or SQL contains transaction control
// statements.
//
// Prefer ExecParams unless executing arbitrary SQL that may contain multiple queries.
func (pgConn *PgConn) Exec(ctx context.Context, sql string) *MultiResultReader {
	if err := pgConn.lock(); err != nil {
		return &MultiResultReader{
			closed: true,
			err:    err,
		}
	}

	pgConn.multiResultReader = MultiResultReader{
		pgConn: pgConn,
		ctx:    ctx,
	}
	multiResult := &pgConn.multiResultReader
	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			multiResult.closed = true
			multiResult.err = &contextAlreadyDoneError{err: ctx.Err()}
			pgConn.unlock()
			return multiResult
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
	}

	buf := pgConn.wbuf
	buf = (&pgproto3.Query{String: sql}).Encode(buf)

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		pgConn.contextWatcher.Unwatch()
		multiResult.closed = true
		multiResult.err = &writeError{err: err, safeToRetry: n == 0}
		pgConn.unlock()
		return multiResult
	}

	return multiResult
}

// ExecParams executes a command via the PostgreSQL extended query protocol.
//
// sql is a SQL command string. It may only contain one query. Parameter substitution is positional using $1, $2, $3,
// etc.
//
// paramValues are the parameter values. It must be encoded in the format given by paramFormats.
//
// paramOIDs is a slice of data type OIDs for paramValues. If paramOIDs is nil, the server will infer the data type for
// all parameters. Any paramOID element that is 0 that will cause the server to infer the data type for that parameter.
// ExecParams will panic if len(paramOIDs) is not 0, 1, or len(paramValues).
//
// paramFormats is a slice of format codes determining for each paramValue column whether it is encoded in text or
// binary format. If paramFormats is nil all results will be in text protocol. ExecParams will panic if
// len(paramFormats) is not 0, 1, or len(paramValues).
//
// resultFormats is a slice of format codes determining for each result column whether it is encoded in text or
// binary format. If resultFormats is nil all results will be in text protocol.
//
// ResultReader must be closed before PgConn can be used again.
func (pgConn *PgConn) ExecParams(ctx context.Context, sql string, paramValues [][]byte, paramOIDs []uint32, paramFormats []int16, resultFormats []int16) *ResultReader {
	result := pgConn.execExtendedPrefix(ctx, paramValues)
	if result.closed {
		return result
	}

	buf := pgConn.wbuf
	buf = (&pgproto3.Parse{Query: sql, ParameterOIDs: paramOIDs}).Encode(buf)
	buf = (&pgproto3.Bind{ParameterFormatCodes: paramFormats, Parameters: paramValues, ResultFormatCodes: resultFormats}).Encode(buf)

	pgConn.execExtendedSuffix(buf, result)

	return result
}

// ExecPrepared enqueues the execution of a prepared statement via the PostgreSQL extended query protocol.
//
// paramValues are the parameter values. It must be encoded in the format given by paramFormats.
//
// paramFormats is a slice of format codes determining for each paramValue column whether it is encoded in text or
// binary format. If paramFormats is nil all results will be in text protocol. ExecPrepared will panic if
// len(paramFormats) is not 0, 1, or len(paramValues).
//
// resultFormats is a slice of format codes determining for each result column whether it is encoded in text or
// binary format. If resultFormats is nil all results will be in text protocol.
//
// ResultReader must be closed before PgConn can be used again.
func (pgConn *PgConn) ExecPrepared(ctx context.Context, stmtName string, paramValues [][]byte, paramFormats []int16, resultFormats []int16) *ResultReader {
	result := pgConn.execExtendedPrefix(ctx, paramValues)
	if result.closed {
		return result
	}

	buf := pgConn.wbuf
	buf = (&pgproto3.Bind{PreparedStatement: stmtName, ParameterFormatCodes: paramFormats, Parameters: paramValues, ResultFormatCodes: resultFormats}).Encode(buf)

	pgConn.execExtendedSuffix(buf, result)

	return result
}

func (pgConn *PgConn) execExtendedPrefix(ctx context.Context, paramValues [][]byte) *ResultReader {
	pgConn.resultReader = ResultReader{
		pgConn: pgConn,
		ctx:    ctx,
	}
	result := &pgConn.resultReader

	if err := pgConn.lock(); err != nil {
		result.concludeCommand(nil, err)
		result.closed = true
		return result
	}

	if len(paramValues) > math.MaxUint16 {
		result.concludeCommand(nil, errors.Errorf("extended protocol limited to %v parameters", math.MaxUint16))
		result.closed = true
		pgConn.unlock()
		return result
	}

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			result.concludeCommand(nil, &contextAlreadyDoneError{err: ctx.Err()})
			result.closed = true
			pgConn.unlock()
			return result
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
	}

	return result
}

func (pgConn *PgConn) execExtendedSuffix(buf []byte, result *ResultReader) {
	buf = (&pgproto3.Describe{ObjectType: 'P'}).Encode(buf)
	buf = (&pgproto3.Execute{}).Encode(buf)
	buf = (&pgproto3.Sync{}).Encode(buf)

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		result.concludeCommand(nil, &writeError{err: err, safeToRetry: n == 0})
		pgConn.contextWatcher.Unwatch()
		result.closed = true
		pgConn.unlock()
	}
}

// CopyTo executes the copy command sql and copies the results to w.
func (pgConn *PgConn) CopyTo(ctx context.Context, w io.Writer, sql string) (CommandTag, error) {
	if err := pgConn.lock(); err != nil {
		return nil, err
	}

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			pgConn.unlock()
			return nil, &contextAlreadyDoneError{err: ctx.Err()}
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	// Send copy to command
	buf := pgConn.wbuf
	buf = (&pgproto3.Query{String: sql}).Encode(buf)

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		pgConn.unlock()
		return nil, &writeError{err: err, safeToRetry: n == 0}
	}

	// Read results
	var commandTag CommandTag
	var pgErr error
	for {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			pgConn.asyncClose()
			return nil, err
		}

		switch msg := msg.(type) {
		case *pgproto3.CopyDone:
		case *pgproto3.CopyData:
			_, err := w.Write(msg.Data)
			if err != nil {
				pgConn.asyncClose()
				return nil, err
			}
		case *pgproto3.ReadyForQuery:
			pgConn.unlock()
			return commandTag, pgErr
		case *pgproto3.CommandComplete:
			commandTag = CommandTag(msg.CommandTag)
		case *pgproto3.ErrorResponse:
			pgErr = ErrorResponseToPgError(msg)
		}
	}
}

// CopyFrom executes the copy command sql and copies all of r to the PostgreSQL server.
//
// Note: context cancellation will only interrupt operations on the underlying PostgreSQL network connection. Reads on r
// could still block.
func (pgConn *PgConn) CopyFrom(ctx context.Context, r io.Reader, sql string) (CommandTag, error) {
	if err := pgConn.lock(); err != nil {
		return nil, err
	}
	defer pgConn.unlock()

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			return nil, &contextAlreadyDoneError{err: ctx.Err()}
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
		defer pgConn.contextWatcher.Unwatch()
	}

	// Send copy to command
	buf := pgConn.wbuf
	buf = (&pgproto3.Query{String: sql}).Encode(buf)

	n, err := pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		return nil, &writeError{err: err, safeToRetry: n == 0}
	}

	// Read until copy in response or error.
	var commandTag CommandTag
	var pgErr error
	pendingCopyInResponse := true
	for pendingCopyInResponse {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			pgConn.asyncClose()
			return nil, err
		}

		switch msg := msg.(type) {
		case *pgproto3.CopyInResponse:
			pendingCopyInResponse = false
		case *pgproto3.ErrorResponse:
			pgErr = ErrorResponseToPgError(msg)
		case *pgproto3.ReadyForQuery:
			return commandTag, pgErr
		}
	}

	// Send copy data
	abortCopyChan := make(chan struct{})
	copyErrChan := make(chan error, 1)
	signalMessageChan := pgConn.signalMessage()

	go func() {
		buf := make([]byte, 0, 65536)
		buf = append(buf, 'd')
		sp := len(buf)

		for {
			n, readErr := r.Read(buf[5:cap(buf)])
			if n > 0 {
				buf = buf[0 : n+5]
				pgio.SetInt32(buf[sp:], int32(n+4))

				_, writeErr := pgConn.conn.Write(buf)
				if writeErr != nil {
					// Write errors are always fatal, but we can't use asyncClose because we are in a different goroutine.
					pgConn.conn.Close()

					copyErrChan <- writeErr
					return
				}
			}
			if readErr != nil {
				copyErrChan <- readErr
				return
			}

			select {
			case <-abortCopyChan:
				return
			default:
			}
		}
	}()

	var copyErr error
	for copyErr == nil && pgErr == nil {
		select {
		case copyErr = <-copyErrChan:
		case <-signalMessageChan:
			msg, err := pgConn.receiveMessage()
			if err != nil {
				pgConn.asyncClose()
				return nil, err
			}

			switch msg := msg.(type) {
			case *pgproto3.ErrorResponse:
				pgErr = ErrorResponseToPgError(msg)
			default:
				signalMessageChan = pgConn.signalMessage()
			}
		default:
		}
	}
	close(abortCopyChan)

	buf = buf[:0]
	if copyErr == io.EOF || pgErr != nil {
		copyDone := &pgproto3.CopyDone{}
		buf = copyDone.Encode(buf)
	} else {
		copyFail := &pgproto3.CopyFail{Message: copyErr.Error()}
		buf = copyFail.Encode(buf)
	}
	_, err = pgConn.conn.Write(buf)
	if err != nil {
		pgConn.asyncClose()
		return nil, err
	}

	// Read results
	for {
		msg, err := pgConn.receiveMessage()
		if err != nil {
			pgConn.asyncClose()
			return nil, err
		}

		switch msg := msg.(type) {
		case *pgproto3.ReadyForQuery:
			return commandTag, pgErr
		case *pgproto3.CommandComplete:
			commandTag = CommandTag(msg.CommandTag)
		case *pgproto3.ErrorResponse:
			pgErr = ErrorResponseToPgError(msg)
		}
	}
}

// MultiResultReader is a reader for a command that could return multiple results such as Exec or ExecBatch.
type MultiResultReader struct {
	pgConn *PgConn
	ctx    context.Context

	rr *ResultReader

	closed bool
	err    error
}

// ReadAll reads all available results. Calling ReadAll is mutually exclusive with all other MultiResultReader methods.
func (mrr *MultiResultReader) ReadAll() ([]*Result, error) {
	var results []*Result

	for mrr.NextResult() {
		results = append(results, mrr.ResultReader().Read())
	}
	err := mrr.Close()

	return results, err
}

func (mrr *MultiResultReader) receiveMessage() (pgproto3.BackendMessage, error) {
	msg, err := mrr.pgConn.receiveMessage()

	if err != nil {
		mrr.pgConn.contextWatcher.Unwatch()
		mrr.err = err
		mrr.closed = true
		mrr.pgConn.asyncClose()
		return nil, mrr.err
	}

	switch msg := msg.(type) {
	case *pgproto3.ReadyForQuery:
		mrr.pgConn.contextWatcher.Unwatch()
		mrr.closed = true
		mrr.pgConn.unlock()
	case *pgproto3.ErrorResponse:
		mrr.err = ErrorResponseToPgError(msg)
	}

	return msg, nil
}

// NextResult returns advances the MultiResultReader to the next result and returns true if a result is available.
func (mrr *MultiResultReader) NextResult() bool {
	for !mrr.closed && mrr.err == nil {
		msg, err := mrr.receiveMessage()
		if err != nil {
			return false
		}

		switch msg := msg.(type) {
		case *pgproto3.RowDescription:
			mrr.pgConn.resultReader = ResultReader{
				pgConn:            mrr.pgConn,
				multiResultReader: mrr,
				ctx:               mrr.ctx,
				fieldDescriptions: msg.Fields,
			}
			mrr.rr = &mrr.pgConn.resultReader
			return true
		case *pgproto3.CommandComplete:
			mrr.pgConn.resultReader = ResultReader{
				commandTag:       CommandTag(msg.CommandTag),
				commandConcluded: true,
				closed:           true,
			}
			mrr.rr = &mrr.pgConn.resultReader
			return true
		case *pgproto3.EmptyQueryResponse:
			return false
		}
	}

	return false
}

// ResultReader returns the current ResultReader.
func (mrr *MultiResultReader) ResultReader() *ResultReader {
	return mrr.rr
}

// Close closes the MultiResultReader and returns the first error that occurred during the MultiResultReader's use.
func (mrr *MultiResultReader) Close() error {
	for !mrr.closed {
		_, err := mrr.receiveMessage()
		if err != nil {
			return mrr.err
		}
	}

	return mrr.err
}

// ResultReader is a reader for the result of a single query.
type ResultReader struct {
	pgConn            *PgConn
	multiResultReader *MultiResultReader
	ctx               context.Context

	fieldDescriptions []pgproto3.FieldDescription
	rowValues         [][]byte
	commandTag        CommandTag
	commandConcluded  bool
	closed            bool
	err               error
}

// Result is the saved query response that is returned by calling Read on a ResultReader.
type Result struct {
	FieldDescriptions []pgproto3.FieldDescription
	Rows              [][][]byte
	CommandTag        CommandTag
	Err               error
}

// Read saves the query response to a Result.
func (rr *ResultReader) Read() *Result {
	br := &Result{}

	for rr.NextRow() {
		if br.FieldDescriptions == nil {
			br.FieldDescriptions = make([]pgproto3.FieldDescription, len(rr.FieldDescriptions()))
			copy(br.FieldDescriptions, rr.FieldDescriptions())
		}

		row := make([][]byte, len(rr.Values()))
		copy(row, rr.Values())
		br.Rows = append(br.Rows, row)
	}

	br.CommandTag, br.Err = rr.Close()

	return br
}

// NextRow advances the ResultReader to the next row and returns true if a row is available.
func (rr *ResultReader) NextRow() bool {
	for !rr.commandConcluded {
		msg, err := rr.receiveMessage()
		if err != nil {
			return false
		}

		switch msg := msg.(type) {
		case *pgproto3.DataRow:
			rr.rowValues = msg.Values
			return true
		}
	}

	return false
}

// FieldDescriptions returns the field descriptions for the current result set. The returned slice is only valid until
// the ResultReader is closed.
func (rr *ResultReader) FieldDescriptions() []pgproto3.FieldDescription {
	return rr.fieldDescriptions
}

// Values returns the current row data. NextRow must have been previously been called. The returned [][]byte is only
// valid until the next NextRow call or the ResultReader is closed. However, the underlying byte data is safe to
// retain a reference to and mutate.
func (rr *ResultReader) Values() [][]byte {
	return rr.rowValues
}

// Close consumes any remaining result data and returns the command tag or
// error.
func (rr *ResultReader) Close() (CommandTag, error) {
	if rr.closed {
		return rr.commandTag, rr.err
	}
	rr.closed = true

	for !rr.commandConcluded {
		_, err := rr.receiveMessage()
		if err != nil {
			return nil, rr.err
		}
	}

	if rr.multiResultReader == nil {
		for {
			msg, err := rr.receiveMessage()
			if err != nil {
				return nil, rr.err
			}

			switch msg := msg.(type) {
			// Detect a deferred constraint violation where the ErrorResponse is sent after CommandComplete.
			case *pgproto3.ErrorResponse:
				rr.err = ErrorResponseToPgError(msg)
			case *pgproto3.ReadyForQuery:
				rr.pgConn.contextWatcher.Unwatch()
				rr.pgConn.unlock()
				return rr.commandTag, rr.err
			}
		}
	}

	return rr.commandTag, rr.err
}

func (rr *ResultReader) receiveMessage() (msg pgproto3.BackendMessage, err error) {
	if rr.multiResultReader == nil {
		msg, err = rr.pgConn.receiveMessage()
	} else {
		msg, err = rr.multiResultReader.receiveMessage()
	}

	if err != nil {
		rr.concludeCommand(nil, err)
		rr.pgConn.contextWatcher.Unwatch()
		rr.closed = true
		if rr.multiResultReader == nil {
			rr.pgConn.asyncClose()
		}

		return nil, rr.err
	}

	switch msg := msg.(type) {
	case *pgproto3.RowDescription:
		rr.fieldDescriptions = msg.Fields
	case *pgproto3.CommandComplete:
		rr.concludeCommand(CommandTag(msg.CommandTag), nil)
	case *pgproto3.ErrorResponse:
		rr.concludeCommand(nil, ErrorResponseToPgError(msg))
	}

	return msg, nil
}

func (rr *ResultReader) concludeCommand(commandTag CommandTag, err error) {
	if rr.commandConcluded {
		return
	}

	rr.commandTag = commandTag
	rr.err = err
	rr.fieldDescriptions = nil
	rr.rowValues = nil
	rr.commandConcluded = true
}

// Batch is a collection of queries that can be sent to the PostgreSQL server in a single round-trip.
type Batch struct {
	buf []byte
}

// ExecParams appends an ExecParams command to the batch. See PgConn.ExecParams for parameter descriptions.
func (batch *Batch) ExecParams(sql string, paramValues [][]byte, paramOIDs []uint32, paramFormats []int16, resultFormats []int16) {
	batch.buf = (&pgproto3.Parse{Query: sql, ParameterOIDs: paramOIDs}).Encode(batch.buf)
	batch.ExecPrepared("", paramValues, paramFormats, resultFormats)
}

// ExecPrepared appends an ExecPrepared e command to the batch. See PgConn.ExecPrepared for parameter descriptions.
func (batch *Batch) ExecPrepared(stmtName string, paramValues [][]byte, paramFormats []int16, resultFormats []int16) {
	batch.buf = (&pgproto3.Bind{PreparedStatement: stmtName, ParameterFormatCodes: paramFormats, Parameters: paramValues, ResultFormatCodes: resultFormats}).Encode(batch.buf)
	batch.buf = (&pgproto3.Describe{ObjectType: 'P'}).Encode(batch.buf)
	batch.buf = (&pgproto3.Execute{}).Encode(batch.buf)
}

// ExecBatch executes all the queries in batch in a single round-trip. Execution is implicitly transactional unless a
// transaction is already in progress or SQL contains transaction control statements.
func (pgConn *PgConn) ExecBatch(ctx context.Context, batch *Batch) *MultiResultReader {
	if err := pgConn.lock(); err != nil {
		return &MultiResultReader{
			closed: true,
			err:    err,
		}
	}

	pgConn.multiResultReader = MultiResultReader{
		pgConn: pgConn,
		ctx:    ctx,
	}
	multiResult := &pgConn.multiResultReader

	if ctx != context.Background() {
		select {
		case <-ctx.Done():
			multiResult.closed = true
			multiResult.err = &contextAlreadyDoneError{err: ctx.Err()}
			pgConn.unlock()
			return multiResult
		default:
		}
		pgConn.contextWatcher.Watch(ctx)
	}

	batch.buf = (&pgproto3.Sync{}).Encode(batch.buf)

	// A large batch can deadlock without concurrent reading and writing. If the Write fails the underlying net.Conn is
	// closed. This is all that can be done without introducing a race condition or adding a concurrent safe communication
	// channel to relay the error back. The practical effect of this is that the underlying Write error is not reported.
	// The error the code reading the batch results receives will be a closed connection error.
	//
	// See https://github.com/jackc/pgx/issues/374.
	go func() {
		_, err := pgConn.conn.Write(batch.buf)
		if err != nil {
			pgConn.conn.Close()
		}
	}()

	return multiResult
}

// EscapeString escapes a string such that it can safely be interpolated into a SQL command string. It does not include
// the surrounding single quotes.
//
// The current implementation requires that standard_conforming_strings=on and client_encoding="UTF8". If these
// conditions are not met an error will be returned. It is possible these restrictions will be lifted in the future.
func (pgConn *PgConn) EscapeString(s string) (string, error) {
	if pgConn.ParameterStatus("standard_conforming_strings") != "on" {
		return "", errors.New("EscapeString must be run with standard_conforming_strings=on")
	}

	if pgConn.ParameterStatus("client_encoding") != "UTF8" {
		return "", errors.New("EscapeString must be run with client_encoding=UTF8")
	}

	return strings.Replace(s, "'", "''", -1), nil
}

// HijackedConn is the result of hijacking a connection.
//
// Due to the necessary exposure of internal implementation details, it is not covered by the semantic versioning
// compatibility.
type HijackedConn struct {
	Conn              net.Conn          // the underlying TCP or unix domain socket connection
	PID               uint32            // backend pid
	SecretKey         uint32            // key to use to send a cancel query message to the server
	ParameterStatuses map[string]string // parameters that have been reported by the server
	TxStatus          byte
	Frontend          Frontend
	Config            *Config
}

// Hijack extracts the internal connection data. pgConn must be in an idle state. pgConn is unusable after hijacking.
// Hijacking is typically only useful when using pgconn to establish a connection, but taking complete control of the
// raw connection after that (e.g. a load balancer or proxy).
//
// Due to the necessary exposure of internal implementation details, it is not covered by the semantic versioning
// compatibility.
func (pgConn *PgConn) Hijack() (*HijackedConn, error) {
	if err := pgConn.lock(); err != nil {
		return nil, err
	}
	pgConn.status = connStatusClosed

	return &HijackedConn{
		Conn:              pgConn.conn,
		PID:               pgConn.pid,
		SecretKey:         pgConn.secretKey,
		ParameterStatuses: pgConn.parameterStatuses,
		TxStatus:          pgConn.txStatus,
		Frontend:          pgConn.frontend,
		Config:            pgConn.config,
	}, nil
}

// Construct created a PgConn from an already established connection to a PostgreSQL server. This is the inverse of
// PgConn.Hijack. The connection must be in an idle state.
//
// Due to the necessary exposure of internal implementation details, it is not covered by the semantic versioning
// compatibility.
func Construct(hc *HijackedConn) (*PgConn, error) {
	pgConn := &PgConn{
		conn:              hc.Conn,
		pid:               hc.PID,
		secretKey:         hc.SecretKey,
		parameterStatuses: hc.ParameterStatuses,
		txStatus:          hc.TxStatus,
		frontend:          hc.Frontend,
		config:            hc.Config,

		status: connStatusIdle,

		wbuf: make([]byte, 0, wbufLen),
	}

	pgConn.contextWatcher = ctxwatch.NewContextWatcher(
		func() { pgConn.conn.SetDeadline(time.Date(1, 1, 1, 1, 1, 1, 1, time.UTC)) },
		func() { pgConn.conn.SetDeadline(time.Time{}) },
	)

	return pgConn, nil
}
