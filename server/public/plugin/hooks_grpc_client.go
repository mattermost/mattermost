// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"

	saml2 "github.com/mattermost/gosaml2"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/mattermost/mattermost/server/public/model"
	pb "github.com/mattermost/mattermost/server/public/pluginapi/grpc/generated/go/pluginapiv1"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	// defaultGRPCTimeout is the default timeout for gRPC hook calls.
	defaultGRPCTimeout = 30 * time.Second

	// serveHTTPChunkSize is the chunk size for ServeHTTP streaming (64KB).
	serveHTTPChunkSize = 64 * 1024
)

// init registers hook names that are not in client_rpc_generated.go
// These hooks are handled specially (not auto-generated) but Python plugins
// still need them in the hookNameToId map for the Implemented() mechanism.
func init() {
	hookNameToId["OnActivate"] = OnActivateID
	hookNameToId["ServeHTTP"] = ServeHTTPID
	hookNameToId["MessageWillBePosted"] = MessageWillBePostedID
	hookNameToId["MessageWillBeUpdated"] = MessageWillBeUpdatedID
	hookNameToId["ServeMetrics"] = ServeMetricsID
}

// hooksGRPCClient implements the Hooks interface by delegating to a gRPC PluginHooksClient.
// This enables Python plugins to receive hook invocations through the same infrastructure
// as Go plugins.
type hooksGRPCClient struct {
	client      pb.PluginHooksClient
	implemented [TotalHooksID]bool
	log         *mlog.Logger
}

// Compile-time check to ensure hooksGRPCClient implements Hooks interface.
var _ Hooks = (*hooksGRPCClient)(nil)

// newHooksGRPCClient creates a new hooksGRPCClient.
// It calls Implemented() to populate the implemented hooks array.
func newHooksGRPCClient(conn grpc.ClientConnInterface, log *mlog.Logger) (*hooksGRPCClient, error) {
	client := &hooksGRPCClient{
		client: pb.NewPluginHooksClient(conn),
		log:    log,
	}

	// Query which hooks the plugin implements
	hooks, err := client.Implemented()
	if err != nil {
		return nil, fmt.Errorf("failed to query implemented hooks: %w", err)
	}

	// Populate the implemented array
	for _, hookName := range hooks {
		if hookID, ok := hookNameToId[hookName]; ok {
			client.implemented[hookID] = true
		}
	}

	return client, nil
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

// Implemented returns the list of hooks that the plugin implements.
func (h *hooksGRPCClient) Implemented() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.Implemented(ctx, &pb.ImplementedRequest{})
	if err != nil {
		return nil, fmt.Errorf("gRPC Implemented call failed: %w", err)
	}

	if resp.GetError() != nil {
		return nil, appErrorFromProto(resp.GetError())
	}

	return resp.GetHooks(), nil
}

// OnActivate is invoked when the plugin is activated.
func (h *hooksGRPCClient) OnActivate() error {
	if !h.implemented[OnActivateID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnActivate(ctx, &pb.OnActivateRequest{})
	if err != nil {
		h.log.Error("gRPC OnActivate call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnActivate call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// OnDeactivate is invoked when the plugin is deactivated.
func (h *hooksGRPCClient) OnDeactivate() error {
	if !h.implemented[OnDeactivateID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnDeactivate(ctx, &pb.OnDeactivateRequest{})
	if err != nil {
		h.log.Error("gRPC OnDeactivate call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnDeactivate call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// OnConfigurationChange is invoked when configuration changes may have been made.
func (h *hooksGRPCClient) OnConfigurationChange() error {
	if !h.implemented[OnConfigurationChangeID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnConfigurationChange(ctx, &pb.OnConfigurationChangeRequest{})
	if err != nil {
		h.log.Error("gRPC OnConfigurationChange call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnConfigurationChange call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// =============================================================================
// ServeHTTP with Bidirectional Streaming
// =============================================================================

// ServeHTTP handles HTTP requests using bidirectional streaming.
func (h *hooksGRPCClient) ServeHTTP(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.implemented[ServeHTTPID] {
		http.NotFound(w, r)
		return
	}

	// Use request context for cancellation propagation
	ctx := r.Context()

	// Start bidirectional stream
	stream, err := h.client.ServeHTTP(ctx)
	if err != nil {
		h.log.Error("gRPC ServeHTTP stream failed to open", mlog.Err(err))
		http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
		return
	}

	// Cancel context for sender goroutine when we're done
	cancelCtx, cancelSend := context.WithCancel(ctx)
	defer cancelSend()

	// Channel for send errors
	sendErrCh := make(chan error, 1)

	// WaitGroup to ensure send goroutine finishes
	var wg sync.WaitGroup
	wg.Add(1)

	// Send request in a goroutine
	go func() {
		defer wg.Done()
		sendErrCh <- h.sendHTTPRequest(cancelCtx, stream, c, r)
	}()

	// Receive and process response
	if err := h.receiveHTTPResponse(stream, w); err != nil {
		cancelSend()
		wg.Wait()
		// Error already logged in receiveHTTPResponse
		return
	}

	// Wait for sender to finish
	wg.Wait()

	// Check for send errors (non-blocking)
	select {
	case sendErr := <-sendErrCh:
		if sendErr != nil && sendErr != context.Canceled {
			h.log.Error("gRPC ServeHTTP send error", mlog.Err(sendErr))
		}
	default:
	}
}

// sendHTTPRequest sends the HTTP request to the plugin as a stream.
func (h *hooksGRPCClient) sendHTTPRequest(ctx context.Context, stream pb.PluginHooks_ServeHTTPClient, c *Context, r *http.Request) error {
	defer stream.CloseSend()

	// Build request init
	init := h.buildServeHTTPRequestInit(c, r)

	// Handle nil body
	if r.Body == nil {
		return stream.Send(&pb.ServeHTTPRequest{
			Init:         init,
			BodyComplete: true,
		})
	}
	defer r.Body.Close()

	// Read body in chunks
	buf := make([]byte, serveHTTPChunkSize)
	firstMessage := true

	for {
		// Check for cancellation
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, err := r.Body.Read(buf)
		isEOF := err == io.EOF

		if firstMessage {
			msg := &pb.ServeHTTPRequest{
				Init:         init,
				BodyComplete: isEOF,
			}
			if n > 0 {
				msg.BodyChunk = buf[:n]
			}
			if sendErr := stream.Send(msg); sendErr != nil {
				return sendErr
			}
			firstMessage = false
		} else if n > 0 || isEOF {
			msg := &pb.ServeHTTPRequest{
				BodyComplete: isEOF,
			}
			if n > 0 {
				msg.BodyChunk = buf[:n]
			}
			if sendErr := stream.Send(msg); sendErr != nil {
				return sendErr
			}
		}

		if isEOF {
			break
		}
		if err != nil {
			return err
		}
	}

	return nil
}

// buildServeHTTPRequestInit creates the init message for ServeHTTP.
func (h *hooksGRPCClient) buildServeHTTPRequestInit(c *Context, r *http.Request) *pb.ServeHTTPRequestInit {
	init := &pb.ServeHTTPRequestInit{
		Method:        r.Method,
		Url:           r.URL.String(),
		Proto:         r.Proto,
		ProtoMajor:    int32(r.ProtoMajor),
		ProtoMinor:    int32(r.ProtoMinor),
		Host:          r.Host,
		RemoteAddr:    r.RemoteAddr,
		RequestUri:    r.RequestURI,
		ContentLength: r.ContentLength,
		Headers:       convertHTTPHeadersToProto(r.Header),
	}

	if c != nil {
		init.PluginContext = &pb.PluginContext{
			SessionId:      c.SessionId,
			RequestId:      c.RequestId,
			IpAddress:      c.IPAddress,
			AcceptLanguage: c.AcceptLanguage,
			UserAgent:      c.UserAgent,
		}
	}

	return init
}

// convertHTTPHeadersToProto converts http.Header to proto HTTPHeader messages.
func convertHTTPHeadersToProto(h http.Header) []*pb.HTTPHeader {
	headers := make([]*pb.HTTPHeader, 0, len(h))
	for key, values := range h {
		headers = append(headers, &pb.HTTPHeader{
			Key:    key,
			Values: values,
		})
	}
	return headers
}

// receiveHTTPResponse receives and processes the HTTP response from the stream.
func (h *hooksGRPCClient) receiveHTTPResponse(stream pb.PluginHooks_ServeHTTPClient, w http.ResponseWriter) error {
	// Receive first response with headers
	firstResp, err := stream.Recv()
	if err != nil {
		h.log.Error("gRPC ServeHTTP failed to receive response", mlog.Err(err))
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
		return err
	}

	// Write response headers
	if err := h.writeHTTPResponseHeaders(w, firstResp.GetInit()); err != nil {
		return err
	}

	// Write first body chunk if present
	if len(firstResp.GetBodyChunk()) > 0 {
		if _, err := w.Write(firstResp.GetBodyChunk()); err != nil {
			return err
		}
	}

	// Handle flush on first message
	if firstResp.GetFlush() {
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
	}

	// Check if response is complete
	if firstResp.GetBodyComplete() {
		return nil
	}

	// Stream remaining response body
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			h.log.Error("gRPC ServeHTTP failed to receive response chunk", mlog.Err(err))
			return err
		}

		if len(resp.GetBodyChunk()) > 0 {
			if _, err := w.Write(resp.GetBodyChunk()); err != nil {
				return err
			}
		}

		if resp.GetFlush() {
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}
		}

		if resp.GetBodyComplete() {
			return nil
		}
	}
}

// writeHTTPResponseHeaders writes the HTTP response headers.
func (h *hooksGRPCClient) writeHTTPResponseHeaders(w http.ResponseWriter, init *pb.ServeHTTPResponseInit) error {
	if init == nil {
		w.WriteHeader(http.StatusOK)
		return nil
	}

	statusCode := int(init.GetStatusCode())
	if statusCode == 0 {
		statusCode = http.StatusOK
	}

	// Validate status code (prevent panic from invalid codes)
	if statusCode < 100 || statusCode > 999 {
		h.log.Error(fmt.Sprintf("Plugin tried to write invalid HTTP status code: %d", statusCode))
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return fmt.Errorf("invalid status code: %d", statusCode)
	}

	// Copy headers
	for _, header := range init.GetHeaders() {
		for _, v := range header.GetValues() {
			w.Header().Add(header.GetKey(), v)
		}
	}

	w.WriteHeader(statusCode)
	return nil
}

// =============================================================================
// Message Hooks
// =============================================================================

// MessageWillBePosted is invoked when a message is posted before it is committed.
func (h *hooksGRPCClient) MessageWillBePosted(c *Context, post *model.Post) (*model.Post, string) {
	if !h.implemented[MessageWillBePostedID] {
		return post, ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.MessageWillBePosted(ctx, &pb.MessageWillBePostedRequest{
		PluginContext: pluginContextToProto(c),
		Post:          postToProto(post),
	})
	if err != nil {
		h.log.Error("gRPC MessageWillBePosted call failed", mlog.Err(err))
		return post, ""
	}

	if resp.GetRejectionReason() != "" {
		return nil, resp.GetRejectionReason()
	}

	if resp.GetModifiedPost() != nil {
		return postFromProto(resp.GetModifiedPost()), ""
	}

	return post, ""
}

// MessageWillBeUpdated is invoked when a message is updated before it is committed.
func (h *hooksGRPCClient) MessageWillBeUpdated(c *Context, newPost, oldPost *model.Post) (*model.Post, string) {
	if !h.implemented[MessageWillBeUpdatedID] {
		return newPost, ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.MessageWillBeUpdated(ctx, &pb.MessageWillBeUpdatedRequest{
		PluginContext: pluginContextToProto(c),
		NewPost:       postToProto(newPost),
		OldPost:       postToProto(oldPost),
	})
	if err != nil {
		h.log.Error("gRPC MessageWillBeUpdated call failed", mlog.Err(err))
		return newPost, ""
	}

	if resp.GetRejectionReason() != "" {
		return nil, resp.GetRejectionReason()
	}

	if resp.GetModifiedPost() != nil {
		return postFromProto(resp.GetModifiedPost()), ""
	}

	return newPost, ""
}

// MessageHasBeenPosted is invoked after the message has been committed.
func (h *hooksGRPCClient) MessageHasBeenPosted(c *Context, post *model.Post) {
	if !h.implemented[MessageHasBeenPostedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.MessageHasBeenPosted(ctx, &pb.MessageHasBeenPostedRequest{
		PluginContext: pluginContextToProto(c),
		Post:          postToProto(post),
	})
	if err != nil {
		h.log.Error("gRPC MessageHasBeenPosted call failed", mlog.Err(err))
	}
}

// MessageHasBeenUpdated is invoked after a message update has been committed.
func (h *hooksGRPCClient) MessageHasBeenUpdated(c *Context, newPost, oldPost *model.Post) {
	if !h.implemented[MessageHasBeenUpdatedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.MessageHasBeenUpdated(ctx, &pb.MessageHasBeenUpdatedRequest{
		PluginContext: pluginContextToProto(c),
		NewPost:       postToProto(newPost),
		OldPost:       postToProto(oldPost),
	})
	if err != nil {
		h.log.Error("gRPC MessageHasBeenUpdated call failed", mlog.Err(err))
	}
}

// MessagesWillBeConsumed is invoked when messages are requested by a client.
func (h *hooksGRPCClient) MessagesWillBeConsumed(posts []*model.Post) []*model.Post {
	if !h.implemented[MessagesWillBeConsumedID] {
		return posts
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	pbPosts := make([]*pb.Post, len(posts))
	for i, p := range posts {
		pbPosts[i] = postToProto(p)
	}

	resp, err := h.client.MessagesWillBeConsumed(ctx, &pb.MessagesWillBeConsumedRequest{
		Posts: pbPosts,
	})
	if err != nil {
		h.log.Error("gRPC MessagesWillBeConsumed call failed", mlog.Err(err))
		return posts
	}

	if resp.GetPosts() != nil {
		result := make([]*model.Post, len(resp.GetPosts()))
		for i, p := range resp.GetPosts() {
			result[i] = postFromProto(p)
		}
		return result
	}

	return posts
}

// MessageHasBeenDeleted is invoked after a message has been deleted.
func (h *hooksGRPCClient) MessageHasBeenDeleted(c *Context, post *model.Post) {
	if !h.implemented[MessageHasBeenDeletedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.MessageHasBeenDeleted(ctx, &pb.MessageHasBeenDeletedRequest{
		PluginContext: pluginContextToProto(c),
		Post:          postToProto(post),
	})
	if err != nil {
		h.log.Error("gRPC MessageHasBeenDeleted call failed", mlog.Err(err))
	}
}

// =============================================================================
// User Hooks
// =============================================================================

// UserHasBeenCreated is invoked after a user was created.
func (h *hooksGRPCClient) UserHasBeenCreated(c *Context, user *model.User) {
	if !h.implemented[UserHasBeenCreatedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasBeenCreated(ctx, &pb.UserHasBeenCreatedRequest{
		PluginContext: pluginContextToProto(c),
		User:          userToProto(user),
	})
	if err != nil {
		h.log.Error("gRPC UserHasBeenCreated call failed", mlog.Err(err))
	}
}

// UserWillLogIn is invoked before the login of the user is returned.
func (h *hooksGRPCClient) UserWillLogIn(c *Context, user *model.User) string {
	if !h.implemented[UserWillLogInID] {
		return ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.UserWillLogIn(ctx, &pb.UserWillLogInRequest{
		PluginContext: pluginContextToProto(c),
		User:          userToProto(user),
	})
	if err != nil {
		h.log.Error("gRPC UserWillLogIn call failed", mlog.Err(err))
		return ""
	}

	return resp.GetRejectionReason()
}

// UserHasLoggedIn is invoked after a user has logged in.
func (h *hooksGRPCClient) UserHasLoggedIn(c *Context, user *model.User) {
	if !h.implemented[UserHasLoggedInID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasLoggedIn(ctx, &pb.UserHasLoggedInRequest{
		PluginContext: pluginContextToProto(c),
		User:          userToProto(user),
	})
	if err != nil {
		h.log.Error("gRPC UserHasLoggedIn call failed", mlog.Err(err))
	}
}

// UserHasBeenDeactivated is invoked when a user is deactivated.
func (h *hooksGRPCClient) UserHasBeenDeactivated(c *Context, user *model.User) {
	if !h.implemented[UserHasBeenDeactivatedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasBeenDeactivated(ctx, &pb.UserHasBeenDeactivatedRequest{
		PluginContext: pluginContextToProto(c),
		User:          userToProto(user),
	})
	if err != nil {
		h.log.Error("gRPC UserHasBeenDeactivated call failed", mlog.Err(err))
	}
}

// =============================================================================
// Channel/Team Hooks
// =============================================================================

// ChannelHasBeenCreated is invoked after a channel has been created.
func (h *hooksGRPCClient) ChannelHasBeenCreated(c *Context, channel *model.Channel) {
	if !h.implemented[ChannelHasBeenCreatedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.ChannelHasBeenCreated(ctx, &pb.ChannelHasBeenCreatedRequest{
		PluginContext: pluginContextToProto(c),
		Channel:       channelToProto(channel),
	})
	if err != nil {
		h.log.Error("gRPC ChannelHasBeenCreated call failed", mlog.Err(err))
	}
}

// UserHasJoinedChannel is invoked after a user has joined a channel.
func (h *hooksGRPCClient) UserHasJoinedChannel(c *Context, channelMember *model.ChannelMember, actor *model.User) {
	if !h.implemented[UserHasJoinedChannelID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasJoinedChannel(ctx, &pb.UserHasJoinedChannelRequest{
		PluginContext: pluginContextToProto(c),
		ChannelMember: channelMemberToProto(channelMember),
		Actor:         userToProto(actor),
	})
	if err != nil {
		h.log.Error("gRPC UserHasJoinedChannel call failed", mlog.Err(err))
	}
}

// UserHasLeftChannel is invoked after a user has left a channel.
func (h *hooksGRPCClient) UserHasLeftChannel(c *Context, channelMember *model.ChannelMember, actor *model.User) {
	if !h.implemented[UserHasLeftChannelID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasLeftChannel(ctx, &pb.UserHasLeftChannelRequest{
		PluginContext: pluginContextToProto(c),
		ChannelMember: channelMemberToProto(channelMember),
		Actor:         userToProto(actor),
	})
	if err != nil {
		h.log.Error("gRPC UserHasLeftChannel call failed", mlog.Err(err))
	}
}

// UserHasJoinedTeam is invoked after a user has joined a team.
func (h *hooksGRPCClient) UserHasJoinedTeam(c *Context, teamMember *model.TeamMember, actor *model.User) {
	if !h.implemented[UserHasJoinedTeamID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasJoinedTeam(ctx, &pb.UserHasJoinedTeamRequest{
		PluginContext: pluginContextToProto(c),
		TeamMember:    teamMemberToProto(teamMember),
		Actor:         userToProto(actor),
	})
	if err != nil {
		h.log.Error("gRPC UserHasJoinedTeam call failed", mlog.Err(err))
	}
}

// UserHasLeftTeam is invoked after a user has left a team.
func (h *hooksGRPCClient) UserHasLeftTeam(c *Context, teamMember *model.TeamMember, actor *model.User) {
	if !h.implemented[UserHasLeftTeamID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.UserHasLeftTeam(ctx, &pb.UserHasLeftTeamRequest{
		PluginContext: pluginContextToProto(c),
		TeamMember:    teamMemberToProto(teamMember),
		Actor:         userToProto(actor),
	})
	if err != nil {
		h.log.Error("gRPC UserHasLeftTeam call failed", mlog.Err(err))
	}
}

// =============================================================================
// Command/WebSocket Hooks
// =============================================================================

// ExecuteCommand executes a registered slash command.
func (h *hooksGRPCClient) ExecuteCommand(c *Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	if !h.implemented[ExecuteCommandID] {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.ExecuteCommand(ctx, &pb.ExecuteCommandRequest{
		PluginContext: pluginContextToProto(c),
		Args:          commandArgsToProto(args),
	})
	if err != nil {
		h.log.Error("gRPC ExecuteCommand call failed", mlog.Err(err))
		return nil, model.NewAppError("ExecuteCommand", "plugin.grpc.execute_command.error", nil, err.Error(), http.StatusInternalServerError)
	}

	if resp.GetError() != nil {
		return nil, appErrorFromProto(resp.GetError())
	}

	return commandResponseFromProto(resp.GetResponse()), nil
}

// OnWebSocketConnect is invoked when a new WebSocket connection is opened.
func (h *hooksGRPCClient) OnWebSocketConnect(webConnID, userID string) {
	if !h.implemented[OnWebSocketConnectID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.OnWebSocketConnect(ctx, &pb.OnWebSocketConnectRequest{
		WebConnId: webConnID,
		UserId:    userID,
	})
	if err != nil {
		h.log.Error("gRPC OnWebSocketConnect call failed", mlog.Err(err))
	}
}

// OnWebSocketDisconnect is invoked when a WebSocket connection is closed.
func (h *hooksGRPCClient) OnWebSocketDisconnect(webConnID, userID string) {
	if !h.implemented[OnWebSocketDisconnectID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.OnWebSocketDisconnect(ctx, &pb.OnWebSocketDisconnectRequest{
		WebConnId: webConnID,
		UserId:    userID,
	})
	if err != nil {
		h.log.Error("gRPC OnWebSocketDisconnect call failed", mlog.Err(err))
	}
}

// WebSocketMessageHasBeenPosted is invoked when a WebSocket message is received.
func (h *hooksGRPCClient) WebSocketMessageHasBeenPosted(webConnID, userID string, req *model.WebSocketRequest) {
	if !h.implemented[WebSocketMessageHasBeenPostedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.WebSocketMessageHasBeenPosted(ctx, &pb.WebSocketMessageHasBeenPostedRequest{
		WebConnId: webConnID,
		UserId:    userID,
		Request:   webSocketRequestToProto(req),
	})
	if err != nil {
		h.log.Error("gRPC WebSocketMessageHasBeenPosted call failed", mlog.Err(err))
	}
}

// =============================================================================
// Remaining Hooks
// =============================================================================

// FileWillBeUploaded is invoked when a file is uploaded before it is committed.
func (h *hooksGRPCClient) FileWillBeUploaded(c *Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
	if !h.implemented[FileWillBeUploadedID] {
		return info, ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	// Read file content (for now, read entire file - streaming to be added later)
	fileContent, err := io.ReadAll(file)
	if err != nil {
		h.log.Error("Failed to read file for FileWillBeUploaded", mlog.Err(err))
		return info, ""
	}

	resp, err := h.client.FileWillBeUploaded(ctx, &pb.FileWillBeUploadedRequest{
		PluginContext: pluginContextToProto(c),
		FileInfo:      fileInfoToProto(info),
		FileContent:   fileContent,
	})
	if err != nil {
		h.log.Error("gRPC FileWillBeUploaded call failed", mlog.Err(err))
		return info, ""
	}

	if resp.GetRejectionReason() != "" {
		return nil, resp.GetRejectionReason()
	}

	// Write modified content to output
	if len(resp.GetModifiedContent()) > 0 {
		if _, err := output.Write(resp.GetModifiedContent()); err != nil {
			h.log.Error("Failed to write modified file content", mlog.Err(err))
		}
	}

	if resp.GetModifiedFileInfo() != nil {
		return fileInfoFromProto(resp.GetModifiedFileInfo()), ""
	}

	return info, ""
}

// ReactionHasBeenAdded is invoked after a reaction has been committed.
func (h *hooksGRPCClient) ReactionHasBeenAdded(c *Context, reaction *model.Reaction) {
	if !h.implemented[ReactionHasBeenAddedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.ReactionHasBeenAdded(ctx, &pb.ReactionHasBeenAddedRequest{
		PluginContext: pluginContextToProto(c),
		Reaction:      reactionToProto(reaction),
	})
	if err != nil {
		h.log.Error("gRPC ReactionHasBeenAdded call failed", mlog.Err(err))
	}
}

// ReactionHasBeenRemoved is invoked after a reaction has been removed.
func (h *hooksGRPCClient) ReactionHasBeenRemoved(c *Context, reaction *model.Reaction) {
	if !h.implemented[ReactionHasBeenRemovedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.ReactionHasBeenRemoved(ctx, &pb.ReactionHasBeenRemovedRequest{
		PluginContext: pluginContextToProto(c),
		Reaction:      reactionToProto(reaction),
	})
	if err != nil {
		h.log.Error("gRPC ReactionHasBeenRemoved call failed", mlog.Err(err))
	}
}

// OnPluginClusterEvent is invoked when an intra-cluster plugin event is received.
func (h *hooksGRPCClient) OnPluginClusterEvent(c *Context, ev model.PluginClusterEvent) {
	if !h.implemented[OnPluginClusterEventID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.OnPluginClusterEvent(ctx, &pb.OnPluginClusterEventRequest{
		PluginContext: pluginContextToProto(c),
		Event: &pb.PluginClusterEvent{
			Id:   ev.Id,
			Data: ev.Data,
		},
	})
	if err != nil {
		h.log.Error("gRPC OnPluginClusterEvent call failed", mlog.Err(err))
	}
}

// OnInstall is invoked after the installation of a plugin.
func (h *hooksGRPCClient) OnInstall(c *Context, event model.OnInstallEvent) error {
	if !h.implemented[OnInstallID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnInstall(ctx, &pb.OnInstallRequest{
		PluginContext: pluginContextToProto(c),
		Event: &pb.OnInstallEvent{
			UserId: event.UserId,
		},
	})
	if err != nil {
		h.log.Error("gRPC OnInstall call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnInstall call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// OnSendDailyTelemetry is invoked when the server sends daily telemetry data.
func (h *hooksGRPCClient) OnSendDailyTelemetry() {
	if !h.implemented[OnSendDailyTelemetryID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.OnSendDailyTelemetry(ctx, &pb.OnSendDailyTelemetryRequest{})
	if err != nil {
		h.log.Error("gRPC OnSendDailyTelemetry call failed", mlog.Err(err))
	}
}

// RunDataRetention is invoked during a DataRetentionJob.
func (h *hooksGRPCClient) RunDataRetention(nowTime, batchSize int64) (int64, error) {
	if !h.implemented[RunDataRetentionID] {
		return 0, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.RunDataRetention(ctx, &pb.RunDataRetentionRequest{
		NowTime:   nowTime,
		BatchSize: batchSize,
	})
	if err != nil {
		h.log.Error("gRPC RunDataRetention call failed", mlog.Err(err))
		return 0, fmt.Errorf("gRPC RunDataRetention call failed: %w", err)
	}

	if resp.GetError() != nil {
		return 0, appErrorFromProto(resp.GetError())
	}

	return resp.GetDeletedCount(), nil
}

// OnCloudLimitsUpdated is invoked when cloud product limits change.
func (h *hooksGRPCClient) OnCloudLimitsUpdated(limits *model.ProductLimits) {
	if !h.implemented[OnCloudLimitsUpdatedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	_, err := h.client.OnCloudLimitsUpdated(ctx, &pb.OnCloudLimitsUpdatedRequest{
		Limits: productLimitsToProto(limits),
	})
	if err != nil {
		h.log.Error("gRPC OnCloudLimitsUpdated call failed", mlog.Err(err))
	}
}

// ConfigurationWillBeSaved is invoked before saving configuration.
func (h *hooksGRPCClient) ConfigurationWillBeSaved(newCfg *model.Config) (*model.Config, error) {
	if !h.implemented[ConfigurationWillBeSavedID] {
		return newCfg, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	// Serialize config to JSON
	configJSON, err := json.Marshal(newCfg)
	if err != nil {
		return newCfg, fmt.Errorf("failed to marshal config: %w", err)
	}

	resp, err := h.client.ConfigurationWillBeSaved(ctx, &pb.ConfigurationWillBeSavedRequest{
		NewConfig: &pb.ConfigJson{ConfigJson: configJSON},
	})
	if err != nil {
		h.log.Error("gRPC ConfigurationWillBeSaved call failed", mlog.Err(err))
		return newCfg, fmt.Errorf("gRPC ConfigurationWillBeSaved call failed: %w", err)
	}

	if resp.GetError() != nil {
		return nil, appErrorFromProto(resp.GetError())
	}

	// Deserialize modified config if present
	if resp.GetModifiedConfig() != nil && len(resp.GetModifiedConfig().GetConfigJson()) > 0 {
		var modifiedCfg model.Config
		if err := json.Unmarshal(resp.GetModifiedConfig().GetConfigJson(), &modifiedCfg); err != nil {
			return newCfg, fmt.Errorf("failed to unmarshal modified config: %w", err)
		}
		return &modifiedCfg, nil
	}

	return newCfg, nil
}

// NotificationWillBePushed is invoked before a push notification is sent.
func (h *hooksGRPCClient) NotificationWillBePushed(pushNotification *model.PushNotification, userID string) (*model.PushNotification, string) {
	if !h.implemented[NotificationWillBePushedID] {
		return pushNotification, ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.NotificationWillBePushed(ctx, &pb.NotificationWillBePushedRequest{
		PushNotification: pushNotificationToProto(pushNotification),
		UserId:           userID,
	})
	if err != nil {
		h.log.Error("gRPC NotificationWillBePushed call failed", mlog.Err(err))
		return pushNotification, ""
	}

	if resp.GetRejectionReason() != "" {
		return nil, resp.GetRejectionReason()
	}

	if resp.GetModifiedNotification() != nil {
		return pushNotificationFromProto(resp.GetModifiedNotification()), ""
	}

	return pushNotification, ""
}

// PreferencesHaveChanged is invoked after a user's preferences have changed.
func (h *hooksGRPCClient) PreferencesHaveChanged(c *Context, preferences []model.Preference) {
	if !h.implemented[PreferencesHaveChangedID] {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	pbPrefs := make([]*pb.Preference, len(preferences))
	for i, p := range preferences {
		pbPrefs[i] = preferenceToProto(p)
	}

	_, err := h.client.PreferencesHaveChanged(ctx, &pb.PreferencesHaveChangedRequest{
		PluginContext: pluginContextToProto(c),
		Preferences:   pbPrefs,
	})
	if err != nil {
		h.log.Error("gRPC PreferencesHaveChanged call failed", mlog.Err(err))
	}
}

// OnSharedChannelsSyncMsg is invoked when a shared channels sync message is received.
func (h *hooksGRPCClient) OnSharedChannelsSyncMsg(msg *model.SyncMsg, rc *model.RemoteCluster) (model.SyncResponse, error) {
	if !h.implemented[OnSharedChannelsSyncMsgID] {
		return model.SyncResponse{}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnSharedChannelsSyncMsg(ctx, &pb.OnSharedChannelsSyncMsgRequest{
		SyncMsg:       syncMsgToProto(msg),
		RemoteCluster: remoteClusterToProto(rc),
	})
	if err != nil {
		h.log.Error("gRPC OnSharedChannelsSyncMsg call failed", mlog.Err(err))
		return model.SyncResponse{}, fmt.Errorf("gRPC OnSharedChannelsSyncMsg call failed: %w", err)
	}

	if resp.GetError() != nil {
		return model.SyncResponse{}, appErrorFromProto(resp.GetError())
	}

	return syncResponseFromProto(resp.GetResponse()), nil
}

// OnSharedChannelsPing is invoked to check the health of the shared channels plugin.
func (h *hooksGRPCClient) OnSharedChannelsPing(rc *model.RemoteCluster) bool {
	if !h.implemented[OnSharedChannelsPingID] {
		return true
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnSharedChannelsPing(ctx, &pb.OnSharedChannelsPingRequest{
		RemoteCluster: remoteClusterToProto(rc),
	})
	if err != nil {
		h.log.Error("gRPC OnSharedChannelsPing call failed", mlog.Err(err))
		return false
	}

	return resp.GetHealthy()
}

// OnSharedChannelsAttachmentSyncMsg is invoked when a file attachment sync message is received.
func (h *hooksGRPCClient) OnSharedChannelsAttachmentSyncMsg(fi *model.FileInfo, post *model.Post, rc *model.RemoteCluster) error {
	if !h.implemented[OnSharedChannelsAttachmentSyncMsgID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnSharedChannelsAttachmentSyncMsg(ctx, &pb.OnSharedChannelsAttachmentSyncMsgRequest{
		FileInfo:      fileInfoToProto(fi),
		Post:          postToProto(post),
		RemoteCluster: remoteClusterToProto(rc),
	})
	if err != nil {
		h.log.Error("gRPC OnSharedChannelsAttachmentSyncMsg call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnSharedChannelsAttachmentSyncMsg call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// OnSharedChannelsProfileImageSyncMsg is invoked when a profile image sync message is received.
func (h *hooksGRPCClient) OnSharedChannelsProfileImageSyncMsg(user *model.User, rc *model.RemoteCluster) error {
	if !h.implemented[OnSharedChannelsProfileImageSyncMsgID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.OnSharedChannelsProfileImageSyncMsg(ctx, &pb.OnSharedChannelsProfileImageSyncMsgRequest{
		User:          userToProto(user),
		RemoteCluster: remoteClusterToProto(rc),
	})
	if err != nil {
		h.log.Error("gRPC OnSharedChannelsProfileImageSyncMsg call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnSharedChannelsProfileImageSyncMsg call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// GenerateSupportData is invoked when a Support Packet is generated.
func (h *hooksGRPCClient) GenerateSupportData(c *Context) ([]*model.FileData, error) {
	if !h.implemented[GenerateSupportDataID] {
		return nil, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	resp, err := h.client.GenerateSupportData(ctx, &pb.GenerateSupportDataRequest{
		PluginContext: pluginContextToProto(c),
	})
	if err != nil {
		h.log.Error("gRPC GenerateSupportData call failed", mlog.Err(err))
		return nil, fmt.Errorf("gRPC GenerateSupportData call failed: %w", err)
	}

	if resp.GetError() != nil {
		return nil, appErrorFromProto(resp.GetError())
	}

	files := make([]*model.FileData, len(resp.GetFiles()))
	for i, f := range resp.GetFiles() {
		files[i] = &model.FileData{
			Filename: f.GetFilename(),
			Body:     f.GetData(),
		}
	}

	return files, nil
}

// OnSAMLLogin is invoked after a successful SAML login.
func (h *hooksGRPCClient) OnSAMLLogin(c *Context, user *model.User, assertion *saml2.AssertionInfo) error {
	if !h.implemented[OnSAMLLoginID] {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	// Serialize SAML assertion to JSON since it's a complex type
	var assertionJSON []byte
	if assertion != nil {
		var err error
		assertionJSON, err = json.Marshal(assertion)
		if err != nil {
			h.log.Error("Failed to marshal SAML assertion", mlog.Err(err))
		}
	}

	resp, err := h.client.OnSAMLLogin(ctx, &pb.OnSAMLLoginRequest{
		PluginContext: pluginContextToProto(c),
		User:          userToProto(user),
		Assertion:     &pb.SamlAssertionInfoJson{AssertionJson: assertionJSON},
	})
	if err != nil {
		h.log.Error("gRPC OnSAMLLogin call failed", mlog.Err(err))
		return fmt.Errorf("gRPC OnSAMLLogin call failed: %w", err)
	}

	if resp.GetError() != nil {
		return appErrorFromProto(resp.GetError())
	}

	return nil
}

// EmailNotificationWillBeSent is invoked before an email notification is sent.
func (h *hooksGRPCClient) EmailNotificationWillBeSent(emailNotification *model.EmailNotification) (*model.EmailNotificationContent, string) {
	if !h.implemented[EmailNotificationWillBeSentID] {
		return nil, ""
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultGRPCTimeout)
	defer cancel()

	// Serialize email notification to JSON since it's a complex type
	notificationJSON, err := json.Marshal(emailNotification)
	if err != nil {
		h.log.Error("Failed to marshal email notification", mlog.Err(err))
		return nil, ""
	}

	resp, err := h.client.EmailNotificationWillBeSent(ctx, &pb.EmailNotificationWillBeSentRequest{
		EmailNotification: &pb.EmailNotificationJson{NotificationJson: notificationJSON},
	})
	if err != nil {
		h.log.Error("gRPC EmailNotificationWillBeSent call failed", mlog.Err(err))
		return nil, ""
	}

	if resp.GetRejectionReason() != "" {
		return nil, resp.GetRejectionReason()
	}

	if resp.GetModifiedContent() != nil {
		return emailNotificationContentFromProto(resp.GetModifiedContent()), ""
	}

	return nil, ""
}

// ServeMetrics allows plugins to expose their own metrics endpoint.
// Note: This uses the same bidirectional streaming pattern as ServeHTTP.
// For now, we return 404 as ServeMetrics streaming is deferred to Phase 8.
func (h *hooksGRPCClient) ServeMetrics(c *Context, w http.ResponseWriter, r *http.Request) {
	if !h.implemented[ServeMetricsID] {
		http.NotFound(w, r)
		return
	}

	// ServeMetrics uses the same streaming pattern as ServeHTTP
	// For now, return 501 Not Implemented since streaming for ServeMetrics is deferred
	http.Error(w, "ServeMetrics not yet implemented for gRPC plugins", http.StatusNotImplemented)
}

// =============================================================================
// Conversion Helpers
// =============================================================================

// appErrorFromProto converts a proto AppError to model.AppError.
func appErrorFromProto(pbErr *pb.AppError) *model.AppError {
	if pbErr == nil {
		return nil
	}

	var params map[string]any
	if pbErr.Params != nil {
		params = pbErr.Params.AsMap()
	}

	return model.NewAppError(pbErr.Where, pbErr.Id, params, pbErr.DetailedError, int(pbErr.StatusCode))
}

// pluginContextToProto converts a plugin.Context to proto PluginContext.
func pluginContextToProto(c *Context) *pb.PluginContext {
	if c == nil {
		return nil
	}
	return &pb.PluginContext{
		SessionId:      c.SessionId,
		RequestId:      c.RequestId,
		IpAddress:      c.IPAddress,
		AcceptLanguage: c.AcceptLanguage,
		UserAgent:      c.UserAgent,
	}
}

// postToProto converts a model.Post to proto Post.
func postToProto(post *model.Post) *pb.Post {
	if post == nil {
		return nil
	}

	pbPost := &pb.Post{
		Id:            post.Id,
		CreateAt:      post.CreateAt,
		UpdateAt:      post.UpdateAt,
		EditAt:        post.EditAt,
		DeleteAt:      post.DeleteAt,
		IsPinned:      post.IsPinned,
		UserId:        post.UserId,
		ChannelId:     post.ChannelId,
		RootId:        post.RootId,
		OriginalId:    post.OriginalId,
		Message:       post.Message,
		MessageSource: post.MessageSource,
		Type:          post.Type,
		Hashtags:      post.Hashtags,
		FileIds:       post.FileIds,
		PendingPostId: post.PendingPostId,
		HasReactions:  post.HasReactions,
		ReplyCount:    post.ReplyCount,
		LastReplyAt:   post.LastReplyAt,
		RemoteId:      post.RemoteId,
		IsFollowing:   post.IsFollowing,
	}

	return pbPost
}

// postFromProto converts a proto Post to model.Post.
func postFromProto(pbPost *pb.Post) *model.Post {
	if pbPost == nil {
		return nil
	}

	return &model.Post{
		Id:            pbPost.Id,
		CreateAt:      pbPost.CreateAt,
		UpdateAt:      pbPost.UpdateAt,
		EditAt:        pbPost.EditAt,
		DeleteAt:      pbPost.DeleteAt,
		IsPinned:      pbPost.IsPinned,
		UserId:        pbPost.UserId,
		ChannelId:     pbPost.ChannelId,
		RootId:        pbPost.RootId,
		OriginalId:    pbPost.OriginalId,
		Message:       pbPost.Message,
		MessageSource: pbPost.MessageSource,
		Type:          pbPost.Type,
		Hashtags:      pbPost.Hashtags,
		FileIds:       pbPost.FileIds,
		PendingPostId: pbPost.PendingPostId,
		HasReactions:  pbPost.HasReactions,
		ReplyCount:    pbPost.ReplyCount,
		LastReplyAt:   pbPost.LastReplyAt,
		RemoteId:      pbPost.RemoteId,
		IsFollowing:   pbPost.IsFollowing,
	}
}

// userToProto converts a model.User to proto User.
func userToProto(u *model.User) *pb.User {
	if u == nil {
		return nil
	}

	return &pb.User{
		Id:                     u.Id,
		CreateAt:               u.CreateAt,
		UpdateAt:               u.UpdateAt,
		DeleteAt:               u.DeleteAt,
		Username:               u.Username,
		Password:               u.Password,
		AuthService:            u.AuthService,
		AuthData:               u.AuthData,
		Email:                  u.Email,
		EmailVerified:          u.EmailVerified,
		Nickname:               u.Nickname,
		FirstName:              u.FirstName,
		LastName:               u.LastName,
		Position:               u.Position,
		Roles:                  u.Roles,
		AllowMarketing:         u.AllowMarketing,
		Props:                  u.Props,
		NotifyProps:            u.NotifyProps,
		LastPasswordUpdate:     u.LastPasswordUpdate,
		LastPictureUpdate:      u.LastPictureUpdate,
		FailedAttempts:         int32(u.FailedAttempts),
		Locale:                 u.Locale,
		Timezone:               u.Timezone,
		MfaActive:              u.MfaActive,
		MfaSecret:              u.MfaSecret,
		RemoteId:               u.RemoteId,
		LastActivityAt:         u.LastActivityAt,
		IsBot:                  u.IsBot,
		BotDescription:         u.BotDescription,
		BotLastIconUpdate:      u.BotLastIconUpdate,
		TermsOfServiceId:       u.TermsOfServiceId,
		TermsOfServiceCreateAt: u.TermsOfServiceCreateAt,
		DisableWelcomeEmail:    u.DisableWelcomeEmail,
		LastLogin:              u.LastLogin,
	}
}

// channelToProto converts a model.Channel to proto Channel.
func channelToProto(c *model.Channel) *pb.Channel {
	if c == nil {
		return nil
	}

	return &pb.Channel{
		Id:                c.Id,
		CreateAt:          c.CreateAt,
		UpdateAt:          c.UpdateAt,
		DeleteAt:          c.DeleteAt,
		TeamId:            c.TeamId,
		DisplayName:       c.DisplayName,
		Name:              c.Name,
		Header:            c.Header,
		Purpose:           c.Purpose,
		LastPostAt:        c.LastPostAt,
		TotalMsgCount:     c.TotalMsgCount,
		ExtraUpdateAt:     c.ExtraUpdateAt,
		CreatorId:         c.CreatorId,
		SchemeId:          c.SchemeId,
		GroupConstrained:  c.GroupConstrained,
		Shared:            c.Shared,
		TotalMsgCountRoot: c.TotalMsgCountRoot,
		PolicyId:          c.PolicyID,
		LastRootPostAt:    c.LastRootPostAt,
	}
}

// channelMemberToProto converts a model.ChannelMember to proto ChannelMember.
func channelMemberToProto(cm *model.ChannelMember) *pb.ChannelMember {
	if cm == nil {
		return nil
	}

	return &pb.ChannelMember{
		ChannelId:          cm.ChannelId,
		UserId:             cm.UserId,
		Roles:              cm.Roles,
		LastViewedAt:       cm.LastViewedAt,
		MsgCount:           cm.MsgCount,
		MentionCount:       cm.MentionCount,
		MentionCountRoot:   cm.MentionCountRoot,
		MsgCountRoot:       cm.MsgCountRoot,
		NotifyProps:        cm.NotifyProps,
		LastUpdateAt:       cm.LastUpdateAt,
		SchemeGuest:        cm.SchemeGuest,
		SchemeUser:         cm.SchemeUser,
		SchemeAdmin:        cm.SchemeAdmin,
		UrgentMentionCount: cm.UrgentMentionCount,
	}
}

// teamMemberToProto converts a model.TeamMember to proto TeamMember.
func teamMemberToProto(tm *model.TeamMember) *pb.TeamMember {
	if tm == nil {
		return nil
	}

	return &pb.TeamMember{
		TeamId:      tm.TeamId,
		UserId:      tm.UserId,
		Roles:       tm.Roles,
		DeleteAt:    tm.DeleteAt,
		SchemeGuest: tm.SchemeGuest,
		SchemeUser:  tm.SchemeUser,
		SchemeAdmin: tm.SchemeAdmin,
		CreateAt:    tm.CreateAt,
	}
}

// commandArgsToProto converts a model.CommandArgs to proto CommandArgs.
func commandArgsToProto(args *model.CommandArgs) *pb.CommandArgs {
	if args == nil {
		return nil
	}

	return &pb.CommandArgs{
		UserId:    args.UserId,
		ChannelId: args.ChannelId,
		TeamId:    args.TeamId,
		RootId:    args.RootId,
		ParentId:  args.ParentId,
		TriggerId: args.TriggerId,
		Command:   args.Command,
		SiteUrl:   args.SiteURL,
	}
}

// commandResponseFromProto converts a proto CommandResponse to model.CommandResponse.
func commandResponseFromProto(resp *pb.CommandResponse) *model.CommandResponse {
	if resp == nil {
		return nil
	}

	result := &model.CommandResponse{
		ResponseType:     resp.ResponseType,
		Text:             resp.Text,
		Username:         resp.Username,
		ChannelId:        resp.ChannelId,
		IconURL:          resp.IconUrl,
		GotoLocation:     resp.GotoLocation,
		TriggerId:        resp.TriggerId,
		SkipSlackParsing: resp.SkipSlackParsing,
	}

	if resp.Props != nil {
		result.Props = resp.Props.AsMap()
	}

	return result
}

// webSocketRequestToProto converts a model.WebSocketRequest to proto WebSocketRequest.
func webSocketRequestToProto(req *model.WebSocketRequest) *pb.WebSocketRequest {
	if req == nil {
		return nil
	}

	pbReq := &pb.WebSocketRequest{
		Seq:    req.Seq,
		Action: req.Action,
	}

	// Convert data to structpb.Struct
	if req.Data != nil {
		if s, err := structpb.NewStruct(req.Data); err == nil {
			pbReq.Data = s
		}
	}

	return pbReq
}

// fileInfoToProto converts a model.FileInfo to proto FileInfo.
func fileInfoToProto(fi *model.FileInfo) *pb.FileInfo {
	if fi == nil {
		return nil
	}

	pbFileInfo := &pb.FileInfo{
		Id:              fi.Id,
		CreatorId:       fi.CreatorId,
		PostId:          fi.PostId,
		ChannelId:       fi.ChannelId,
		CreateAt:        fi.CreateAt,
		UpdateAt:        fi.UpdateAt,
		DeleteAt:        fi.DeleteAt,
		Name:            fi.Name,
		Extension:       fi.Extension,
		Size:            fi.Size,
		MimeType:        fi.MimeType,
		Width:           int32(fi.Width),
		Height:          int32(fi.Height),
		HasPreviewImage: fi.HasPreviewImage,
		Archived:        fi.Archived,
	}

	// Handle optional MiniPreview
	if fi.MiniPreview != nil {
		pbFileInfo.MiniPreview = *fi.MiniPreview
	}

	// Handle optional RemoteId
	if fi.RemoteId != nil {
		pbFileInfo.RemoteId = fi.RemoteId
	}

	return pbFileInfo
}

// fileInfoFromProto converts a proto FileInfo to model.FileInfo.
func fileInfoFromProto(fi *pb.FileInfo) *model.FileInfo {
	if fi == nil {
		return nil
	}

	modelFileInfo := &model.FileInfo{
		Id:              fi.Id,
		CreatorId:       fi.CreatorId,
		PostId:          fi.PostId,
		ChannelId:       fi.ChannelId,
		CreateAt:        fi.CreateAt,
		UpdateAt:        fi.UpdateAt,
		DeleteAt:        fi.DeleteAt,
		Name:            fi.Name,
		Extension:       fi.Extension,
		Size:            fi.Size,
		MimeType:        fi.MimeType,
		Width:           int(fi.Width),
		Height:          int(fi.Height),
		HasPreviewImage: fi.HasPreviewImage,
		Archived:        fi.Archived,
	}

	// Handle optional MiniPreview
	if len(fi.MiniPreview) > 0 {
		miniPreview := fi.MiniPreview
		modelFileInfo.MiniPreview = &miniPreview
	}

	// Handle optional RemoteId
	if fi.RemoteId != nil {
		remoteId := fi.GetRemoteId()
		modelFileInfo.RemoteId = &remoteId
	}

	return modelFileInfo
}

// reactionToProto converts a model.Reaction to proto Reaction.
func reactionToProto(r *model.Reaction) *pb.Reaction {
	if r == nil {
		return nil
	}

	pbReaction := &pb.Reaction{
		UserId:    r.UserId,
		PostId:    r.PostId,
		EmojiName: r.EmojiName,
		CreateAt:  r.CreateAt,
		UpdateAt:  r.UpdateAt,
		DeleteAt:  r.DeleteAt,
		RemoteId:  r.RemoteId,
	}

	if r.ChannelId != "" {
		pbReaction.ChannelId = &r.ChannelId
	}

	return pbReaction
}

// productLimitsToProto converts a model.ProductLimits to proto ProductLimits.
func productLimitsToProto(limits *model.ProductLimits) *pb.ProductLimits {
	if limits == nil {
		return nil
	}

	pbLimits := &pb.ProductLimits{}

	if limits.Files != nil {
		pbLimits.Files = &pb.FilesLimits{}
		// Note: TotalStorage conversion would require wrapperspb handling
	}

	if limits.Messages != nil {
		pbLimits.Messages = &pb.MessagesLimits{}
		// Note: History conversion would require wrapperspb handling
	}

	if limits.Teams != nil {
		pbLimits.Teams = &pb.TeamsLimits{}
		// Note: Active conversion would require wrapperspb handling
	}

	return pbLimits
}

// pushNotificationToProto converts a model.PushNotification to proto PushNotification.
func pushNotificationToProto(pn *model.PushNotification) *pb.PushNotification {
	if pn == nil {
		return nil
	}

	return &pb.PushNotification{
		AckId:            pn.AckId,
		Platform:         pn.Platform,
		ServerId:         pn.ServerId,
		DeviceId:         pn.DeviceId,
		PostId:           pn.PostId,
		Category:         pn.Category,
		Sound:            pn.Sound,
		Message:          pn.Message,
		Badge:            fmt.Sprintf("%d", pn.Badge),
		TeamId:           pn.TeamId,
		ChannelId:        pn.ChannelId,
		RootId:           pn.RootId,
		ChannelName:      pn.ChannelName,
		Type:             pn.Type,
		SenderId:         pn.SenderId,
		SenderName:       pn.SenderName,
		OverrideUsername: pn.OverrideUsername,
		OverrideIconUrl:  pn.OverrideIconURL,
		FromWebhook:      pn.FromWebhook,
		Version:          pn.Version,
	}
}

// pushNotificationFromProto converts a proto PushNotification to model.PushNotification.
func pushNotificationFromProto(pn *pb.PushNotification) *model.PushNotification {
	if pn == nil {
		return nil
	}

	badge := 0
	if pn.Badge != "" {
		_ = json.Unmarshal([]byte(pn.Badge), &badge)
	}

	return &model.PushNotification{
		AckId:            pn.AckId,
		Platform:         pn.Platform,
		ServerId:         pn.ServerId,
		DeviceId:         pn.DeviceId,
		PostId:           pn.PostId,
		Category:         pn.Category,
		Sound:            pn.Sound,
		Message:          pn.Message,
		Badge:            badge,
		TeamId:           pn.TeamId,
		ChannelId:        pn.ChannelId,
		RootId:           pn.RootId,
		ChannelName:      pn.ChannelName,
		Type:             pn.Type,
		SenderId:         pn.SenderId,
		SenderName:       pn.SenderName,
		OverrideUsername: pn.OverrideUsername,
		OverrideIconURL:  pn.OverrideIconUrl,
		FromWebhook:      pn.FromWebhook,
		Version:          pn.Version,
	}
}

// preferenceToProto converts a model.Preference to proto Preference.
func preferenceToProto(p model.Preference) *pb.Preference {
	return &pb.Preference{
		UserId:   p.UserId,
		Category: p.Category,
		Name:     p.Name,
		Value:    p.Value,
	}
}

// syncMsgToProto converts a model.SyncMsg to proto SyncMsgJson.
func syncMsgToProto(msg *model.SyncMsg) *pb.SyncMsgJson {
	if msg == nil {
		return nil
	}

	// Serialize the complex SyncMsg to JSON
	data, err := json.Marshal(msg)
	if err != nil {
		return nil
	}

	return &pb.SyncMsgJson{
		SyncMsgJson: data,
	}
}

// remoteClusterToProto converts a model.RemoteCluster to proto RemoteCluster.
func remoteClusterToProto(rc *model.RemoteCluster) *pb.RemoteCluster {
	if rc == nil {
		return nil
	}

	return &pb.RemoteCluster{
		RemoteId:     rc.RemoteId,
		RemoteTeamId: rc.RemoteTeamId,
		Name:         rc.Name,
		DisplayName:  rc.DisplayName,
		SiteUrl:      rc.SiteURL,
		CreateAt:     rc.CreateAt,
		LastPingAt:   rc.LastPingAt,
		Token:        rc.Token,
		RemoteToken:  rc.RemoteToken,
		Topics:       rc.Topics,
		CreatorId:    rc.CreatorId,
	}
}

// syncResponseFromProto converts a proto SyncResponse to model.SyncResponse.
func syncResponseFromProto(resp *pb.SyncResponse) model.SyncResponse {
	if resp == nil {
		return model.SyncResponse{}
	}

	return model.SyncResponse{
		UsersLastUpdateAt:            resp.GetUsersLastUpdateAt(),
		UserErrors:                   resp.GetUserErrors(),
		UsersSyncd:                   resp.GetUsersSyncd(),
		PostsLastUpdateAt:            resp.GetPostsLastUpdateAt(),
		PostErrors:                   resp.GetPostErrors(),
		ReactionsLastUpdateAt:        resp.GetReactionsLastUpdateAt(),
		ReactionErrors:               resp.GetReactionErrors(),
		AcknowledgementsLastUpdateAt: resp.GetAcknowledgementsLastUpdateAt(),
		AcknowledgementErrors:        resp.GetAcknowledgementErrors(),
		StatusErrors:                 resp.GetStatusErrors(),
	}
}

// emailNotificationContentFromProto converts a proto EmailNotificationContent to model.EmailNotificationContent.
func emailNotificationContentFromProto(content *pb.EmailNotificationContent) *model.EmailNotificationContent {
	if content == nil {
		return nil
	}

	return &model.EmailNotificationContent{
		Subject:     content.Subject,
		Title:       content.Title,
		SubTitle:    content.SubTitle,
		MessageHTML: content.MessageHtml,
		MessageText: content.MessageText,
		ButtonText:  content.ButtonText,
		ButtonURL:   content.ButtonUrl,
		FooterText:  content.FooterText,
	}
}

// Ensure url package is used
var _ = url.URL{}
