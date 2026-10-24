// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	einterfacesmocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	TestTopics  = " share incident "
	TestTopic   = "share"
	NumRemotes  = 50
	NoteContent = "Woot!!"
)

type testPayload struct {
	Note string `json:"note"`
}

func TestBroadcastMsg(t *testing.T) {
	msgId := model.NewId()

	t.Run("No error", func(t *testing.T) {
		var countCallbacks atomic.Int32
		var countWebReq atomic.Int32
		merr := merror.New()

		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				w.WriteHeader(200)
				var resp Response
				b, errMarshall := json.Marshal(&resp)
				if errMarshall != nil {
					merr.Append(errMarshall)
					return
				}
				w.Write(b)
			}()

			countWebReq.Add(1)

			var frame model.RemoteClusterFrame
			jsonErr := json.NewDecoder(r.Body).Decode(&frame)
			if jsonErr != nil {
				merr.Append(jsonErr)
				return
			}
			if len(frame.Msg.Payload) == 0 {
				merr.Append(fmt.Errorf("webrequest missing Msg.Payload"))
			}
			if msgId != frame.Msg.Id {
				merr.Append(fmt.Errorf("webrequest msgId expected %s, got %s", msgId, frame.Msg.Id))
				return
			}

			note := testPayload{}
			err := json.Unmarshal(frame.Msg.Payload, &note)
			if err != nil {
				merr.Append(err)
				return
			}
			if note.Note != NoteContent {
				merr.Append(fmt.Errorf("webrequest payload expected %s, got %s", NoteContent, note.Note))
				return
			}
		}))
		defer ts.Close()

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL, false))
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)
		service.disablePing = true

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		msg := makeRemoteClusterMsg(msgId, NoteContent)

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*15)
		defer cancel()

		err = service.BroadcastMsg(ctx, msg, func(msg model.RemoteClusterMsg, remote *model.RemoteCluster, resp *Response, err error) {
			defer wg.Done()
			countCallbacks.Add(1)

			if err != nil {
				merr.Append(err)
			}
			if msgId != msg.Id {
				merr.Append(fmt.Errorf("result callback msgId expected %s, got %s", msgId, msg.Id))
			}

			var note testPayload
			err2 := json.Unmarshal(msg.Payload, &note)
			if err2 != nil {
				merr.Append(fmt.Errorf("unmarshal payload error: %w", err2))
				return
			}
			if note.Note != NoteContent {
				merr.Append(fmt.Errorf("compare payload failed: expected '%s', got '%s'", NoteContent, note))
			}
		})
		assert.NoError(t, err)

		wg.Wait()

		assert.NoError(t, merr.ErrorOrNil())

		assert.Equal(t, int32(NumRemotes), countCallbacks.Load())
		assert.Equal(t, int32(NumRemotes), countWebReq.Load())
		t.Logf("%d callbacks counted;  %d web requests counted;  %d expected",
			countCallbacks.Load(), countWebReq.Load(), NumRemotes)
	})

	t.Run("HTTP error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(500)
		}))
		defer ts.Close()

		mockServer := newMockServer(t, makeRemoteClusters(NumRemotes, ts.URL, false))
		mockApp := newMockApp(t, nil)

		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)
		service.disablePing = true

		err = service.Start()
		require.NoError(t, err)
		defer service.Shutdown()

		msg := makeRemoteClusterMsg(msgId, NoteContent)
		var countCallbacks atomic.Int32
		var countErrors atomic.Int32
		wg := &sync.WaitGroup{}
		wg.Add(NumRemotes)

		err = service.BroadcastMsg(context.Background(), msg, func(msg model.RemoteClusterMsg, remote *model.RemoteCluster, resp *Response, err error) {
			defer wg.Done()
			countCallbacks.Add(1)
			if err != nil {
				countErrors.Add(1)
			}
		})
		assert.NoError(t, err)

		wg.Wait()

		assert.Equal(t, int32(NumRemotes), countCallbacks.Load())
		assert.Equal(t, int32(NumRemotes), countErrors.Load())
	})
}

// TestService_sendFileToRemote_ResponseHandling exercises sendFileToRemote against a remote whose
// reply varies in size, shape and status. The cases cover what the caller makes of each reply, and
// how much of a reply the remote gets to send before the caller stops reading.
func TestService_sendFileToRemote_ResponseHandling(t *testing.T) {
	rs := newResponseServer()
	defer rs.Close()

	rc := makeRemoteCluster("remote_test_file_response", rs.URL, TestTopics)

	service, err := NewRemoteClusterService(newMockServer(t, makeRemoteClusters(NumRemotes, rs.URL, false)), newMockApp(t, nil))
	require.NoError(t, err)
	service.disablePing = true

	require.NoError(t, service.Start())
	defer service.Shutdown()

	fi := &model.FileInfo{Id: model.NewId(), Name: "test.png", Path: "remote/test.png"}
	task := sendFileTask{
		rc: rc,
		us: &model.UploadSession{Id: model.NewId(), Path: fi.Path},
		fi: fi,
		rp: testReaderProvider{data: []byte("file contents")},
	}

	// The complete, well-formed reply of a remote that stored the file.
	reply, err := json.Marshal(&model.FileInfo{Id: fi.Id, Name: fi.Name})
	require.NoError(t, err)

	call := func(timeout time.Duration) error {
		_, err := service.sendFileToRemote(timeout, task)
		return err
	}

	t.Run("complete reply is decoded and returned", func(t *testing.T) {
		rs.setReply(replyBody{prefix: reply})
		defer rs.awaitIdle(t)

		got, err := service.sendFileToRemote(defaultCallTimeout, task)
		require.NoError(t, err, "request should not error")
		require.NotNil(t, got)
		assert.Equal(t, fi.Id, got.Id)
		assert.Equal(t, fi.Name, got.Name)
	})

	// A reply with no body at all carries no FileInfo for this call site to decode.
	assertReplyCases(t, rs, call, sharedReplyCases(reply, false))

	assertReplyBytesServedStaysBounded(t, rs, reply, call)
}

// TestService_sendFrameToRemote_ResponseHandling exercises sendFrameToRemote, the shared helper
// behind sending a message, pinging a remote and confirming an invitation, against a remote whose
// reply varies in size, shape and status. The cases cover what the caller makes of each reply, and
// how much of a reply the remote gets to send before the caller stops reading.
func TestService_sendFrameToRemote_ResponseHandling(t *testing.T) {
	rs := newResponseServer()
	defer rs.Close()

	rc := makeRemoteCluster("remote_test_frame_response", rs.URL, TestTopics)

	service, err := NewRemoteClusterService(newMockServer(t, makeRemoteClusters(NumRemotes, rs.URL, false)), newMockApp(t, nil))
	require.NoError(t, err)
	service.disablePing = true

	require.NoError(t, service.Start())
	defer service.Shutdown()

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Msg:      makeRemoteClusterMsg(model.NewId(), NoteContent),
	}
	url := fmt.Sprintf("%s/%s", rs.URL, SendMsgURL)

	// The complete, well-formed reply that callers of sendFrameToRemote go on to decode.
	reply, err := json.Marshal(&Response{Status: ResponseStatusOK})
	require.NoError(t, err)

	call := func(timeout time.Duration) error {
		_, err := service.sendFrameToRemote(timeout, rc, frame, url)
		return err
	}

	t.Run("complete reply is returned to the caller", func(t *testing.T) {
		rs.setReply(replyBody{prefix: reply})
		defer rs.awaitIdle(t)

		respJSON, err := service.sendFrameToRemote(defaultCallTimeout, rc, frame, url)
		require.NoError(t, err, "request should not error")

		var response Response
		require.NoError(t, json.Unmarshal(respJSON, &response), "the returned bytes are what callers decode")
		assert.True(t, response.IsSuccess())
	})

	// This call site hands the bytes back for its callers to decode, so a reply with no body at
	// all reaches them as an empty slice rather than as an error.
	cases := sharedReplyCases(reply, true)

	// A remote that goes quiet partway through its reply is answered by the call timeout, which
	// this case shortens so it does not have to wait out the default.
	cases = append(cases, replyCase{
		name:    "reply the remote stops sending partway through",
		reply:   replyBody{prefix: reply, padLen: paddingBeyondRead, pause: time.Minute},
		timeout: time.Millisecond * 250,
		wantErr: true,
		errIs:   errRemoteUnreachable,
	})

	assertReplyCases(t, rs, call, cases)

	t.Run("error status with a complete reply returns the reply to the caller", func(t *testing.T) {
		rs.setReply(replyBody{prefix: reply, status: http.StatusInternalServerError})
		defer rs.awaitIdle(t)

		respJSON, err := service.sendFrameToRemote(defaultCallTimeout, rc, frame, url)
		require.Error(t, err)
		assert.Equal(t, reply, respJSON, "callers read the remote's error from the reply")
	})

	assertReplyBytesServedStaysBounded(t, rs, reply, call)
}

// TestService_confirmInviteSendError_ReplyHandling covers the error an admin accepting an invitation
// is shown for each way the remote's reply to the confirmation can fail.
func TestService_confirmInviteSendError_ReplyHandling(t *testing.T) {
	rs := newResponseServer()
	defer rs.Close()

	rc := makeRemoteCluster("remote_test_confirm_invite", rs.URL, TestTopics)

	service, err := NewRemoteClusterService(newMockServer(t, nil), newMockApp(t, nil))
	require.NoError(t, err)
	service.disablePing = true

	require.NoError(t, service.Start())
	defer service.Shutdown()

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Msg:      makeRemoteClusterMsg(model.NewId(), NoteContent),
	}
	url := fmt.Sprintf("%s/%s", rs.URL, ConfirmInviteURL)

	reply, err := json.Marshal(&Response{Status: ResponseStatusOK})
	require.NoError(t, err)
	refusal, err := json.Marshal(model.NewAppError("test", "api.remote_cluster.invalid_token", nil, "", http.StatusUnauthorized))
	require.NoError(t, err)

	for _, tc := range []struct {
		name   string
		reply  replyBody
		wantId string
	}{
		{
			name:   "reply longer than the caller reads",
			reply:  replyBody{prefix: reply, padLen: paddingBeyondRead},
			wantId: "api.remote_cluster.accept_invitation.invalid_response.app_error",
		},
		{
			name:   "error status with a reply longer than the caller reads",
			reply:  replyBody{prefix: refusal, padLen: paddingBeyondRead, status: http.StatusBadGateway},
			wantId: "api.remote_cluster.accept_invitation.invalid_response.app_error",
		},
		{
			name:   "reply cut off partway",
			reply:  replyBody{prefix: reply, declaredLength: len(reply) + 1024},
			wantId: "api.remote_cluster.accept_invitation.unreachable.app_error",
		},
		{
			name:   "error status with a reply cut off partway",
			reply:  replyBody{prefix: refusal, status: http.StatusBadGateway, declaredLength: len(refusal) + 1024},
			wantId: "api.remote_cluster.accept_invitation.unreachable.app_error",
		},
		{
			name:   "error status with a complete refusal",
			reply:  replyBody{prefix: refusal, status: http.StatusUnauthorized},
			wantId: "api.remote_cluster.accept_invitation.rejected.app_error",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rs.setReply(tc.reply)
			defer rs.awaitIdle(t)

			resp, err := service.sendFrameToRemote(defaultCallTimeout, rc, frame, url)
			require.Error(t, err)

			appErr := service.confirmInviteSendError(rc.RemoteId, url, resp, err)
			require.NotNil(t, appErr)
			assert.Equal(t, tc.wantId, appErr.Id)
		})
	}
}

// TestService_sendFrameToRemote_Metrics covers which counter a send is recorded under, which
// depends on the whole reply having been read rather than only on its status.
func TestService_sendFrameToRemote_Metrics(t *testing.T) {
	rs := newResponseServer()
	defer rs.Close()

	rc := makeRemoteCluster("remote_test_frame_metrics", rs.URL, TestTopics)

	metrics := einterfacesmocks.NewMetricsInterface(t)
	mockServer := newMockServer(t, nil)
	mockServer.metrics = metrics

	service, err := NewRemoteClusterService(mockServer, newMockApp(t, nil))
	require.NoError(t, err)
	service.disablePing = true

	require.NoError(t, service.Start())
	defer service.Shutdown()

	frame := &model.RemoteClusterFrame{
		RemoteId: rc.RemoteId,
		Msg:      makeRemoteClusterMsg(model.NewId(), NoteContent),
	}
	url := fmt.Sprintf("%s/%s", rs.URL, SendMsgURL)

	reply, err := json.Marshal(&Response{Status: ResponseStatusOK})
	require.NoError(t, err)

	for _, tc := range []struct {
		name        string
		reply       replyBody
		timeout     time.Duration
		wantSent    bool
		wantTimeout bool
	}{
		{
			name:     "complete reply",
			reply:    replyBody{prefix: reply},
			wantSent: true,
		},
		{
			name:  "reply longer than the caller reads",
			reply: replyBody{prefix: reply, padLen: paddingBeyondRead},
		},
		{
			name:  "error status",
			reply: replyBody{prefix: reply, status: http.StatusInternalServerError},
		},
		{
			name:        "reply the remote stops sending partway through",
			reply:       replyBody{prefix: reply, padLen: paddingBeyondRead, pause: time.Minute},
			timeout:     time.Millisecond * 250,
			wantTimeout: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if tc.wantSent {
				metrics.On("IncrementRemoteClusterMsgSentCounter", rc.RemoteId).Once()
			} else {
				metrics.On("IncrementRemoteClusterMsgErrorsCounter", rc.RemoteId, tc.wantTimeout).Once()
			}

			timeout := tc.timeout
			if timeout == 0 {
				timeout = defaultCallTimeout
			}

			rs.setReply(tc.reply)
			defer rs.awaitIdle(t)

			_, err := service.sendFrameToRemote(timeout, rc, frame, url)
			assert.Equal(t, tc.wantSent, err == nil)
			metrics.AssertExpectations(t)
		})
	}
}

func makeRemoteClusters(num int, siteURL string, isPlugin bool) []*model.RemoteCluster {
	var remotes []*model.RemoteCluster
	for i := range num {
		rc := makeRemoteCluster(fmt.Sprintf("test cluster %d", i+1), siteURL, TestTopics)
		if isPlugin {
			rc.PluginID = model.NewId()
		}
		remotes = append(remotes, rc)
	}
	return remotes
}

func makeRemoteCluster(name string, siteURL string, topics string) *model.RemoteCluster {
	return &model.RemoteCluster{
		RemoteId:   model.NewId(),
		Name:       name,
		SiteURL:    siteURL,
		Token:      model.NewId(),
		Topics:     topics,
		CreateAt:   model.GetMillis(),
		LastPingAt: model.GetMillis(),
		CreatorId:  model.NewId(),
	}
}

func makeRemoteClusterMsg(id string, note string) model.RemoteClusterMsg {
	payload := testPayload{Note: note}
	raw, _ := json.Marshal(payload)

	return model.RemoteClusterMsg{
		Id:       id,
		Topic:    TestTopic,
		CreateAt: model.GetMillis(),
		Payload:  raw}
}

// testReaderProvider stands in for the file store, handing out a reader over a fixed payload.
type testReaderProvider struct {
	data []byte
}

func (trp testReaderProvider) FileReader(path string) (filestore.ReadCloseSeeker, *model.AppError) {
	return testFileReader{Reader: bytes.NewReader(trp.data)}, nil
}

type testFileReader struct {
	*bytes.Reader
}

func (testFileReader) Close() error { return nil }

const (
	// How long the cases allow a call to take, unless a case shortens it.
	defaultCallTimeout = time.Second * 30

	// How much whitespace follows the complete reply in the cases that put a reply past the most a
	// caller reads of one. Whitespace is inert to a JSON decoder, so those cases turn on how much
	// of the body was read rather than on the body being malformed.
	paddingBeyondRead = 8 * 1024 * 1024

	// The size of the reply body the measured case uses, chosen to dwarf the most a caller reads.
	longReplyPadding = 128 * 1024 * 1024

	// How much of that reply body the remote may get to send before the caller stops reading. Most
	// of the allowance is headroom for what the network buffers on the caller's behalf, which is
	// several megabytes per connection and set by the host rather than by this package.
	maxServedSingle = 32 * 1024 * 1024

	// How many callers the cases that exercise concurrent sends use.
	concurrentCallers = 20

	// How long a reply the cases that read one directly offer. Any multiple of the most a caller
	// reads of a reply does, since those cases count the bytes read exactly.
	directReplyLength = MaxRemoteResponseSize * 8
)

// replyCase is one reply a remote can answer an outbound request with, and what the caller should
// make of it.
type replyCase struct {
	name     string
	reply    replyBody
	timeout  time.Duration // call timeout; zero uses defaultCallTimeout
	wantErr  bool
	errText  string // substring the error must contain, when the case is specific about it
	errIs    error  // sentinel the error must wrap, when the case is specific about it
	errIsNot error  // sentinel the error must not wrap, when the case is specific about it
}

// sharedReplyCases returns the cases shared by every call site that reads a remote's reply. prefix
// is the complete, well-formed reply such a remote returns; emptyReplyIsOK says whether the call
// site accepts a reply with no body at all.
func sharedReplyCases(prefix []byte, emptyReplyIsOK bool) []replyCase {
	// Padding that brings a reply to exactly the most a caller reads of one.
	upToRead := int64(MaxRemoteResponseSize - len(prefix))

	return []replyCase{
		{
			name:  "reply as long as the caller reads",
			reply: replyBody{prefix: prefix, padLen: upToRead},
		},
		{
			name:     "reply one byte longer than the caller reads",
			reply:    replyBody{prefix: prefix, padLen: upToRead + 1},
			wantErr:  true,
			errText:  "longer than",
			errIs:    errRemoteResponseTooLarge,
			errIsNot: errRemoteUnreachable,
		},
		{
			// The same length, sent with the remote declaring it up front rather than in chunks.
			name:     "reply one byte longer than the caller reads, with its length declared",
			reply:    replyBody{prefix: prefix, padLen: upToRead + 1, declaredLength: MaxRemoteResponseSize + 1},
			wantErr:  true,
			errText:  "longer than",
			errIs:    errRemoteResponseTooLarge,
			errIsNot: errRemoteUnreachable,
		},
		{
			name:     "reply far longer than the caller reads",
			reply:    replyBody{prefix: prefix, padLen: paddingBeyondRead},
			wantErr:  true,
			errText:  "longer than",
			errIs:    errRemoteResponseTooLarge,
			errIsNot: errRemoteUnreachable,
		},
		{
			// The transport decompresses this before the caller sees it, so what the caller reads
			// is the decompressed length rather than the handful of bytes that arrived.
			name:     "compressed reply longer than the caller reads once decompressed",
			reply:    replyBody{prefix: prefix, padLen: paddingBeyondRead, gzipped: true},
			wantErr:  true,
			errText:  "longer than",
			errIs:    errRemoteResponseTooLarge,
			errIsNot: errRemoteUnreachable,
		},
		{
			// The remote declares more than it sends and then closes the connection.
			name:     "reply cut off partway",
			reply:    replyBody{prefix: prefix, declaredLength: len(prefix) + 1024},
			wantErr:  true,
			errIs:    errRemoteUnreachable,
			errIsNot: errRemoteResponseTooLarge,
		},
		{
			// The caller reads up to the length the remote declared, so what the remote tries to
			// send past it never reaches the caller.
			name:  "reply longer than the length the remote declared",
			reply: replyBody{prefix: prefix, padLen: paddingBeyondRead, declaredLength: len(prefix)},
		},
		{
			name:     "error status with a complete reply",
			reply:    replyBody{prefix: prefix, status: http.StatusInternalServerError},
			wantErr:  true,
			errText:  "500",
			errIsNot: errRemoteUnreachable,
		},
		{
			name:     "error status with a reply far longer than the caller reads",
			reply:    replyBody{prefix: prefix, padLen: paddingBeyondRead, status: http.StatusInternalServerError},
			wantErr:  true,
			errText:  "500",
			errIs:    errRemoteResponseTooLarge,
			errIsNot: errRemoteUnreachable,
		},
		{
			name:    "error status with a reply cut off partway",
			reply:   replyBody{prefix: prefix, status: http.StatusBadGateway, declaredLength: len(prefix) + 1024},
			wantErr: true,
			errIs:   errRemoteUnreachable,
		},
		{
			name:    "empty reply",
			reply:   replyBody{},
			wantErr: !emptyReplyIsOK,
		},
	}
}

// assertReplyCases runs call against a remote answering with each case's reply, and asserts the
// caller reported what the case expects. It also asserts every call reached the remote and left it
// with nothing further to send, which requires the caller to have released each reply it stopped
// reading partway.
func assertReplyCases(t *testing.T, rs *responseServer, call func(time.Duration) error, cases []replyCase) {
	t.Helper()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			timeout := tc.timeout
			if timeout == 0 {
				timeout = defaultCallTimeout
			}

			rs.setReply(tc.reply)
			rs.takeRequestCount()

			err := call(timeout)

			require.NotZero(t, rs.takeRequestCount(), "the call should reach the remote")
			rs.awaitIdle(t)

			if !tc.wantErr {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			if tc.errText != "" {
				assert.Contains(t, err.Error(), tc.errText)
			}
			if tc.errIs != nil {
				assert.ErrorIs(t, err, tc.errIs)
			}
			if tc.errIsNot != nil {
				assert.NotErrorIs(t, err, tc.errIsNot)
			}
		})
	}
}

// assertReplyBytesServedStaysBounded runs call against a remote whose reply is far longer than a
// caller reads of one, and asserts the remote only got to send a small fraction of it before the
// caller stopped reading, which is what ties the call site to the reply lengths asserted exactly by
// TestRemoteResponseReadLength. prefix is the leading, meaningful part of the reply; the rest is
// padding.
func assertReplyBytesServedStaysBounded(t *testing.T, rs *responseServer, prefix []byte, call func(time.Duration) error) {
	t.Helper()

	t.Run("long reply", func(t *testing.T) {
		rs.setReply(replyBody{prefix: prefix, padLen: longReplyPadding})
		rs.takeRequestCount()
		rs.takeServedCount()

		// What a call returns for a given reply is asserted by the cases above; this case is
		// about how much of a reply the remote gets to send.
		_ = call(defaultCallTimeout)

		require.NotZero(t, rs.takeRequestCount(), "the call should reach the remote")
		rs.awaitIdle(t)

		served := rs.takeServedCount()
		assert.Less(t, served, int64(maxServedSingle),
			"the remote sent %.1f MiB of the %.1f MiB it offered, more than the %.1f MiB allowed",
			mib(served), mib(longReplyPadding), mib(maxServedSingle))
	})
}

// TestRemoteResponseReadLength covers how much of a remote's reply readRemoteResponse reads, for a
// single caller and for concurrent callers. Unlike the call site tests it hands the reply straight
// to it rather than over a connection, so the lengths it asserts are exact rather than an allowance.
func TestRemoteResponseReadLength(t *testing.T) {
	const maxRead = MaxRemoteResponseSize + 1

	for _, callers := range []int{1, concurrentCallers} {
		t.Run(fmt.Sprintf("%d caller(s)", callers), func(t *testing.T) {
			var read atomic.Int64
			errs := make([]error, callers)

			var wg sync.WaitGroup
			wg.Add(callers)
			for i := range callers {
				go func() {
					defer wg.Done()
					_, errs[i] = readRemoteResponse(&generatedReply{remaining: directReplyLength, read: &read})
				}()
			}
			wg.Wait()

			for _, err := range errs {
				assert.ErrorIs(t, err, errRemoteResponseTooLarge, "a reply too long to return is reported as an error")
			}

			assert.LessOrEqual(t, read.Load(), maxRead*int64(callers),
				"read %.1f MiB of the %.1f MiB offered across %d caller(s)",
				mib(read.Load()), mib(directReplyLength*int64(callers)), callers)
		})
	}
}

// generatedReply is a reply body of a fixed length that produces its content as it is read, so it
// does not allocate with that length. It adds what is read from it to read, which callers share.
type generatedReply struct {
	remaining int64
	read      *atomic.Int64
}

func (gr *generatedReply) Read(p []byte) (int, error) {
	if gr.remaining <= 0 {
		return 0, io.EOF
	}

	n := min(int64(len(p)), gr.remaining)
	for i := range p[:n] {
		p[i] = ' '
	}
	gr.remaining -= n
	gr.read.Add(n)

	return int(n), nil
}

// replyBody describes what a responseServer answers a request with: the status, then prefix
// verbatim, then padLen bytes of whitespace.
type replyBody struct {
	prefix []byte
	padLen int64

	status         int           // status to reply with; zero replies 200
	gzipped        bool          // compress the body, which the caller's transport decompresses for it
	declaredLength int           // Content-Length to declare regardless of what is sent; zero leaves it to net/http
	pause          time.Duration // how long to go quiet after the prefix, before sending the padding
}

// responseServer is a test server that answers every request with a configurable reply, streaming
// the padding in fixed-size chunks so its own allocation does not grow with the size of the body it
// returns. It records how many requests it answered, how many reply bytes it managed to send, which
// client connections the requests arrived on, and how many replies are still open.
type responseServer struct {
	*httptest.Server

	reply    atomic.Pointer[replyBody]
	requests atomic.Int64
	served   atomic.Int64
	open     atomic.Int64
	conns    sync.Map // set of client addresses requests have arrived from
}

func newResponseServer() *responseServer {
	const chunkSize = 64 * 1024
	chunk := bytes.Repeat([]byte{' '}, chunkSize)

	rs := &responseServer{}
	rs.setReply(replyBody{})
	rs.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)

		rs.requests.Add(1)
		rs.conns.Store(r.RemoteAddr, struct{}{})
		rs.open.Add(1)
		defer rs.open.Add(-1)

		reply := rs.reply.Load()

		status := reply.status
		if status == 0 {
			status = http.StatusOK
		}
		if reply.declaredLength > 0 {
			w.Header().Set("Content-Length", strconv.Itoa(reply.declaredLength))
			// Overrunning the declared length breaks the connection, so keep the caller from reusing it.
			if int64(len(reply.prefix))+reply.padLen > int64(reply.declaredLength) {
				w.Header().Set("Connection", "close")
			}
		}

		var body io.Writer = w
		if reply.gzipped {
			w.Header().Set("Content-Encoding", "gzip")
			gz := gzip.NewWriter(w)
			defer gz.Close()
			body = gz
		}
		// Counting outermost so a compressed reply is counted as the caller will read it.
		body = &countingWriter{w: body, count: &rs.served}

		w.WriteHeader(status)

		if _, err := body.Write(reply.prefix); err != nil {
			return
		}

		if reply.pause > 0 {
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}
			select {
			case <-time.After(reply.pause):
			case <-r.Context().Done():
				return
			}
		}

		for remaining := reply.padLen; remaining > 0; {
			written, err := body.Write(chunk[:min(int64(len(chunk)), remaining)])
			if err != nil {
				// the caller is no longer reading, so there is nothing left to send
				return
			}
			remaining -= int64(written)
		}
	}))
	return rs
}

// setReply sets the reply every subsequent request is answered with.
func (rs *responseServer) setReply(reply replyBody) {
	rs.reply.Store(&reply)
}

// takeRequestCount reports how many requests have been answered since it was last called.
func (rs *responseServer) takeRequestCount() int64 {
	return rs.requests.Swap(0)
}

// takeServedCount reports how many reply bytes have been sent since it was last called.
func (rs *responseServer) takeServedCount() int64 {
	return rs.served.Swap(0)
}

// takeConnectionCount reports how many distinct client connections requests have arrived on since
// it was last called.
func (rs *responseServer) takeConnectionCount() int {
	count := 0
	rs.conns.Range(func(addr, _ any) bool {
		rs.conns.Delete(addr)
		count++
		return true
	})
	return count
}

// awaitIdle waits until the server has no reply left to send, which for a reply the caller stopped
// reading partway means waiting for the caller to release it.
func (rs *responseServer) awaitIdle(t *testing.T) {
	t.Helper()

	require.Eventually(t, func() bool { return rs.open.Load() == 0 }, time.Second*10, time.Millisecond*10,
		"the remote should have nothing left to send once no caller is reading")
}

// countingWriter records how many bytes were written through it.
type countingWriter struct {
	w     io.Writer
	count *atomic.Int64
}

func (cw *countingWriter) Write(p []byte) (int, error) {
	written, err := cw.w.Write(p)
	cw.count.Add(int64(written))
	return written, err
}

func mib[T uint64 | int | int64 | float64](bytes T) float64 {
	return float64(bytes) / (1024 * 1024)
}
