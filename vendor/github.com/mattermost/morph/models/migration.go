package models

import (
	"bytes"
	"fmt"
	"io"
	"strconv"
)

type Migration struct {
	Bytes     io.ReadCloser
	Name      string
	RawName   string
	Version   uint32
	Direction Direction
}

func NewMigration(migrationBytes io.ReadCloser, fileName string) (*Migration, error) {
	m := Regex.FindStringSubmatch(fileName)

	var (
		versionUint64 uint64
		direction     Direction
		identifier    string
		err           error
	)

	if len(m) == 5 {
		versionUint64, err = strconv.ParseUint(m[1], 10, 64)
		if err != nil {
			return nil, err
		}
		identifier = m[2]
		direction = Direction(m[3])
	} else {
		return nil, fmt.Errorf("could not parse file: %s", fileName)
	}

	return &Migration{
		Version:   uint32(versionUint64),
		Name:      identifier,
		RawName:   fileName,
		Bytes:     migrationBytes,
		Direction: direction,
	}, nil
}

func (m *Migration) Query() (string, error) {
	buf := new(bytes.Buffer)
	if _, err := buf.ReadFrom(m.Bytes); err != nil {
		return "", err
	}
	return buf.String(), nil
}

func (m *Migration) Close() error {
	return m.Bytes.Close()
}
