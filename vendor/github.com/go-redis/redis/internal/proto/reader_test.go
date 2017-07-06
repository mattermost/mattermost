package proto_test

import (
	"bytes"
	"strings"
	"testing"

	"github.com/go-redis/redis/internal/proto"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Reader", func() {

	It("should read n bytes", func() {
		data, err := proto.NewReader(strings.NewReader("ABCDEFGHIJKLMNO")).ReadN(10)
		Expect(err).NotTo(HaveOccurred())
		Expect(len(data)).To(Equal(10))
		Expect(string(data)).To(Equal("ABCDEFGHIJ"))

		data, err = proto.NewReader(strings.NewReader(strings.Repeat("x", 8192))).ReadN(6000)
		Expect(err).NotTo(HaveOccurred())
		Expect(len(data)).To(Equal(6000))
	})

	It("should read lines", func() {
		p := proto.NewReader(strings.NewReader("$5\r\nhello\r\n"))

		data, err := p.ReadLine()
		Expect(err).NotTo(HaveOccurred())
		Expect(string(data)).To(Equal("$5"))

		data, err = p.ReadLine()
		Expect(err).NotTo(HaveOccurred())
		Expect(string(data)).To(Equal("hello"))
	})

})

func BenchmarkReader_ParseReply_Status(b *testing.B) {
	benchmarkParseReply(b, "+OK\r\n", nil, false)
}

func BenchmarkReader_ParseReply_Int(b *testing.B) {
	benchmarkParseReply(b, ":1\r\n", nil, false)
}

func BenchmarkReader_ParseReply_Error(b *testing.B) {
	benchmarkParseReply(b, "-Error message\r\n", nil, true)
}

func BenchmarkReader_ParseReply_String(b *testing.B) {
	benchmarkParseReply(b, "$5\r\nhello\r\n", nil, false)
}

func BenchmarkReader_ParseReply_Slice(b *testing.B) {
	benchmarkParseReply(b, "*2\r\n$5\r\nhello\r\n$5\r\nworld\r\n", multiBulkParse, false)
}

func benchmarkParseReply(b *testing.B, reply string, m proto.MultiBulkParse, wanterr bool) {
	buf := new(bytes.Buffer)
	for i := 0; i < b.N; i++ {
		buf.WriteString(reply)
	}
	p := proto.NewReader(buf)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := p.ReadReply(m)
		if !wanterr && err != nil {
			b.Fatal(err)
		}
	}
}

func multiBulkParse(p *proto.Reader, n int64) (interface{}, error) {
	vv := make([]interface{}, 0, n)
	for i := int64(0); i < n; i++ {
		v, err := p.ReadReply(multiBulkParse)
		if err != nil {
			return nil, err
		}
		vv = append(vv, v)
	}
	return vv, nil
}
