// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package request

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// Context should be abbreviated as `rctx`.
type Context struct {
	t              i18n.TranslateFunc
	session        model.Session
	requestId      string
	ipAddress      string
	xForwardedFor  string
	path           string
	userAgent      string
	acceptLanguage string
	logger         mlog.LoggerIFace
	context        context.Context
}

func NewContext(ctx context.Context, requestId, ipAddress, xForwardedFor, path, userAgent, acceptLanguage string, t i18n.TranslateFunc) *Context {
	return &Context{
		t:              t,
		requestId:      requestId,
		ipAddress:      ipAddress,
		xForwardedFor:  xForwardedFor,
		path:           path,
		userAgent:      userAgent,
		acceptLanguage: acceptLanguage,
		context:        ctx,
	}
}

func EmptyContext(logger mlog.LoggerIFace) *Context {
	return &Context{
		t:       i18n.T,
		logger:  logger,
		context: context.Background(),
	}
}

// TestContext creates an empty context with a new logger to use in testing where a test helper is
// not required.
func TestContext(t testing.TB) *Context {
	logger := mlog.CreateConsoleTestLogger(t)
	return EmptyContext(logger)
}

// clone creates a shallow copy of Context, allowing clones to apply per-request changes.
func (c *Context) clone() *Context {
	cCopy := *c
	return &cCopy
}

func (c *Context) T(translationID string, args ...any) string {
	return c.t(translationID, args...)
}
func (c *Context) GetT() i18n.TranslateFunc {
	return c.t
}
func (c *Context) Session() *model.Session {
	return &c.session
}
func (c *Context) RequestId() string {
	return c.requestId
}
func (c *Context) IPAddress() string {
	return c.ipAddress
}
func (c *Context) XForwardedFor() string {
	return c.xForwardedFor
}
func (c *Context) Path() string {
	return c.path
}
func (c *Context) UserAgent() string {
	return c.userAgent
}
func (c *Context) AcceptLanguage() string {
	return c.acceptLanguage
}
func (c *Context) Logger() mlog.LoggerIFace {
	return c.logger
}
func (c *Context) Context() context.Context {
	return c.context
}

func (c *Context) WithT(t i18n.TranslateFunc) CTX {
	rctx := c.clone()
	rctx.t = t
	return rctx
}
func (c *Context) WithSession(s *model.Session) CTX {
	rctx := c.clone()
	rctx.session = *s
	return rctx
}
func (c *Context) WithRequestId(s string) CTX {
	rctx := c.clone()
	rctx.requestId = s
	return rctx
}
func (c *Context) WithIPAddress(s string) CTX {
	rctx := c.clone()
	rctx.ipAddress = s
	return rctx
}
func (c *Context) WithXForwardedFor(s string) CTX {
	rctx := c.clone()
	rctx.xForwardedFor = s
	return rctx
}
func (c *Context) WithPath(s string) CTX {
	rctx := c.clone()
	rctx.path = s
	return rctx
}
func (c *Context) WithUserAgent(s string) CTX {
	rctx := c.clone()
	rctx.userAgent = s
	return rctx
}
func (c *Context) WithAcceptLanguage(s string) CTX {
	rctx := c.clone()
	rctx.acceptLanguage = s
	return rctx
}
func (c *Context) WithContext(ctx context.Context) CTX {
	rctx := c.clone()
	rctx.context = ctx
	return rctx
}
func (c *Context) WithLogger(logger mlog.LoggerIFace) CTX {
	rctx := c.clone()
	rctx.logger = logger
	return rctx
}

func (c *Context) With(f func(ctx CTX) CTX) CTX {
	return f(c)
}

// CTX should be abbreviated as `rctx`.
type CTX interface {
	T(string, ...interface{}) string
	GetT() i18n.TranslateFunc
	Session() *model.Session
	RequestId() string
	IPAddress() string
	XForwardedFor() string
	Path() string
	UserAgent() string
	AcceptLanguage() string
	Logger() mlog.LoggerIFace
	Context() context.Context
	WithT(i18n.TranslateFunc) CTX
	WithSession(s *model.Session) CTX
	WithRequestId(string) CTX
	WithIPAddress(string) CTX
	WithXForwardedFor(string) CTX
	WithPath(string) CTX
	WithUserAgent(string) CTX
	WithAcceptLanguage(string) CTX
	WithLogger(mlog.LoggerIFace) CTX
	WithContext(ctx context.Context) CTX
	With(func(ctx CTX) CTX) CTX
}
