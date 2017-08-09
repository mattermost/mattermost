package proto_test

import (
	"testing"
	"time"

	"github.com/go-redis/redis/internal/proto"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("WriteBuffer", func() {
	var buf *proto.WriteBuffer

	BeforeEach(func() {
		buf = proto.NewWriteBuffer()
	})

	It("should reset", func() {
		buf.AppendString("string")
		Expect(buf.Len()).To(Equal(12))
		buf.Reset()
		Expect(buf.Len()).To(Equal(0))
	})

	It("should append args", func() {
		err := buf.Append([]interface{}{
			"string",
			12,
			34.56,
			[]byte{'b', 'y', 't', 'e', 's'},
			true,
			nil,
		})
		Expect(err).NotTo(HaveOccurred())
		Expect(buf.Bytes()).To(Equal([]byte("*6\r\n" +
			"$6\r\nstring\r\n" +
			"$2\r\n12\r\n" +
			"$5\r\n34.56\r\n" +
			"$5\r\nbytes\r\n" +
			"$1\r\n1\r\n" +
			"$0\r\n" +
			"\r\n")))
	})

	It("should append marshalable args", func() {
		err := buf.Append([]interface{}{time.Unix(1414141414, 0)})
		Expect(err).NotTo(HaveOccurred())
		Expect(buf.Len()).To(Equal(26))
	})

})

func BenchmarkWriteBuffer_Append(b *testing.B) {
	buf := proto.NewWriteBuffer()
	args := []interface{}{"hello", "world", "foo", "bar"}

	for i := 0; i < b.N; i++ {
		buf.Append(args)
		buf.Reset()
	}
}
