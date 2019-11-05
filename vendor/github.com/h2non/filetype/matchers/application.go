package matchers

var (
	TypeWasm = newType("wasm", "application/wasm")
)

var Application = Map{
	TypeWasm: Wasm,
}

// Wasm detects a Web Assembly 1.0 filetype.
func Wasm(buf []byte) bool {
	// WASM has starts with `\0asm`, followed by the version.
	// http://webassembly.github.io/spec/core/binary/modules.html#binary-magic
	return len(buf) >= 8 &&
		buf[0] == 0x00 && buf[1] == 0x61 &&
		buf[2] == 0x73 && buf[3] == 0x6D &&
		buf[4] == 0x01 && buf[5] == 0x00 &&
		buf[6] == 0x00 && buf[7] == 0x00
}
