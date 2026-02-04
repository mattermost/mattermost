
func (c *Client4) encryptionRoute() string {
	return "/encryption"
}

// GetEncryptionStatus returns the encryption status for the current session
func (c *Client4) GetEncryptionStatus(ctx context.Context) (*EncryptionStatus, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.encryptionRoute()+"/status", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*EncryptionStatus](r)
}

// GetMyPublicKey returns the current session's public encryption key
func (c *Client4) GetMyPublicKey(ctx context.Context) (*EncryptionPublicKey, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.encryptionRoute()+"/publickey", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*EncryptionPublicKey](r)
}

// RegisterPublicKey registers or updates the current session's public encryption key
func (c *Client4) RegisterPublicKey(ctx context.Context, publicKey string) (*EncryptionPublicKey, *Response, error) {
	req := &EncryptionPublicKeyRequest{
		PublicKey: publicKey,
	}
	r, err := c.DoAPIPostJSON(ctx, c.encryptionRoute()+"/publickey", req)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*EncryptionPublicKey](r)
}

// GetPublicKeysByUserIds returns public keys for the specified user IDs
func (c *Client4) GetPublicKeysByUserIds(ctx context.Context, userIds []string) ([]*EncryptionPublicKey, *Response, error) {
	req := &EncryptionPublicKeysRequest{
		UserIds: userIds,
	}
	r, err := c.DoAPIPostJSON(ctx, c.encryptionRoute()+"/publickeys", req)
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*EncryptionPublicKey](r)
}

// GetChannelMemberKeys returns public keys for all members of a channel
func (c *Client4) GetChannelMemberKeys(ctx context.Context, channelId string) ([]*EncryptionPublicKey, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.encryptionRoute()+"/channel/"+channelId+"/keys", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[[]*EncryptionPublicKey](r)
}

// AdminGetAllKeys returns all encryption keys with user info (admin only)
func (c *Client4) AdminGetAllKeys(ctx context.Context) (*EncryptionKeysResponse, *Response, error) {
	r, err := c.DoAPIGet(ctx, c.encryptionRoute()+"/admin/keys", "")
	if err != nil {
		return nil, BuildResponse(r), err
	}
	defer closeBody(r)
	return DecodeJSONFromResponse[*EncryptionKeysResponse](r)
}

// AdminDeleteAllKeys removes all encryption keys (admin only)
func (c *Client4) AdminDeleteAllKeys(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.encryptionRoute()+"/admin/keys")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AdminDeleteOrphanedKeys removes encryption keys for sessions that no longer exist (admin only)
func (c *Client4) AdminDeleteOrphanedKeys(ctx context.Context) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.encryptionRoute()+"/admin/keys/orphaned")
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AdminDeleteSessionKey removes a specific encryption session key (admin only)
func (c *Client4) AdminDeleteSessionKey(ctx context.Context, sessionId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.encryptionRoute()+"/admin/keys/session/"+sessionId)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}

// AdminDeleteUserKeys removes all encryption keys for a specific user (admin only)
func (c *Client4) AdminDeleteUserKeys(ctx context.Context, userId string) (*Response, error) {
	r, err := c.DoAPIDelete(ctx, c.encryptionRoute()+"/admin/keys/"+userId)
	if err != nil {
		return BuildResponse(r), err
	}
	defer closeBody(r)
	return BuildResponse(r), nil
}
