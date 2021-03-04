package pgproto3

import (
	"encoding/binary"
	"fmt"
	"io"
)

// Backend acts as a server for the PostgreSQL wire protocol version 3.
type Backend struct {
	cr ChunkReader
	w  io.Writer

	// Frontend message flyweights
	bind            Bind
	cancelRequest   CancelRequest
	_close          Close
	copyFail        CopyFail
	describe        Describe
	execute         Execute
	flush           Flush
	parse           Parse
	passwordMessage PasswordMessage
	query           Query
	sslRequest      SSLRequest
	startupMessage  StartupMessage
	sync            Sync
	terminate       Terminate

	bodyLen    int
	msgType    byte
	partialMsg bool
}

// NewBackend creates a new Backend.
func NewBackend(cr ChunkReader, w io.Writer) *Backend {
	return &Backend{cr: cr, w: w}
}

// Send sends a message to the frontend.
func (b *Backend) Send(msg BackendMessage) error {
	_, err := b.w.Write(msg.Encode(nil))
	return err
}

// ReceiveStartupMessage receives the initial connection message. This method is used of the normal Receive method
// because the initial connection message is "special" and does not include the message type as the first byte. This
// will return either a StartupMessage, SSLRequest, or CancelRequest.
func (b *Backend) ReceiveStartupMessage() (FrontendMessage, error) {
	buf, err := b.cr.Next(4)
	if err != nil {
		return nil, err
	}
	msgSize := int(binary.BigEndian.Uint32(buf) - 4)

	buf, err = b.cr.Next(msgSize)
	if err != nil {
		return nil, err
	}

	code := binary.BigEndian.Uint32(buf)

	switch code {
	case ProtocolVersionNumber:
		err = b.startupMessage.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.startupMessage, nil
	case sslRequestNumber:
		err = b.sslRequest.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.sslRequest, nil
	case cancelRequestCode:
		err = b.cancelRequest.Decode(buf)
		if err != nil {
			return nil, err
		}
		return &b.cancelRequest, nil
	default:
		return nil, fmt.Errorf("unknown startup message code: %d", code)
	}
}

// Receive receives a message from the frontend.
func (b *Backend) Receive() (FrontendMessage, error) {
	if !b.partialMsg {
		header, err := b.cr.Next(5)
		if err != nil {
			return nil, err
		}

		b.msgType = header[0]
		b.bodyLen = int(binary.BigEndian.Uint32(header[1:])) - 4
		b.partialMsg = true
	}

	var msg FrontendMessage
	switch b.msgType {
	case 'B':
		msg = &b.bind
	case 'C':
		msg = &b._close
	case 'D':
		msg = &b.describe
	case 'E':
		msg = &b.execute
	case 'f':
		msg = &b.copyFail
	case 'H':
		msg = &b.flush
	case 'P':
		msg = &b.parse
	case 'p':
		msg = &b.passwordMessage
	case 'Q':
		msg = &b.query
	case 'S':
		msg = &b.sync
	case 'X':
		msg = &b.terminate
	default:
		return nil, fmt.Errorf("unknown message type: %c", b.msgType)
	}

	msgBody, err := b.cr.Next(b.bodyLen)
	if err != nil {
		return nil, err
	}

	b.partialMsg = false

	err = msg.Decode(msgBody)
	return msg, err
}
