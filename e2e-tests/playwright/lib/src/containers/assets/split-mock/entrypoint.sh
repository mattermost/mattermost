#!/bin/sh
# Creates a throwaway CA and a certificate for every host in SPLIT_HOSTS (space separated), then starts
# the mock Split service with them. The CA is served on the control API (GET /ca.pem) so the harness can
# make the Mattermost server trust it.
set -eu

: "${SPLIT_HOSTS:?SPLIT_HOSTS is required}"

CERT_DIR=/tmp/certs
mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

openssl req -x509 -newkey rsa:2048 -nodes -days 2 \
    -keyout ca.key -out ca.pem -subj "/CN=e2e-split-mock-ca" 2>/dev/null

openssl req -newkey rsa:2048 -nodes \
    -keyout key.pem -out csr.pem -subj "/CN=split-mock" 2>/dev/null

SAN=""
for host in $SPLIT_HOSTS; do
    SAN="${SAN:+$SAN,}DNS:$host"
done
printf 'subjectAltName=%s\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' "$SAN" > ext.cnf

openssl x509 -req -in csr.pem -CA ca.pem -CAkey ca.key -CAcreateserial \
    -out cert.pem -days 2 -extfile ext.cnf 2>/dev/null

cd /split-mock
TLS_CERT="$CERT_DIR/cert.pem" TLS_KEY="$CERT_DIR/key.pem" CA_FILE="$CERT_DIR/ca.pem" exec node server.mjs
