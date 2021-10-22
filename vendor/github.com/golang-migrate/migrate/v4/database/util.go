package database

import (
	"fmt"
	"go.uber.org/atomic"
	"hash/crc32"
	"strings"
)

const advisoryLockIDSalt uint = 1486364155

// GenerateAdvisoryLockId inspired by rails migrations, see https://goo.gl/8o9bCT
func GenerateAdvisoryLockId(databaseName string, additionalNames ...string) (string, error) { // nolint: golint
	if len(additionalNames) > 0 {
		databaseName = strings.Join(append(additionalNames, databaseName), "\x00")
	}
	sum := crc32.ChecksumIEEE([]byte(databaseName))
	sum = sum * uint32(advisoryLockIDSalt)
	return fmt.Sprint(sum), nil
}

// CasRestoreOnErr CAS wrapper to automatically restore the lock state on error
func CasRestoreOnErr(lock *atomic.Bool, o, n bool, casErr error, f func() error) error {
	if !lock.CAS(o, n) {
		return casErr
	}
	if err := f(); err != nil {
		// Automatically unlock/lock on error
		lock.Store(o)
		return err
	}
	return nil
}
