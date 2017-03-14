// JWT session management
package api

import (
	b64 "encoding/base64"
	"fmt"

	l4g "github.com/alecthomas/log4go"
	"github.com/dgrijalva/jwt-go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func lookupSecret(token *jwt.Token) (interface{}, error) {
	l4g.Debug("lookupSecret %v", token)
	// kid := token.Header["kid"]
	alg := token.Header["alg"]
	aud := token.Claims.(jwt.MapClaims)["aud"].(string)
	// sub := token.Header["sub"]

	key := findKey(utils.Cfg.ServiceSettings.JwtKeys, &aud)

	if key == nil {
		return nil, fmt.Errorf("Unexpected audience: %s", aud)
	}

	l4g.Debug("Key to verify signature: %v", *key)

	// Don't forget to validate the alg is what you expect:
	if *key.SigningMethod == "HMAC" {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf(
				"Unexpected signing method: %v (%v)", alg, ok)
		}
		if key.KeyEncoding != nil && *key.KeyEncoding == "base64" {
			return b64.URLEncoding.DecodeString(*key.Key)
		} else {
			return []byte(*key.Key), nil
		}
	} else if *key.SigningMethod == "RSA" {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf(
				"Unexpected signing method: %v (%v) %v",
				alg, ok, token.Method)
		}
		rsaKey, err := jwt.ParseRSAPublicKeyFromPEM([]byte(*key.Key))
		if err != nil {
			l4g.Error("Invalid RSA key encoding: %v", *key.Key)
		}
		return rsaKey, err
	} else {
		return nil, fmt.Errorf("Unsupported signing method: %s",
			*key.SigningMethod)
	}
}

func findKey(keys *[]model.JwtKey, aud *string) *model.JwtKey {
	for _, key := range *keys {
		if *key.Audience == *aud {
			return &key
		}
	}
	return nil
}

func decode(tokenString string) (*jwt.MapClaims, error) {
	// Parse takes the token string and a function for looking up
	// the key. The latter is especially useful if you use
	// multiple keys for your application.  The standard is to use
	// 'kid' in the head of the token to identify which key to
	// use, but the parsed token (head and claims) is provided to
	// the callback, providing flexibility.
	token, err := jwt.Parse(tokenString, lookupSecret)
	if token == nil || err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return &claims, nil
	} else {
		return nil, err
	}
}

func jwtTokenDecode(token string) (*jwt.MapClaims, error) {
	l4g.Debug("decode %s", token)
	if claims, err := decode(token); err != nil {
		l4g.Error("error %s", err)
		return nil, fmt.Errorf("Invalid JWT token")
	} else {
		return claims, err
	}
}

func newSessionForJwtToken(token string, claims *jwt.MapClaims) (*model.Session, error) {
	sub := (*claims)["sub"].(string)
	if user, err := userForSub(&sub); err != nil {
		return nil, err
	} else {
		l4g.Debug("JWT User Id: %v, roles: %v", user.Id, user.Roles)
		session := &model.Session{
			UserId: user.Id,
			Roles:  user.Roles,
			Token:  token,
		}
		session.SetExpireInDays(
			// TODO: use expiry from token
			*utils.Cfg.ServiceSettings.SessionLengthSSOInDays,
		)
		aud := (*claims)["aud"].(string)
		session.AddProp(model.SESSION_PROP_PLATFORM, aud)
		session.AddProp(model.SESSION_PROP_OS, "JWT")
		session.AddProp(model.SESSION_PROP_BROWSER, "JWT")
		session.AddProp(model.SESSION_PROP_AUTHSERVICE, "JWT")
		return session, nil
	}
}

func userForSub(sub *string) (*model.User, error) {
	if res := <-Srv.Store.User().GetByAuth(sub, ""); res.Err != nil {
		l4g.Debug("Error getting user for token: %v", res.Err)
		return nil, res.Err
	} else {
		return res.Data.(*model.User), nil
	}
}
