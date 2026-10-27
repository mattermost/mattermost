// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build requirefips

package mfa

// TOTP (RFC 6238) is defined over HMAC-SHA1, which is an approved use of SHA-1 (NIST SP 800-131A Rev. 2) and is
// computed by the OpenSSL FIPS provider. The Chainguard Go toolchain does not hand HMAC-SHA1 to its OpenSSL
// backend through crypto/hmac though: with FIPS 140 mode enabled it panics, or runs on Go's own module when
// enforcement is suspended. So the HMAC is computed by calling the EVP_MAC API of the libcrypto that the
// toolchain loads, resolved with dlopen so that neither the OpenSSL headers nor a link-time dependency are needed.

/*
#cgo CFLAGS: -O2 -Wall
#include <dlfcn.h>
#include <stddef.h>
#include <string.h>

// OSSL_PARAM, mirrored from <openssl/core.h> (stable ABI across OpenSSL 3.x and 4.x). No headers needed.
typedef struct {
	const char *key;
	unsigned int data_type;
	void *data;
	size_t data_size;
	size_t return_size;
} ossl_param;

static void *(*p_EVP_MAC_fetch)(void *, const char *, const char *);
static void (*p_EVP_MAC_free)(void *);
static const void *(*p_EVP_MAC_get0_provider)(const void *);
static const char *(*p_OSSL_PROVIDER_get0_name)(const void *);
static void *(*p_EVP_MAC_CTX_new)(void *);
static void (*p_EVP_MAC_CTX_free)(void *);
static int (*p_EVP_MAC_init)(void *, const unsigned char *, size_t, const ossl_param *);
static int (*p_EVP_MAC_update)(void *, const unsigned char *, size_t);
static int (*p_EVP_MAC_final)(void *, unsigned char *, size_t *, size_t);
static ossl_param (*p_OSSL_PARAM_construct_utf8_string)(const char *, char *, size_t);
static ossl_param (*p_OSSL_PARAM_construct_end)(void);
static void (*p_ERR_clear_error)(void);

static void *g_mac; // EVP_MAC* "HMAC" fetched from the FIPS provider; immutable once set.

static void *sym(void *h, const char *name) { return dlsym(h, name); }

// Prefer the libcrypto that is already mapped into the process (the one the Go toolchain's OpenSSL backend
// dlopen()ed), so we share its instance, config and FIPS provider. Fall back to loading it.
static void *open_libcrypto(void) {
	static const char *name = "libcrypto.so.4";
	void *h;
	if ((h = dlopen(name, RTLD_NOW | RTLD_NOLOAD))) { return h; }
	if ((h = dlopen(name, RTLD_NOW | RTLD_LOCAL))) { return h; }
	return 0;
}

// Returns 0 on success, otherwise a distinct nonzero code.
static int ossl_hmac_setup(void) {
	void *h = open_libcrypto();
	if (!h) return 1;
#define LOAD(n) if (!(*(void **)&p_##n = sym(h, #n))) return 2;
	LOAD(EVP_MAC_fetch) LOAD(EVP_MAC_free) LOAD(EVP_MAC_get0_provider) LOAD(OSSL_PROVIDER_get0_name)
	LOAD(EVP_MAC_CTX_new) LOAD(EVP_MAC_CTX_free) LOAD(EVP_MAC_init) LOAD(EVP_MAC_update) LOAD(EVP_MAC_final)
	LOAD(OSSL_PARAM_construct_utf8_string) LOAD(OSSL_PARAM_construct_end) LOAD(ERR_clear_error)
#undef LOAD
	void *mac = p_EVP_MAC_fetch(0, "HMAC", "provider=fips");
	if (!mac) { p_ERR_clear_error(); return 3; }
	const void *prov = p_EVP_MAC_get0_provider(mac);
	const char *pn = prov ? p_OSSL_PROVIDER_get0_name(prov) : 0;
	if (!pn || strcmp(pn, "fips") != 0) { p_EVP_MAC_free(mac); return 4; }
	g_mac = mac;
	return 0;
}

// HMAC-SHA1 via EVP_MAC in the FIPS provider. out must hold 20 bytes. Returns 0 on success.
static int ossl_hmac_sha1(const unsigned char *key, size_t keylen, const unsigned char *msg, size_t msglen, unsigned char *out) {
	char digest[] = "SHA1";
	ossl_param params[2];
	size_t n = 0;
	int rc = 1;
	void *ctx = p_EVP_MAC_CTX_new(g_mac);
	if (!ctx) goto done;
	params[0] = p_OSSL_PARAM_construct_utf8_string("digest", digest, sizeof(digest) - 1);
	params[1] = p_OSSL_PARAM_construct_end();
	if (p_EVP_MAC_init(ctx, key, keylen, params) != 1) goto done;
	if (msglen && p_EVP_MAC_update(ctx, msg, msglen) != 1) goto done;
	if (p_EVP_MAC_final(ctx, out, &n, 20) != 1 || n != 20) goto done;
	rc = 0;
done:
	if (ctx) p_EVP_MAC_CTX_free(ctx);
	if (rc) p_ERR_clear_error();
	return rc;
}
*/
import "C"

import (
	"fmt"
	"sync"
	"unsafe"
)

var (
	setupOnce sync.Once
	setupErr  error
)

func setup() error {
	setupOnce.Do(func() {
		switch rc := C.ossl_hmac_setup(); rc {
		case 0:
		case 1:
			setupErr = fmt.Errorf("mfa: cannot load libcrypto.so.4")
		case 2:
			setupErr = fmt.Errorf("mfa: libcrypto lacks the EVP_MAC API")
		case 3:
			setupErr = fmt.Errorf("mfa: HMAC is not available from the OpenSSL FIPS provider")
		default:
			setupErr = fmt.Errorf("mfa: HMAC was not fetched from the OpenSSL FIPS provider")
		}
	})
	return setupErr
}

// hmacSHA1 computes HMAC-SHA1 inside the OpenSSL FIPS provider. It fails closed: if the FIPS provider cannot
// be used it returns an error and never falls back to another implementation.
func hmacSHA1(key, msg []byte) ([]byte, error) {
	if len(key) == 0 {
		return nil, errEmptyKey
	}
	if err := setup(); err != nil {
		return nil, err
	}
	var mp *C.uchar
	if len(msg) > 0 {
		mp = (*C.uchar)(unsafe.Pointer(&msg[0]))
	}
	out := make([]byte, 20)
	if C.ossl_hmac_sha1((*C.uchar)(unsafe.Pointer(&key[0])), C.size_t(len(key)), mp, C.size_t(len(msg)), (*C.uchar)(unsafe.Pointer(&out[0]))) != 0 {
		return nil, fmt.Errorf("mfa: OpenSSL HMAC-SHA1 failed")
	}
	return out, nil
}
