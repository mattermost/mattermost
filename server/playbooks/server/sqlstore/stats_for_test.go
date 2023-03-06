// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import "math"

func mean(nums []int64) float64 {
	if len(nums) == 0 {
		return 0
	}
	mean := float64(0)
	for _, n := range nums {
		mean += float64(n)
	}
	return mean / float64(len(nums))
}

func variance(nums []int64) float64 {
	if len(nums) == 0 {
		return 0
	}

	m := mean(nums)
	v := float64(0)
	for _, n := range nums {
		v += math.Pow(float64(n)-m, 2)
	}
	return v / float64(len(nums)-1)
}

func stdErr(nums []int64) float64 {
	if len(nums) == 0 {
		return 0
	}

	s2 := variance(nums)
	s := math.Sqrt(s2)

	return s / math.Sqrt(float64(len(nums)))
}

func ciForN30(nums []int64) (float64, float64) {
	// assumes a sample size of 30
	tValue := 2.0423
	m := mean(nums)
	se := stdErr(nums)
	return m - tValue*se, m + tValue*se
}
