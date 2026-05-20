// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package parser provides a type to parse strings conformant to the PHC string format:
// https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md
package phcparser

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
)

// PHC represents a PHC string, with all its parts already parsed:
type PHC struct {
	// Id is the identifier of the hashing function.
	Id string

	// Version is an optional string containing the specific version of the
	// hashing function used.
	Version string

	// Params is a map of parameters, containing a set of all parameter names
	// with their corresponding values.
	Params map[string]string

	// Salt is the base64-encoded salt used when hashing the original password.
	Salt string

	// Hash is the base64-encoded hash generated when hashing the original
	// password with the function specified by all other parameters.
	Hash string
}

// Parser is a wrapper of a limited bufio.Reader that will parse its input into
// a [PHC].
type Parser struct {
	reader *bufio.Reader
}

// MaxRunes is the maximum number of runes allowed in a PHC string. If the
// string is longer, the remaining runes are ignored.
const MaxRunes = 256

// New builds a new [Parser], limiting the input to [MaxRunes] runes.
func New(r io.Reader) *Parser {
	return &Parser{reader: bufio.NewReader(io.LimitReader(r, MaxRunes))}
}

// Token represents a minimal unit of meaning in the parsed string.
type Token uint

const (
	// ILLEGAL is a token representing an illegal token
	ILLEGAL Token = 1 << iota

	// Separator tokens
	// EOF is a token representing the end of the input
	EOF
	// DOLLARSIGN is a token representing a '$'
	DOLLARSIGN
	// COMMA is a token representing a ','
	COMMA
	// EQUALSIGN is a token representing a '='
	EQUALSIGN

	// Literals
	// FUNCTIONID is a token representing a non-empty set of any of the following symbols:
	// [a-z0-9-]
	FUNCTIONID
	// PARAMNAME is a token representing a non-empty set of any of the following symbols:
	// [a-z0-9-]
	PARAMNAME
	// PARAMVALUE is a token representing a non-empty set of any of the following symbols:
	// [a-zA-Z0-9/+.-]
	PARAMVALUE
	// B64ENCODED is a token representing a non-empty set of any of the following symbols:
	// [A-Za-z0-9+/]
	B64ENCODED
)

const (
	// IDENT is a generic identifier that represents any of its possibilities:
	// either a FUNCTIONID, a PARAMNAME, a PARAMVALUE or a B64ENCODED
	IDENT Token = FUNCTIONID | PARAMNAME | PARAMVALUE | B64ENCODED
)

// eof is a constant literal representing EOF
const eof = rune(0)

// [a-z]
func isLowercaseLetter(ch rune) bool {
	return (ch >= 'a' && ch <= 'z')
}

// [A-Za-z]
func isLetter(ch rune) bool {
	return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')
}

// [0-9]
func isDigit(ch rune) bool {
	return (ch >= '0' && ch <= '9')
}

// [A-Za-z0-9+/]
func isB64(ch rune) bool {
	return isLetter(ch) || isDigit(ch) || ch == '+' || ch == '/'
}

// [/+.-]
func isSymbol(ch rune) bool {
	return ch == '/' || ch == '+' || ch == '.' || ch == '-'
}

// [a-z0-9-]
func isLowercaseLetterOrDigitOrMinus(ch rune) bool {
	return isLowercaseLetter(ch) || isDigit(ch) || ch == '-'
}

// [a-zA-Z0-9/+.-]
func isLetterOrDigitOrSymbol(ch rune) bool {
	return isLetter(ch) || isDigit(ch) || isSymbol(ch)
}

// no identifiers allowed
func none(ch rune) bool {
	return false
}

// read reads a single rune, returning [eof] in case of any error.
func (p *Parser) read() rune {
	ch, _, err := p.reader.ReadRune()
	if err != nil {
		return eof
	}
	return ch
}

// unread unreads a single rune
func (p *Parser) unread() { _ = p.reader.UnreadRune() }

// scan scans either an identifier whose runes are allowed by the provided
// function, or a single separator token: EOF $ , =
func (p *Parser) scan(isIdentAllowedRune func(rune) bool) (tok Token, lit string) {
	ch := p.read()

	if isIdentAllowedRune(ch) {
		p.unread()
		return p.scanIdent(isIdentAllowedRune)
	}

	switch ch {
	case eof:
		return EOF, ""
	case '$':
		return DOLLARSIGN, string(ch)
	case ',':
		return COMMA, string(ch)
	case '=':
		return EQUALSIGN, string(ch)
	}

	return ILLEGAL, string(ch)
}

// scanIdent scans a series of contiguous runes allowed by the provided function
// that form a single identifier.
func (p *Parser) scanIdent(isIdentAllowedRune func(rune) bool) (tok Token, lit string) {
	var buf bytes.Buffer
	buf.WriteRune(p.read())

	for {
		ch := p.read()
		if ch == eof {
			break
		}

		if !isIdentAllowedRune(ch) {
			p.unread()
			break
		}

		_, _ = buf.WriteRune(ch)
	}

	// On success, return the generic IDENT, the check for each specific
	// identifier is already done with isIdentAllowedRune
	return IDENT, buf.String()
}

// scanSeparator scans one of the separator tokens:
// - EOF
// - $
// - ,
// - =
func (p *Parser) scanSeparator() (tok Token, lit string) {
	return p.scan(none)
}

// parseToken returns the literal string of an expected token, or an error.
// expected can be an ORed expression of different tokens, like
//
//	EOF | DOLLARSIGN | FUNCTIONID
//
// In this case, any of those tokens are allowd, and its literal will be returned.
func (p *Parser) parseToken(expected Token) (string, error) {
	var allowedRuneFunc func(rune) bool
	switch expected {
	case FUNCTIONID, PARAMNAME:
		allowedRuneFunc = isLowercaseLetterOrDigitOrMinus
	case PARAMVALUE:
		allowedRuneFunc = isLetterOrDigitOrSymbol
	case B64ENCODED:
		allowedRuneFunc = isB64
	default:
		allowedRuneFunc = none
	}

	token, literal := p.scan(allowedRuneFunc)
	if token&expected == 0 {
		return "", fmt.Errorf("found %q, expected '$'", literal)
	}

	return literal, nil
}

// parseFunctionId parses a function ID
func (p *Parser) parseFunctionId() (string, error) {
	literal, err := p.parseToken(DOLLARSIGN)
	if err != nil {
		return literal, fmt.Errorf("found %q, expected '$'", literal)
	}

	literal, err = p.parseToken(FUNCTIONID)
	if err != nil {
		return literal, fmt.Errorf("found %q, expected a function identifier", literal)
	}
	return literal, nil
}

// parseHash parses a base64-encoded hash
func (p *Parser) parseHash() (string, error) {
	// We parse the hash
	hash, err := p.parseToken(B64ENCODED)
	if err != nil {
		return "", fmt.Errorf("found %q, expected the hash", hash)
	}

	// and make sure that the string finishes right after it
	literal, err := p.parseToken(EOF)
	if err != nil {
		return "", fmt.Errorf("found %q, expected EOF", literal)
	}

	return hash, nil
}

// parseParamsRHS parses an equal sign followed by a parameter value, returning
// only the parameter value.
func (p *Parser) parseParamRHS() (string, error) {
	if literal, err := p.parseToken(EQUALSIGN); err != nil {
		return literal, err
	}

	return p.parseToken(PARAMVALUE)
}

// Parse parses the [Parser]'s reader into a [PHC].
//
// This function will return an error along with an empty [PHC] when the provided
// input is not PHC-compliant.
func (p *Parser) Parse() (PHC, error) {
	// Initialize the returned PHC and its inner parameters map
	out := PHC{}
	out.Params = make(map[string]string)

	// Start parsing: first, we expect '$functionId'
	id, err := p.parseFunctionId()
	if err != nil {
		return PHC{}, fmt.Errorf("failed to parse function ID: %w", err)
	}
	out.Id = id

	// Now we expect either EOF, or to continue parsing with a '$'
	switch token, literal := p.scanSeparator(); token {
	case EOF:
		// Just a function identifier is valid, according to the spec
		return out, nil
	case DOLLARSIGN:
		// We continue parsing
		break
	default:
		return PHC{}, fmt.Errorf("found %q, expected '$' or EOF", literal)
	}

	// There was a '$', so we expect now another identifier, which can either be:
	// - The version key, "v",
	// - A parameter name
	// - The salt
	// B64ENCODED is a superset of PARAMNAME (which is also a superset of "v"),
	// sso we allow the former because we don't know yet what we're parsing.
	versionKeyOrParamNameOrSalt, err := p.parseToken(B64ENCODED)
	if err != nil {
		return PHC{}, fmt.Errorf("found %q, expected the version key, 'v', a parameter name or the salt: %w", versionKeyOrParamNameOrSalt, err)
	}

	// If it's the version key, then we know now that we are parsing
	// '$v=versionStr', and we expect now '=versionStr'
	if versionKeyOrParamNameOrSalt == "v" {
		versionStr, err := p.parseParamRHS()
		if err != nil {
			return PHC{}, fmt.Errorf("failed parsing version string: %w", err)
		}
		out.Version = versionStr

		// Now we expect either EOF, or to continue parsing with a '$'
		switch token, literal := p.scanSeparator(); token {
		case EOF:
			// Just a function identifier + version is valid, according to the spec
			return out, nil
		case DOLLARSIGN:
			// We continue parsing
			break
		default:
			return PHC{}, fmt.Errorf("found %q, expected '$' or EOF", literal)
		}

		// Read the next ident into the variable we had before, so we can continue
		// the logic regardless of whether this block was executed or not.
		versionKeyOrParamNameOrSalt, err = p.parseToken(B64ENCODED)
		if err != nil {
			return PHC{}, fmt.Errorf("found %q, expected a parameter name or the version key, 'v'", versionKeyOrParamNameOrSalt)
		}
	}

	// Now, we either didn't have a version key, or we have already parsed it,
	// so we are left with either a parameter name or the salt.
	paramNameOrSalt := versionKeyOrParamNameOrSalt

	// We know which one by scaning the next token:
	switch token, literal := p.scanSeparator(); token {
	// If the following token is '=', then it was a parameter name, and we
	// expect now '=value'
	case EQUALSIGN:
		paramName := paramNameOrSalt
		// Additional validation for the parameter name not to have the invalid
		// value "v"
		if paramName == "v" {
			return PHC{}, fmt.Errorf("found 'v' as a parameter name, which is only allowed as the version key")
		}
		// Now we parse '=value'
		paramValue, err := p.parseToken(PARAMVALUE)
		if err != nil {
			return PHC{}, fmt.Errorf("found %q, expected a value for parameter %q", paramValue, paramName)
		}

		// And we store the parameter
		out.Params[paramName] = paramValue

	// If the following token is '$' or EOF, then it was the salt, so we store it,
	// and optionally parse the hash
	case DOLLARSIGN, EOF:
		salt := paramNameOrSalt
		out.Salt = salt

		// If the token was '$', then now we expect a hash
		if token == DOLLARSIGN {
			hash, err := p.parseHash()
			if err != nil {
				return PHC{}, err
			}
			out.Hash = hash
		}

		return out, nil
	// Otherwise, we have an error
	default:
		return PHC{}, fmt.Errorf("found %q, expected either '$', or '=' or EOF", literal)
	}

	// If we are here, it means that we just parsed a parameter value, so now we
	// have three possibilities (in a loop):
	// - If we see EOF, then we're done!
	// - If we see a comma, then we expect another name=value pair, and we
	//   restart the loop
	// - If we see '$', then we need to parse 'salt[$hash]', and we finish
	for {
		switch token, literal := p.scanSeparator(); token {
		// We're done!
		case EOF:
			return out, nil
		// Parse a name=value pair, and continue the loop
		case COMMA:
			paramName, err := p.parseToken(PARAMNAME)
			if err != nil {
				return PHC{}, err
			}

			paramValue, err := p.parseParamRHS()
			if err != nil {
				return PHC{}, fmt.Errorf("failed parsing value from parameter %q: %w", paramName, err)
			}
			out.Params[paramName] = paramValue
		// Parse a salt and an optional hash, and finish
		case DOLLARSIGN:
			salt, err := p.parseToken(B64ENCODED)
			if err != nil {
				return PHC{}, err
			}
			out.Salt = salt

			switch token, newLiteral := p.scanSeparator(); token {
			// If what we parsed was a $, then now we expect a $hash
			case DOLLARSIGN:
				hash, err := p.parseHash()
				if err != nil {
					return PHC{}, err
				}
				out.Hash = hash
				return out, nil
			// If what we parsed was an EOF, then we return successfully
			case EOF:
				return out, nil
			// Otherwise, we have an error
			default:
				return PHC{}, fmt.Errorf("found %q, expected either '$', or EOF", newLiteral)
			}
		default:
			return PHC{}, fmt.Errorf("found %q, expected either ',', '$' or EOF", literal)
		}
	}
}
