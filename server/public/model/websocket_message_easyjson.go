// Code generated by easyjson for marshaling/unmarshaling. DO NOT EDIT.

package model

import (
	json "encoding/json"
	easyjson "github.com/mailru/easyjson"
	jlexer "github.com/mailru/easyjson/jlexer"
	jwriter "github.com/mailru/easyjson/jwriter"
)

// suppress unused package warning
var (
	_ *json.RawMessage
	_ *jlexer.Lexer
	_ *jwriter.Writer
	_ easyjson.Marshaler
)

func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel(in *jlexer.Lexer, out *webSocketEventJSON) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		case "event":
			out.Event = WebsocketEventType(in.String())
		case "data":
			if in.IsNull() {
				in.Skip()
			} else {
				in.Delim('{')
				out.Data = make(map[string]interface{})
				for !in.IsDelim('}') {
					key := string(in.String())
					in.WantColon()
					var v1 interface{}
					if m, ok := v1.(easyjson.Unmarshaler); ok {
						m.UnmarshalEasyJSON(in)
					} else if m, ok := v1.(json.Unmarshaler); ok {
						_ = m.UnmarshalJSON(in.Raw())
					} else {
						v1 = in.Interface()
					}
					(out.Data)[key] = v1
					in.WantComma()
				}
				in.Delim('}')
			}
		case "broadcast":
			if in.IsNull() {
				in.Skip()
				out.Broadcast = nil
			} else {
				if out.Broadcast == nil {
					out.Broadcast = new(WebsocketBroadcast)
				}
				(*out.Broadcast).UnmarshalEasyJSON(in)
			}
		case "seq":
			out.Sequence = int64(in.Int64())
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel(out *jwriter.Writer, in webSocketEventJSON) {
	out.RawByte('{')
	first := true
	_ = first
	{
		const prefix string = ",\"event\":"
		out.RawString(prefix[1:])
		out.String(string(in.Event))
	}
	{
		const prefix string = ",\"data\":"
		out.RawString(prefix)
		if in.Data == nil && (out.Flags&jwriter.NilMapAsEmpty) == 0 {
			out.RawString(`null`)
		} else {
			out.RawByte('{')
			v2First := true
			for v2Name, v2Value := range in.Data {
				if v2First {
					v2First = false
				} else {
					out.RawByte(',')
				}
				out.String(string(v2Name))
				out.RawByte(':')
				if m, ok := v2Value.(easyjson.Marshaler); ok {
					m.MarshalEasyJSON(out)
				} else if m, ok := v2Value.(json.Marshaler); ok {
					out.Raw(m.MarshalJSON())
				} else {
					out.Raw(json.Marshal(v2Value))
				}
			}
			out.RawByte('}')
		}
	}
	{
		const prefix string = ",\"broadcast\":"
		out.RawString(prefix)
		if in.Broadcast == nil {
			out.RawString("null")
		} else {
			(*in.Broadcast).MarshalEasyJSON(out)
		}
	}
	{
		const prefix string = ",\"seq\":"
		out.RawString(prefix)
		out.Int64(int64(in.Sequence))
	}
	out.RawByte('}')
}

// MarshalJSON supports json.Marshaler interface
func (v webSocketEventJSON) MarshalJSON() ([]byte, error) {
	w := jwriter.Writer{}
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel(&w, v)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON supports easyjson.Marshaler interface
func (v webSocketEventJSON) MarshalEasyJSON(w *jwriter.Writer) {
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel(w, v)
}

// UnmarshalJSON supports json.Unmarshaler interface
func (v *webSocketEventJSON) UnmarshalJSON(data []byte) error {
	r := jlexer.Lexer{Data: data}
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel(&r, v)
	return r.Error()
}

// UnmarshalEasyJSON supports easyjson.Unmarshaler interface
func (v *webSocketEventJSON) UnmarshalEasyJSON(l *jlexer.Lexer) {
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel(l, v)
}
func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel1(in *jlexer.Lexer, out *precomputedWebSocketEventJSON) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		case "Event":
			if data := in.Raw(); in.Ok() {
				in.AddError((out.Event).UnmarshalJSON(data))
			}
		case "Data":
			if data := in.Raw(); in.Ok() {
				in.AddError((out.Data).UnmarshalJSON(data))
			}
		case "Broadcast":
			if data := in.Raw(); in.Ok() {
				in.AddError((out.Broadcast).UnmarshalJSON(data))
			}
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel1(out *jwriter.Writer, in precomputedWebSocketEventJSON) {
	out.RawByte('{')
	first := true
	_ = first
	{
		const prefix string = ",\"Event\":"
		out.RawString(prefix[1:])
		out.Raw((in.Event).MarshalJSON())
	}
	{
		const prefix string = ",\"Data\":"
		out.RawString(prefix)
		out.Raw((in.Data).MarshalJSON())
	}
	{
		const prefix string = ",\"Broadcast\":"
		out.RawString(prefix)
		out.Raw((in.Broadcast).MarshalJSON())
	}
	out.RawByte('}')
}

// MarshalJSON supports json.Marshaler interface
func (v precomputedWebSocketEventJSON) MarshalJSON() ([]byte, error) {
	w := jwriter.Writer{}
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel1(&w, v)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON supports easyjson.Marshaler interface
func (v precomputedWebSocketEventJSON) MarshalEasyJSON(w *jwriter.Writer) {
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel1(w, v)
}

// UnmarshalJSON supports json.Unmarshaler interface
func (v *precomputedWebSocketEventJSON) UnmarshalJSON(data []byte) error {
	r := jlexer.Lexer{Data: data}
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel1(&r, v)
	return r.Error()
}

// UnmarshalEasyJSON supports easyjson.Unmarshaler interface
func (v *precomputedWebSocketEventJSON) UnmarshalEasyJSON(l *jlexer.Lexer) {
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel1(l, v)
}
func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel2(in *jlexer.Lexer, out *WebsocketBroadcast) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		case "omit_users":
			if in.IsNull() {
				in.Skip()
			} else {
				in.Delim('{')
				out.OmitUsers = make(map[string]bool)
				for !in.IsDelim('}') {
					key := string(in.String())
					in.WantColon()
					var v3 bool
					v3 = bool(in.Bool())
					(out.OmitUsers)[key] = v3
					in.WantComma()
				}
				in.Delim('}')
			}
		case "user_id":
			out.UserId = string(in.String())
		case "channel_id":
			out.ChannelId = string(in.String())
		case "team_id":
			out.TeamId = string(in.String())
		case "connection_id":
			out.ConnectionId = string(in.String())
		case "omit_connection_id":
			out.OmitConnectionId = string(in.String())
		case "contains_sanitized_data":
			out.ContainsSanitizedData = bool(in.Bool())
		case "contains_sensitive_data":
			out.ContainsSensitiveData = bool(in.Bool())
		case "broadcast_hooks":
			if in.IsNull() {
				in.Skip()
				out.BroadcastHooks = nil
			} else {
				in.Delim('[')
				if out.BroadcastHooks == nil {
					if !in.IsDelim(']') {
						out.BroadcastHooks = make([]string, 0, 4)
					} else {
						out.BroadcastHooks = []string{}
					}
				} else {
					out.BroadcastHooks = (out.BroadcastHooks)[:0]
				}
				for !in.IsDelim(']') {
					var v4 string
					v4 = string(in.String())
					out.BroadcastHooks = append(out.BroadcastHooks, v4)
					in.WantComma()
				}
				in.Delim(']')
			}
		case "broadcast_hook_args":
			if in.IsNull() {
				in.Skip()
				out.BroadcastHookArgs = nil
			} else {
				in.Delim('[')
				if out.BroadcastHookArgs == nil {
					if !in.IsDelim(']') {
						out.BroadcastHookArgs = make([]map[string]interface{}, 0, 8)
					} else {
						out.BroadcastHookArgs = []map[string]interface{}{}
					}
				} else {
					out.BroadcastHookArgs = (out.BroadcastHookArgs)[:0]
				}
				for !in.IsDelim(']') {
					var v5 map[string]interface{}
					if in.IsNull() {
						in.Skip()
					} else {
						in.Delim('{')
						if !in.IsDelim('}') {
							v5 = make(map[string]interface{})
						} else {
							v5 = nil
						}
						for !in.IsDelim('}') {
							key := string(in.String())
							in.WantColon()
							var v6 interface{}
							if m, ok := v6.(easyjson.Unmarshaler); ok {
								m.UnmarshalEasyJSON(in)
							} else if m, ok := v6.(json.Unmarshaler); ok {
								_ = m.UnmarshalJSON(in.Raw())
							} else {
								v6 = in.Interface()
							}
							(v5)[key] = v6
							in.WantComma()
						}
						in.Delim('}')
					}
					out.BroadcastHookArgs = append(out.BroadcastHookArgs, v5)
					in.WantComma()
				}
				in.Delim(']')
			}
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel2(out *jwriter.Writer, in WebsocketBroadcast) {
	out.RawByte('{')
	first := true
	_ = first
	{
		const prefix string = ",\"omit_users\":"
		out.RawString(prefix[1:])
		if in.OmitUsers == nil && (out.Flags&jwriter.NilMapAsEmpty) == 0 {
			out.RawString(`null`)
		} else {
			out.RawByte('{')
			v7First := true
			for v7Name, v7Value := range in.OmitUsers {
				if v7First {
					v7First = false
				} else {
					out.RawByte(',')
				}
				out.String(string(v7Name))
				out.RawByte(':')
				out.Bool(bool(v7Value))
			}
			out.RawByte('}')
		}
	}
	{
		const prefix string = ",\"user_id\":"
		out.RawString(prefix)
		out.String(string(in.UserId))
	}
	{
		const prefix string = ",\"channel_id\":"
		out.RawString(prefix)
		out.String(string(in.ChannelId))
	}
	{
		const prefix string = ",\"team_id\":"
		out.RawString(prefix)
		out.String(string(in.TeamId))
	}
	{
		const prefix string = ",\"connection_id\":"
		out.RawString(prefix)
		out.String(string(in.ConnectionId))
	}
	{
		const prefix string = ",\"omit_connection_id\":"
		out.RawString(prefix)
		out.String(string(in.OmitConnectionId))
	}
	if in.ContainsSanitizedData {
		const prefix string = ",\"contains_sanitized_data\":"
		out.RawString(prefix)
		out.Bool(bool(in.ContainsSanitizedData))
	}
	if in.ContainsSensitiveData {
		const prefix string = ",\"contains_sensitive_data\":"
		out.RawString(prefix)
		out.Bool(bool(in.ContainsSensitiveData))
	}
	if len(in.BroadcastHooks) != 0 {
		const prefix string = ",\"broadcast_hooks\":"
		out.RawString(prefix)
		{
			out.RawByte('[')
			for v8, v9 := range in.BroadcastHooks {
				if v8 > 0 {
					out.RawByte(',')
				}
				out.String(string(v9))
			}
			out.RawByte(']')
		}
	}
	if len(in.BroadcastHookArgs) != 0 {
		const prefix string = ",\"broadcast_hook_args\":"
		out.RawString(prefix)
		{
			out.RawByte('[')
			for v10, v11 := range in.BroadcastHookArgs {
				if v10 > 0 {
					out.RawByte(',')
				}
				if v11 == nil && (out.Flags&jwriter.NilMapAsEmpty) == 0 {
					out.RawString(`null`)
				} else {
					out.RawByte('{')
					v12First := true
					for v12Name, v12Value := range v11 {
						if v12First {
							v12First = false
						} else {
							out.RawByte(',')
						}
						out.String(string(v12Name))
						out.RawByte(':')
						if m, ok := v12Value.(easyjson.Marshaler); ok {
							m.MarshalEasyJSON(out)
						} else if m, ok := v12Value.(json.Marshaler); ok {
							out.Raw(m.MarshalJSON())
						} else {
							out.Raw(json.Marshal(v12Value))
						}
					}
					out.RawByte('}')
				}
			}
			out.RawByte(']')
		}
	}
	out.RawByte('}')
}

// MarshalJSON supports json.Marshaler interface
func (v WebsocketBroadcast) MarshalJSON() ([]byte, error) {
	w := jwriter.Writer{}
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel2(&w, v)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON supports easyjson.Marshaler interface
func (v WebsocketBroadcast) MarshalEasyJSON(w *jwriter.Writer) {
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel2(w, v)
}

// UnmarshalJSON supports json.Unmarshaler interface
func (v *WebsocketBroadcast) UnmarshalJSON(data []byte) error {
	r := jlexer.Lexer{Data: data}
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel2(&r, v)
	return r.Error()
}

// UnmarshalEasyJSON supports easyjson.Unmarshaler interface
func (v *WebsocketBroadcast) UnmarshalEasyJSON(l *jlexer.Lexer) {
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel2(l, v)
}
func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel3(in *jlexer.Lexer, out *WebSocketResponse) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		case "status":
			out.Status = string(in.String())
		case "seq_reply":
			out.SeqReply = int64(in.Int64())
		case "data":
			if in.IsNull() {
				in.Skip()
			} else {
				in.Delim('{')
				if !in.IsDelim('}') {
					out.Data = make(map[string]interface{})
				} else {
					out.Data = nil
				}
				for !in.IsDelim('}') {
					key := string(in.String())
					in.WantColon()
					var v13 interface{}
					if m, ok := v13.(easyjson.Unmarshaler); ok {
						m.UnmarshalEasyJSON(in)
					} else if m, ok := v13.(json.Unmarshaler); ok {
						_ = m.UnmarshalJSON(in.Raw())
					} else {
						v13 = in.Interface()
					}
					(out.Data)[key] = v13
					in.WantComma()
				}
				in.Delim('}')
			}
		case "error":
			if in.IsNull() {
				in.Skip()
				out.Error = nil
			} else {
				if out.Error == nil {
					out.Error = new(AppError)
				}
				easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel4(in, out.Error)
			}
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel3(out *jwriter.Writer, in WebSocketResponse) {
	out.RawByte('{')
	first := true
	_ = first
	{
		const prefix string = ",\"status\":"
		out.RawString(prefix[1:])
		out.String(string(in.Status))
	}
	if in.SeqReply != 0 {
		const prefix string = ",\"seq_reply\":"
		out.RawString(prefix)
		out.Int64(int64(in.SeqReply))
	}
	if len(in.Data) != 0 {
		const prefix string = ",\"data\":"
		out.RawString(prefix)
		{
			out.RawByte('{')
			v14First := true
			for v14Name, v14Value := range in.Data {
				if v14First {
					v14First = false
				} else {
					out.RawByte(',')
				}
				out.String(string(v14Name))
				out.RawByte(':')
				if m, ok := v14Value.(easyjson.Marshaler); ok {
					m.MarshalEasyJSON(out)
				} else if m, ok := v14Value.(json.Marshaler); ok {
					out.Raw(m.MarshalJSON())
				} else {
					out.Raw(json.Marshal(v14Value))
				}
			}
			out.RawByte('}')
		}
	}
	if in.Error != nil {
		const prefix string = ",\"error\":"
		out.RawString(prefix)
		easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel4(out, *in.Error)
	}
	out.RawByte('}')
}

// MarshalJSON supports json.Marshaler interface
func (v WebSocketResponse) MarshalJSON() ([]byte, error) {
	w := jwriter.Writer{}
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel3(&w, v)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON supports easyjson.Marshaler interface
func (v WebSocketResponse) MarshalEasyJSON(w *jwriter.Writer) {
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel3(w, v)
}

// UnmarshalJSON supports json.Unmarshaler interface
func (v *WebSocketResponse) UnmarshalJSON(data []byte) error {
	r := jlexer.Lexer{Data: data}
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel3(&r, v)
	return r.Error()
}

// UnmarshalEasyJSON supports easyjson.Unmarshaler interface
func (v *WebSocketResponse) UnmarshalEasyJSON(l *jlexer.Lexer) {
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel3(l, v)
}
func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel4(in *jlexer.Lexer, out *AppError) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		case "id":
			out.Id = string(in.String())
		case "message":
			out.Message = string(in.String())
		case "detailed_error":
			out.DetailedError = string(in.String())
		case "request_id":
			out.RequestId = string(in.String())
		case "status_code":
			out.StatusCode = int(in.Int())
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel4(out *jwriter.Writer, in AppError) {
	out.RawByte('{')
	first := true
	_ = first
	{
		const prefix string = ",\"id\":"
		out.RawString(prefix[1:])
		out.String(string(in.Id))
	}
	{
		const prefix string = ",\"message\":"
		out.RawString(prefix)
		out.String(string(in.Message))
	}
	{
		const prefix string = ",\"detailed_error\":"
		out.RawString(prefix)
		out.String(string(in.DetailedError))
	}
	if in.RequestId != "" {
		const prefix string = ",\"request_id\":"
		out.RawString(prefix)
		out.String(string(in.RequestId))
	}
	if in.StatusCode != 0 {
		const prefix string = ",\"status_code\":"
		out.RawString(prefix)
		out.Int(int(in.StatusCode))
	}
	out.RawByte('}')
}
func easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel5(in *jlexer.Lexer, out *WebSocketEvent) {
	isTopLevel := in.IsStart()
	if in.IsNull() {
		if isTopLevel {
			in.Consumed()
		}
		in.Skip()
		return
	}
	in.Delim('{')
	for !in.IsDelim('}') {
		key := in.UnsafeFieldName(false)
		in.WantColon()
		if in.IsNull() {
			in.Skip()
			in.WantComma()
			continue
		}
		switch key {
		default:
			in.SkipRecursive()
		}
		in.WantComma()
	}
	in.Delim('}')
	if isTopLevel {
		in.Consumed()
	}
}
func easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel5(out *jwriter.Writer, in WebSocketEvent) {
	out.RawByte('{')
	first := true
	_ = first
	out.RawByte('}')
}

// MarshalJSON supports json.Marshaler interface
func (v WebSocketEvent) MarshalJSON() ([]byte, error) {
	w := jwriter.Writer{}
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel5(&w, v)
	return w.Buffer.BuildBytes(), w.Error
}

// MarshalEasyJSON supports easyjson.Marshaler interface
func (v WebSocketEvent) MarshalEasyJSON(w *jwriter.Writer) {
	easyjson717ebd13EncodeGithubComMattermostMattermostServerPublicModel5(w, v)
}

// UnmarshalJSON supports json.Unmarshaler interface
func (v *WebSocketEvent) UnmarshalJSON(data []byte) error {
	r := jlexer.Lexer{Data: data}
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel5(&r, v)
	return r.Error()
}

// UnmarshalEasyJSON supports easyjson.Unmarshaler interface
func (v *WebSocketEvent) UnmarshalEasyJSON(l *jlexer.Lexer) {
	easyjson717ebd13DecodeGithubComMattermostMattermostServerPublicModel5(l, v)
}