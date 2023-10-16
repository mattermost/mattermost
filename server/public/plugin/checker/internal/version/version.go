// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package version

import (
	"regexp"
	"strconv"
	"strings"
)

type V string

func (v V) GreaterThanOrEqualTo(other V) bool {
	return !v.LessThan(other)
}

func (v V) LessThan(other V) bool {
	leftParts, leftCount := split(v)
	rightParts, rightCount := split(other)

	var length int
	if leftCount < rightCount {
		length = rightCount
	} else {
		length = leftCount
	}

	for i := 0; i < length; i++ {
		var left, right string

		if i < leftCount {
			left = leftParts[i]
		}

		if i < rightCount {
			right = rightParts[i]
		}

		if left == right {
			continue
		}

		leftInt := parseInt(left)
		rightInt := parseInt(right)

		isNumericalComparison := leftInt != nil && rightInt != nil

		if isNumericalComparison {
			return *leftInt < *rightInt
		}

		return left < right
	}

	return false
}

func split(v V) ([]string, int) {
	var chunks []string

	for _, part := range strings.Split(string(v), ".") {
		chunks = append(chunks, splitNumericalChunks(part)...)
	}

	return chunks, len(chunks)
}

var numericalOrAlphaRE = regexp.MustCompile(`(\d+|\D+)`)

func splitNumericalChunks(s string) []string {
	return numericalOrAlphaRE.FindAllString(s, -1)
}

func parseInt(s string) *int64 {
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return &n
	}
	return nil
}
