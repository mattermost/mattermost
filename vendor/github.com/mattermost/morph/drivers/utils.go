package drivers

import (
	"context"
	"fmt"
	"hash/crc32"
	"regexp"
	"strings"
	"time"
)

func ExtractCustomParams(conn string, params []string) (map[string]string, error) {
	result := make(map[string]string)
	for _, param := range params {
		reg := regexp.MustCompile(fmt.Sprintf("%s=(\\w+)", param))
		match := reg.FindStringSubmatch(conn)
		if len(match) > 1 {
			result[param] = match[1]
		}
	}

	return result, nil
}

func RemoveParamsFromURL(conn string, params []string) (string, error) {
	prefixCorrection := regexp.MustCompile(`\?&+`)
	repeatedAmber := regexp.MustCompile("&+")

	for _, param := range params {
		reg := regexp.MustCompile(fmt.Sprintf("%s=\\w+", param))
		conn = string(reg.ReplaceAll([]byte(conn), []byte(``)))
	}

	parts := strings.Split(conn, "/")
	urlParams := parts[len(parts)-1]

	urlParams = string(prefixCorrection.ReplaceAll([]byte(urlParams), []byte(`?`)))
	urlParams = string(repeatedAmber.ReplaceAll([]byte(urlParams), []byte(`&`)))
	parts[len(parts)-1] = urlParams

	return strings.Join(parts, "/"), nil
}

const advisoryLockIDSalt uint = 1486364155

func GenerateAdvisoryLockID(databaseName, schemaName string) (string, error) {
	databaseName = schemaName + databaseName + "\x00"
	sum := crc32.ChecksumIEEE([]byte(databaseName))
	sum = sum * uint32(advisoryLockIDSalt)
	return fmt.Sprint(sum), nil
}

func GetContext(timeoutInSeconds int) (context.Context, context.CancelFunc) {
	if t := timeoutInSeconds; t > 0 {
		return context.WithTimeout(context.Background(), time.Second*time.Duration(t))
	}
	return context.WithCancel(context.Background())
}
