// Package ldap - moddn.go contains ModifyDN functionality
//
// https://tools.ietf.org/html/rfc4511
// ModifyDNRequest ::= [APPLICATION 12] SEQUENCE {
//      entry           LDAPDN,
//      newrdn          RelativeLDAPDN,
//      deleteoldrdn    BOOLEAN,
//      newSuperior     [0] LDAPDN OPTIONAL }
//
//
package ldap

import (
	"log"

	ber "github.com/go-asn1-ber/asn1-ber"
)

// ModifyDNRequest holds the request to modify a DN
type ModifyDNRequest struct {
	DN           string
	NewRDN       string
	DeleteOldRDN bool
	NewSuperior  string
}

// NewModifyDNRequest creates a new request which can be passed to ModifyDN().
//
// To move an object in the tree, set the "newSup" to the new parent entry DN. Use an
// empty string for just changing the object's RDN.
//
// For moving the object without renaming, the "rdn" must be the first
// RDN of the given DN.
//
// A call like
//   mdnReq := NewModifyDNRequest("uid=someone,dc=example,dc=org", "uid=newname", true, "")
// will setup the request to just rename uid=someone,dc=example,dc=org to
// uid=newname,dc=example,dc=org.
func NewModifyDNRequest(dn string, rdn string, delOld bool, newSup string) *ModifyDNRequest {
	return &ModifyDNRequest{
		DN:           dn,
		NewRDN:       rdn,
		DeleteOldRDN: delOld,
		NewSuperior:  newSup,
	}
}

func (req *ModifyDNRequest) appendTo(envelope *ber.Packet) error {
	pkt := ber.Encode(ber.ClassApplication, ber.TypeConstructed, ApplicationModifyDNRequest, nil, "Modify DN Request")
	pkt.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, req.DN, "DN"))
	pkt.AppendChild(ber.NewString(ber.ClassUniversal, ber.TypePrimitive, ber.TagOctetString, req.NewRDN, "New RDN"))
	pkt.AppendChild(ber.NewBoolean(ber.ClassUniversal, ber.TypePrimitive, ber.TagBoolean, req.DeleteOldRDN, "Delete old RDN"))
	if req.NewSuperior != "" {
		pkt.AppendChild(ber.NewString(ber.ClassContext, ber.TypePrimitive, 0, req.NewSuperior, "New Superior"))
	}

	envelope.AppendChild(pkt)

	return nil
}

// ModifyDN renames the given DN and optionally move to another base (when the "newSup" argument
// to NewModifyDNRequest() is not "").
func (l *Conn) ModifyDN(m *ModifyDNRequest) error {
	msgCtx, err := l.doRequest(m)
	if err != nil {
		return err
	}
	defer l.finishMessage(msgCtx)

	packet, err := l.readPacket(msgCtx)
	if err != nil {
		return err
	}

	if packet.Children[1].Tag == ApplicationModifyDNResponse {
		err := GetLDAPError(packet)
		if err != nil {
			return err
		}
	} else {
		log.Printf("Unexpected Response: %d", packet.Children[1].Tag)
	}
	return nil
}
