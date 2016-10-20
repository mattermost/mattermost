// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package keychain

/*
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#include <CoreServices/CoreServices.h>

#cgo LDFLAGS: -framework CoreFoundation -framework Security

static char*
mac2c(CFStringRef s)
{
	char *p;
	int n;

	n = CFStringGetLength(s)*8;	
	p = malloc(n);
	CFStringGetCString(s, p, n, kCFStringEncodingUTF8);
	return p;
}

void
keychain_getpasswd(char *user0, char *server, char **user, char **passwd, char **error)
{
	OSStatus st;
	UInt32 len;
	void *data;
	SecKeychainItemRef it;
	CFStringRef str;

	*user = NULL;
	*passwd = NULL;
	*error = NULL;

	st = SecKeychainFindInternetPassword(
		NULL,  // default keychain
		strlen(server), server,
		0, NULL,  // security domain
		strlen(user0), user0,  // account name
		0, NULL,  // path
		0,  // port
		0,  // protocol type
		kSecAuthenticationTypeDefault,
		&len,
		&data,
		&it);
	if(st != 0) {
		str = SecCopyErrorMessageString(st, NULL);
		*error = mac2c(str);
		CFRelease(str);
		return;
	}
	*passwd = malloc(len+1);
	memmove(*passwd, data, len);
	(*passwd)[len] = '\0';
	SecKeychainItemFreeContent(NULL, data);

	SecKeychainAttribute attr = {kSecAccountItemAttr, 0, NULL};
	SecKeychainAttributeList attrl = {1, &attr};
	st = SecKeychainItemCopyContent(
		it,
		NULL,
		&attrl,
		0, NULL);
	if(st != 0) {
		str = SecCopyErrorMessageString(st, NULL);
		*error = mac2c(str);
		CFRelease(str);
		return;
	}
	data = attr.data;
	len = attr.length;
	*user = malloc(len+1);
	memmove(*user, data, len);
	(*user)[len] = '\0';
	SecKeychainItemFreeContent(&attrl, NULL);
}
*/
import "C"

import (
	"errors"
	"unsafe"
)

func userPasswd(server, user string) (user1, passwd string, err error) {
	cServer := C.CString(server)
	cUser := C.CString(user)
	defer C.free(unsafe.Pointer(cServer))
	defer C.free(unsafe.Pointer(cUser))

	var cPasswd, cError *C.char
	C.keychain_getpasswd(cUser, cServer, &cUser, &cPasswd, &cError)
	defer C.free(unsafe.Pointer(cUser))
	defer C.free(unsafe.Pointer(cPasswd))
	defer C.free(unsafe.Pointer(cError))

	if cError != nil {
		return "", "", errors.New(C.GoString(cError))
	}

	return C.GoString(cUser), C.GoString(cPasswd), nil
}
