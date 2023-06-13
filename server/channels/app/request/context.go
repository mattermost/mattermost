// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package request

import (
	"context"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type Context struct {
	t              i18n.TranslateFunc
	session        model.Session
	requestId      string
	ipAddress      string
	path           string
	userAgent      string
	acceptLanguage string
	logger         mlog.LoggerIFace
	err            *model.AppError

	context context.Context
}

func NewContext(ctx context.Context, requestId, ipAddress, path, userAgent, acceptLanguage string, session model.Session, t i18n.TranslateFunc) *Context {
	return &Context{
		t:              t,
		session:        session,
		requestId:      requestId,
		ipAddress:      ipAddress,
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

func (c *Context) T(translationID string, args ...any) string {
	return c.t(translationID, args...)
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
func (c *Context) Path() string {
	return c.path
}
func (c *Context) UserAgent() string {
	return c.userAgent
}
func (c *Context) AcceptLanguage() string {
	return c.acceptLanguage
}

func (c *Context) Context() context.Context {
	return c.context
}

func (c *Context) SetSession(s *model.Session) {
	c.session = *s
}

func (c *Context) SetT(t i18n.TranslateFunc) {
	c.t = t
}
func (c *Context) SetRequestId(s string) {
	c.requestId = s
}
func (c *Context) SetIPAddress(s string) {
	c.ipAddress = s
}
func (c *Context) SetUserAgent(s string) {
	c.userAgent = s
}
func (c *Context) SetAcceptLanguage(s string) {
	c.acceptLanguage = s
}
func (c *Context) SetPath(s string) {
	c.path = s
}
func (c *Context) SetContext(ctx context.Context) {
	c.context = ctx
}

func (c *Context) GetT() i18n.TranslateFunc {
	return c.t
}

func (c *Context) SetLogger(logger mlog.LoggerIFace) {
	c.logger = logger
}

func (c *Context) Logger() mlog.LoggerIFace {
	return c.logger
}

func (c *Context) SetAppError(err *model.AppError) {
	c.err = err
}

func (c *Context) AppError() *model.AppError {
	return c.err
}

type CTX interface {
	T(string, ...interface{}) string
	Session() *model.Session
	RequestId() string
	IPAddress() string
	Path() string
	UserAgent() string
	AcceptLanguage() string
	Context() context.Context
	SetSession(s *model.Session)
	SetT(i18n.TranslateFunc)
	SetRequestId(string)
	SetIPAddress(string)
	SetUserAgent(string)
	SetAcceptLanguage(string)
	SetPath(string)
	SetContext(ctx context.Context)
	GetT() i18n.TranslateFunc
	SetLogger(mlog.LoggerIFace)
	Logger() mlog.LoggerIFace
	SetAppError(*model.AppError)
	AppError() *model.AppError
}
