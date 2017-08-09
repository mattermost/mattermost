package proto

import (
	"encoding/json"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

type testScanSliceStruct struct {
	ID   int
	Name string
}

func (s *testScanSliceStruct) MarshalBinary() ([]byte, error) {
	return json.Marshal(s)
}

func (s *testScanSliceStruct) UnmarshalBinary(b []byte) error {
	return json.Unmarshal(b, s)
}

var _ = Describe("ScanSlice", func() {
	data := []string{
		`{"ID":-1,"Name":"Back Yu"}`,
		`{"ID":1,"Name":"szyhf"}`,
	}

	It("[]testScanSliceStruct", func() {
		var slice []testScanSliceStruct
		err := ScanSlice(data, &slice)
		Expect(err).NotTo(HaveOccurred())
		Expect(slice).To(Equal([]testScanSliceStruct{
			{-1, "Back Yu"},
			{1, "szyhf"},
		}))
	})

	It("var testContainer []*testScanSliceStruct", func() {
		var slice []*testScanSliceStruct
		err := ScanSlice(data, &slice)
		Expect(err).NotTo(HaveOccurred())
		Expect(slice).To(Equal([]*testScanSliceStruct{
			{-1, "Back Yu"},
			{1, "szyhf"},
		}))
	})
})
