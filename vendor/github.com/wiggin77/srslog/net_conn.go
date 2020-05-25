package srslog

import (
	"io"
	"net"
	"time"
)

// netConn has an internal net.Conn and adheres to the serverConn interface,
// allowing us to send syslog messages over the network.
type netConn struct {
	conn net.Conn
	done chan interface{}
}

// newNetConn creates a netConn instance that is monitored for unexpected socket closure.
func newNetConn(conn net.Conn) *netConn {
	nc := &netConn{conn: conn, done: make(chan interface{})}
	go monitor(nc.conn, nc.done)
	return nc
}

// writeString formats syslog messages using time.RFC3339 and includes the
// hostname, and sends the message to the connection.
func (n *netConn) writeString(framer Framer, formatter Formatter, p Priority, hostname, tag, msg string) error {
	if framer == nil {
		framer = DefaultFramer
	}
	if formatter == nil {
		formatter = DefaultFormatter
	}
	formattedMessage := framer(formatter(p, hostname, tag, msg))
	_, err := n.conn.Write([]byte(formattedMessage))
	return err
}

// close the network connection
func (n *netConn) close() error {
	// signal monitor goroutine to exit
	close(n.done)
	// wake up monitor blocked on read (close usually is enough)
	_ = n.conn.SetReadDeadline(time.Now())
	// close the connection
	return n.conn.Close()
}

// monitor continuously tries to read from the connection to detect socket close.
// This is needed because syslog server uses a write only socket and Linux systems
// take a long time to detect a loss of connectivity on a socket when only writing;
// the writes simply fail without an error returned.
func monitor(conn net.Conn, done chan interface{}) {
	defer Logger.Println("monitor exit")

	buf := make([]byte, 1)
	for {
		Logger.Println("monitor loop")

		select {
		case <-done:
			return
		case <-time.After(1 * time.Second):
		}

		err := conn.SetReadDeadline(time.Now().Add(time.Second * 30))
		if err != nil {
			continue
		}

		_, err = conn.Read(buf)
		Logger.Println("monitor -- ", err)
		if err == io.EOF {
			Logger.Println("monitor close conn")
			conn.Close()
		}
	}
}
