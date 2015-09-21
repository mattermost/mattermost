package tiff

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"flag"
	"os"
	"path/filepath"
	"testing"
)

var dataDir = flag.String("test_data_dir", ".", "Directory where the data files for testing are located")

type input struct {
	tgId   string
	tpe    string
	nVals  string
	offset string
	val    string
}

type output struct {
	id    uint16
	typ   DataType
	count uint32
	val   []byte
}

type tagTest struct {
	big    input // big endian
	little input // little endian
	out    output
}

///////////////////////////////////////////////
//// Big endian Tests /////////////////////////
///////////////////////////////////////////////
var set1 = []tagTest{
	//////////// string type //////////////
	tagTest{
		//   {"TgId", "TYPE", "N-VALUES", "OFFSET--", "VAL..."},
		input{"0003", "0002", "00000002", "11000000", ""},
		input{"0300", "0200", "02000000", "11000000", ""},
		output{0x0003, DataType(0x0002), 0x0002, []byte{0x11, 0x00}},
	},
	tagTest{
		input{"0001", "0002", "00000006", "00000012", "111213141516"},
		input{"0100", "0200", "06000000", "12000000", "111213141516"},
		output{0x0001, DataType(0x0002), 0x0006, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16}},
	},
	//////////// int (1-byte) type ////////////////
	tagTest{
		input{"0001", "0001", "00000001", "11000000", ""},
		input{"0100", "0100", "01000000", "11000000", ""},
		output{0x0001, DataType(0x0001), 0x0001, []byte{0x11}},
	},
	tagTest{
		input{"0001", "0001", "00000005", "00000010", "1112131415"},
		input{"0100", "0100", "05000000", "10000000", "1112131415"},
		output{0x0001, DataType(0x0001), 0x0005, []byte{0x11, 0x12, 0x13, 0x14, 0x15}},
	},
	tagTest{
		input{"0001", "0006", "00000001", "11000000", ""},
		input{"0100", "0600", "01000000", "11000000", ""},
		output{0x0001, DataType(0x0006), 0x0001, []byte{0x11}},
	},
	tagTest{
		input{"0001", "0006", "00000005", "00000010", "1112131415"},
		input{"0100", "0600", "05000000", "10000000", "1112131415"},
		output{0x0001, DataType(0x0006), 0x0005, []byte{0x11, 0x12, 0x13, 0x14, 0x15}},
	},
	//////////// int (2-byte) types ////////////////
	tagTest{
		input{"0001", "0003", "00000002", "11111212", ""},
		input{"0100", "0300", "02000000", "11111212", ""},
		output{0x0001, DataType(0x0003), 0x0002, []byte{0x11, 0x11, 0x12, 0x12}},
	},
	tagTest{
		input{"0001", "0003", "00000003", "00000010", "111213141516"},
		input{"0100", "0300", "03000000", "10000000", "111213141516"},
		output{0x0001, DataType(0x0003), 0x0003, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16}},
	},
	tagTest{
		input{"0001", "0008", "00000001", "11120000", ""},
		input{"0100", "0800", "01000000", "11120000", ""},
		output{0x0001, DataType(0x0008), 0x0001, []byte{0x11, 0x12}},
	},
	tagTest{
		input{"0001", "0008", "00000003", "00000100", "111213141516"},
		input{"0100", "0800", "03000000", "00100000", "111213141516"},
		output{0x0001, DataType(0x0008), 0x0003, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16}},
	},
	//////////// int (4-byte) types ////////////////
	tagTest{
		input{"0001", "0004", "00000001", "11121314", ""},
		input{"0100", "0400", "01000000", "11121314", ""},
		output{0x0001, DataType(0x0004), 0x0001, []byte{0x11, 0x12, 0x13, 0x14}},
	},
	tagTest{
		input{"0001", "0004", "00000002", "00000010", "1112131415161718"},
		input{"0100", "0400", "02000000", "10000000", "1112131415161718"},
		output{0x0001, DataType(0x0004), 0x0002, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18}},
	},
	tagTest{
		input{"0001", "0009", "00000001", "11121314", ""},
		input{"0100", "0900", "01000000", "11121314", ""},
		output{0x0001, DataType(0x0009), 0x0001, []byte{0x11, 0x12, 0x13, 0x14}},
	},
	tagTest{
		input{"0001", "0009", "00000002", "00000011", "1112131415161819"},
		input{"0100", "0900", "02000000", "11000000", "1112131415161819"},
		output{0x0001, DataType(0x0009), 0x0002, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19}},
	},
	//////////// rational types ////////////////////
	tagTest{
		input{"0001", "0005", "00000001", "00000010", "1112131415161718"},
		input{"0100", "0500", "01000000", "10000000", "1112131415161718"},
		output{0x0001, DataType(0x0005), 0x0001, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18}},
	},
	tagTest{
		input{"0001", "000A", "00000001", "00000011", "1112131415161819"},
		input{"0100", "0A00", "01000000", "11000000", "1112131415161819"},
		output{0x0001, DataType(0x000A), 0x0001, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19}},
	},
	//////////// float types ///////////////////////
	tagTest{
		input{"0001", "0005", "00000001", "00000010", "1112131415161718"},
		input{"0100", "0500", "01000000", "10000000", "1112131415161718"},
		output{0x0001, DataType(0x0005), 0x0001, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18}},
	},
	tagTest{
		input{"0101", "000A", "00000001", "00000011", "1112131415161819"},
		input{"0101", "0A00", "01000000", "11000000", "1112131415161819"},
		output{0x0101, DataType(0x000A), 0x0001, []byte{0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19}},
	},
}

func TestDecodeTag(t *testing.T) {
	for i, tst := range set1 {
		testSingle(t, binary.BigEndian, tst.big, tst.out, i)
		testSingle(t, binary.LittleEndian, tst.little, tst.out, i)
	}
}

func testSingle(t *testing.T, order binary.ByteOrder, in input, out output, i int) {
	data := buildInput(in, order)
	buf := bytes.NewReader(data)
	tg, err := DecodeTag(buf, order)
	if err != nil {
		t.Errorf("(%v) tag %v%+v decode failed: %v", order, i, in, err)
		return
	}

	if tg.Id != out.id {
		t.Errorf("(%v) tag %v id decode: expected %v, got %v", order, i, out.id, tg.Id)
	}
	if tg.Type != out.typ {
		t.Errorf("(%v) tag %v type decode: expected %v, got %v", order, i, out.typ, tg.Type)
	}
	if tg.Count != out.count {
		t.Errorf("(%v) tag %v component count decode: expected %v, got %v", order, i, out.count, tg.Count)
	}
	if !bytes.Equal(tg.Val, out.val) {
		t.Errorf("(%v) tag %v value decode: expected %v, got %v", order, i, out.val, tg.Val)
	}
}

// buildInputBig creates a byte-slice based on big-endian ordered input
func buildInput(in input, order binary.ByteOrder) []byte {
	data := make([]byte, 0)
	d, _ := hex.DecodeString(in.tgId)
	data = append(data, d...)
	d, _ = hex.DecodeString(in.tpe)
	data = append(data, d...)
	d, _ = hex.DecodeString(in.nVals)
	data = append(data, d...)
	d, _ = hex.DecodeString(in.offset)
	data = append(data, d...)

	if in.val != "" {
		off := order.Uint32(d)
		for i := 0; i < int(off)-12; i++ {
			data = append(data, 0xFF)
		}

		d, _ = hex.DecodeString(in.val)
		data = append(data, d...)
	}

	return data
}

func TestDecode(t *testing.T) {
	name := filepath.Join(*dataDir, "sample1.tif")
	f, err := os.Open(name)
	if err != nil {
		t.Fatalf("%v\n", err)
	}

	tif, err := Decode(f)
	if err != nil {
		t.Fatal(err)
	}

	t.Log(tif)
}

func TestDecodeTag_blob(t *testing.T) {
	buf := bytes.NewReader(data())
	buf.Seek(10, 1)
	tg, err := DecodeTag(buf, binary.LittleEndian)
	if err != nil {
		t.Fatalf("tag decode failed: %v", err)
	}

	t.Logf("tag: %v+\n", tg)
	n, d, err := tg.Rat2(0)
	if err != nil {
		t.Fatalf("tag decoded wrong type: %v", err)
	}
	t.Logf("tag rat val: %v/%v\n", n, d)
}

func data() []byte {
	s1 := "49492A000800000002001A0105000100"
	s1 += "00002600000069870400010000001102"
	s1 += "0000000000004800000001000000"

	dat, err := hex.DecodeString(s1)
	if err != nil {
		panic("invalid string fixture")
	}
	return dat
}
