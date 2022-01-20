// Package aia provides an http.Transport which uses the AIA (Authority Information Access)
// X.509 extension to resolve incomplete certificate chains during the tls handshake.
// See https://tools.ietf.org/html/rfc3280#section-4.2.2.1 for more details.
//
// Usage
//
// To use simply create a new transport via NewTransport()
// and use it in your http.Client.
//
//   tr, err := aia.NewTransport()
//   if err != nil {
//     log.Fatal(err)
//   }
//   client := http.Client{
//     Transport: tr,
//   }
//   res, err := client.Get("https://incomplete-chain.badssl.com/")
//   if err != nil {
//     log.Fatal(err)
//   }
//   fmt.Println(res.Status)
package aia //import "github.com/fcjr/aia-transport-go"
