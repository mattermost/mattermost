package invalid

import "request"

func InvalidFunction(ctx request.CTX) { // want "parameter of type request.CTX should be named 'rctx', got 'ctx'"
}

func InvalidShortName(c request.CTX) { // want "parameter of type request.CTX should be named 'rctx', got 'c'"
}

func InvalidFunctionWithTwoArguments(ctx request.CTX, id string) { // want "parameter of type request.CTX should be named 'rctx', got 'ctx'"
}

func InvalidPointerFunction(context *request.CTX, id string) { // want "parameter of type request.CTX should be named 'rctx', got 'context'"
}

func InvalidMultipleParams(ctx1 request.CTX, ctx2 request.CTX) { // want "parameter of type request.CTX should be named 'rctx', got 'ctx1'" "parameter of type request.CTX should be named 'rctx', got 'ctx2'"
}
