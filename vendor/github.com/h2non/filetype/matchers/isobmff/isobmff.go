package isobmff

import "encoding/binary"

// IsISOBMFF checks whether the given buffer represents ISO Base Media File Format data
func IsISOBMFF(buf []byte) bool {
	if len(buf) < 16 || string(buf[4:8]) != "ftyp" {
		return false
	}

	if ftypLength := binary.BigEndian.Uint32(buf[0:4]); len(buf) < int(ftypLength) {
		return false
	}

	return true
}

// GetFtyp returns the major brand, minor version and compatible brands of the ISO-BMFF data
func GetFtyp(buf []byte) (string, string, []string) {
	ftypLength := binary.BigEndian.Uint32(buf[0:4])

	majorBrand := string(buf[8:12])
	minorVersion := string(buf[12:16])

	compatibleBrands := []string{}
	for i := 16; i < int(ftypLength); i += 4 {
		compatibleBrands = append(compatibleBrands, string(buf[i:i+4]))
	}

	return majorBrand, minorVersion, compatibleBrands
}
