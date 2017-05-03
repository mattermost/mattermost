package sqs

/*
 * Performs the MD5 algorithm for attribute responses described in
 * the AWS documentation here: http://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/SQSMessageAttributes.html#sqs-attrib-md5
 */

import (
	"crypto/md5"
	"encoding/binary"
	"sort"
)

// Returns length of string as an Big Endian byte array
func getStringLengthAsByteArray(s string) []byte {
	var res []byte = make([]byte, 4)
	binary.BigEndian.PutUint32(res, uint32(len(s)))

	return res
}

// How to calculate the MD5 of Attributes
func calculateAttributeMD5(attributes map[string]string) []byte {

	// We're going to walk attributes in alpha-sorted order
	var keys []string

	for k := range attributes {
		keys = append(keys, k)
	}

	sort.Strings(keys)

	// Now we'll build our encoded string
	var encoded []byte

	for _, k := range keys {
		v := attributes[k]
		t := "String"

		encodedItems := [][]byte{
			getStringLengthAsByteArray(k),
			[]byte(k), // Name
			getStringLengthAsByteArray(t),
			[]byte(t),    // Data Type ("String")
			[]byte{0x01}, // "String Value" (0x01)
			getStringLengthAsByteArray(v),
			[]byte(v), // Value
		}

		// Append each of these to our encoding
		for _, item := range encodedItems {
			encoded = append(encoded, item...)
		}
	}

	res := md5.Sum(encoded)

	// Return MD5 sum
	return res[:]
}
