package client

// Key struct to be used when supplying two keys. One for matching purposes and another one
// for hashing.
type Key struct {
	MatchingKey  string
	BucketingKey string
}

// NewKey instantiates a new key
func NewKey(matchingKey string, bucketingKey string) *Key {
	return &Key{
		MatchingKey:  matchingKey,
		BucketingKey: bucketingKey,
	}
}
