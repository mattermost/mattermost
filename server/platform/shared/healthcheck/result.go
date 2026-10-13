// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

type Result struct {
	State   State
	Subject string
	Scope   string

	MessageID string
	Details   map[string]string
	Value     *float64
}

func Firing(messageID string) Result {
	return Result{
		State:     StateFiring,
		MessageID: messageID,
	}
}

func FiringSubject(subject, messageID string) Result {
	r := Firing(messageID)
	r.Subject = subject
	return r
}

func Resolved() Result {
	return Result{
		State: StateResolved,
	}
}

func ResolvedSubject(subject string) Result {
	r := Resolved()
	r.Subject = subject
	return r
}

func Unknown(reasonID string) Result {
	return Result{
		State:     StateUnknown,
		MessageID: reasonID,
	}
}

func UnknownSubject(subject, reasonID string) Result {
	r := Unknown(reasonID)
	r.Subject = subject
	return r
}

func (r Result) WithDetail(key, value string) Result {
	if r.Details == nil {
		r.Details = map[string]string{}
	}

	r.Details[key] = value
	return r
}

func (r Result) WithValue(v float64) Result {
	r.Value = &v
	return r
}
