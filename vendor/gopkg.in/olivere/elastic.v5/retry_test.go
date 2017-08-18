// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

// This file is based on code that is (c) 2014 Cenk Altı and governed
// by the MIT license.
// See https://github.com/cenkalti/backoff for original source.

package elastic

import (
	"errors"
	"testing"
	"time"
)

func TestRetry(t *testing.T) {
	const successOn = 3
	var i = 0

	// This function is successfull on "successOn" calls.
	f := func() error {
		i++
		// t.Logf("function is called %d. time\n", i)

		if i == successOn {
			// t.Log("OK")
			return nil
		}

		// t.Log("error")
		return errors.New("error")
	}

	min := time.Duration(8) * time.Millisecond
	max := time.Duration(256) * time.Millisecond
	err := Retry(f, NewExponentialBackoff(min, max))
	if err != nil {
		t.Errorf("unexpected error: %s", err.Error())
	}
	if i != successOn {
		t.Errorf("invalid number of retries: %d", i)
	}
}
