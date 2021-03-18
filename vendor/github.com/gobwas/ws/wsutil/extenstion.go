package wsutil

// RecvExtension is an interface for clearing fragment header RSV bits.
type RecvExtension interface {
	BitsRecv(seq int, rsv byte) (byte, error)
}

// RecvExtensionFunc is an adapter to allow the use of ordinary functions as
// RecvExtension.
type RecvExtensionFunc func(int, byte) (byte, error)

// BitsRecv implements RecvExtension.
func (fn RecvExtensionFunc) BitsRecv(seq int, rsv byte) (byte, error) {
	return fn(seq, rsv)
}

// SendExtension is an interface for setting fragment header RSV bits.
type SendExtension interface {
	BitsSend(seq int, rsv byte) (byte, error)
}

// SendExtensionFunc is an adapter to allow the use of ordinary functions as
// SendExtension.
type SendExtensionFunc func(int, byte) (byte, error)

// BitsSend implements SendExtension.
func (fn SendExtensionFunc) BitsSend(seq int, rsv byte) (byte, error) {
	return fn(seq, rsv)
}
