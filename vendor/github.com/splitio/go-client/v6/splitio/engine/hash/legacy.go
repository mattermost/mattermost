package hash

// Legacy calculates the bucket for the key and seed provided using the legacy algorithm
func Legacy(key []byte, seed uint32) uint32 {
	var h uint32
	for _, char := range key {
		h = 31*h + uint32(char)
	}
	return uint32(h ^ seed)
}
