package valid

import "request"

// Valid usage - parameter named rctx
func ValidFunction(rctx request.CTX, id string) {
}

// Valid usage - pointer to request.CTX named rctx
func ValidPointerFunction(rctx *request.CTX, id string) {
}

// Valid usage - underscore parameter (ignored)
func ValidIgnoredFunction(_ request.CTX, id string) {
}

// Valid usage - multiple parameters with rctx
func ValidMultipleParams(rctx request.CTX, name string, age int) {
}
