package targets

import (
	"crypto/x509"
	"encoding/base64"
	"errors"
	"io/ioutil"
)

// GetCertPool returns a x509.CertPool containing the cert(s)
// from `cert`, which can be a path to a .pem or .crt file,
// or a base64 encoded cert.
func GetCertPool(cert string) (*x509.CertPool, error) {
	if cert == "" {
		return nil, errors.New("no cert provided")
	}

	// first treat as a file and try to read.
	serverCert, err := ioutil.ReadFile(cert)
	if err != nil {
		// maybe it's a base64 encoded cert
		serverCert, err = base64.StdEncoding.DecodeString(cert)
		if err != nil {
			return nil, errors.New("cert cannot be read")
		}
	}

	pool := x509.NewCertPool()
	if ok := pool.AppendCertsFromPEM(serverCert); ok {
		return pool, nil
	}
	return nil, errors.New("cannot parse cert")
}
