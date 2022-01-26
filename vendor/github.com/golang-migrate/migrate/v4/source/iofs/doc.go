/*
Package iofs provides the Go 1.16+ io/fs#FS driver.

It can accept various file systems (like embed.FS, archive/zip#Reader) implementing io/fs#FS.

This driver cannot be used with Go versions 1.15 and below.

Also, Opening with a URL scheme is not supported.
*/
package iofs
