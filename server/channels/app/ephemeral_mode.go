// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"

	"github.com/mattermost/mattermost/server/public/model"
)

// WipeSignatureClaims are the verified contents of a session wipe push signature.
type WipeSignatureClaims struct {
	UserId   string
	DeviceId string
	AckId    string
}

// VerifyWipeSignature checks a signature a client took from the session wipe push it received.
// Only sendMobileWipeSignal sets the user id claim, so requiring it stops a signature lifted
// from an ordinary push notification being replayed as proof of a wipe.
func (a *App) VerifyWipeSignature(signature string) (*WipeSignatureClaims, error) {
	key := a.AsymmetricSigningKey()
	if key == nil {
		return nil, errors.New("no asymmetric signing key is available")
	}

	var claims pushJWTClaims
	if _, err := jwt.ParseWithClaims(signature, &claims, func(*jwt.Token) (any, error) {
		return &key.PublicKey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodES256.Alg()})); err != nil {
		return nil, err
	}

	if !model.IsValidId(claims.UserId) {
		return nil, errors.New("wipe signature does not carry a valid user id claim")
	}

	return &WipeSignatureClaims{
		UserId:   claims.UserId,
		DeviceId: claims.DeviceId,
		AckId:    claims.AckId,
	}, nil
}
