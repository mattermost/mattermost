# Changelog

## [0.4.0] - 2017-07-13

### Added:
- CLI: The `--http-timeout` switch. This allows for an override of the default client HTTP timeout.
- lib: The `HTTPClient` field. This allows for an override of the default HTTP timeout for library HTTP requests.
- CLI: The `--dns-timeout` switch. This allows for an override of the default DNS timeout for library DNS requests.
- lib: The `DNSTimeout` switch. This allows for an override of the default client DNS timeout.
- lib: The `QueryRegistration` function on `acme.Client`. This performs a POST on the client registration's URI and gets the updated registration info.
- lib: The `DeleteRegistration` function on `acme.Client`. This deletes the registration as currently configured in the client.
- lib: The `ObtainCertificateForCSR` function on `acme.Client`. The function allows to request a certificate for an already existing CSR.
- CLI: The `--csr` switch. Allows to use already existing CSRs for certificate requests on the command line.
- CLI: The `--pem` flag. This will change the certificate output so it outputs a .pem file concatanating the .key and .crt files together.
- CLI: The `--dns-resolvers` flag. Allows for users to override the default DNS servers used for recursive lookup.
- lib: Added a memcached provider for the HTTP challenge.
- CLI: The `--memcached-host` flag. This allows to use memcached for challenge storage.
- CLI: The `--must-staple` flag. This enables OCSP must staple in the generated CSR.
- lib: The library will now honor entries in your resolv.conf.
- lib: Added a field `IssuerCertificate` to the `CertificateResource` struct.
- lib: A new DNS provider for OVH.
- lib: A new DNS provider for DNSMadeEasy.
- lib: A new DNS provider for Linode.
- lib: A new DNS provider for AuroraDNS.
- lib: A new DNS provider for NS1.
- lib: A new DNS provider for Azure DNS.
- lib: A new DNS provider for Rackspace DNS.
- lib: A new DNS provider for Exoscale DNS.
- lib: A new DNS provider for DNSPod.

### Changed:
- lib: Exported the `PreCheckDNS` field so library users can manage the DNS check in tests.
- lib: The library will now skip challenge solving if a valid Authz already exists.

### Removed:
- lib: The library will no longer check for auto renewed certificates. This has been removed from the spec and is not supported in Boulder.

### Fixed:
- lib: Fix a problem with the Route53 provider where it was possible the verification was published to a private zone.
- lib: Loading an account from file should fail if a integral part is nil
- lib: Fix a potential issue where the Dyn provider could resolve to an incorrect zone.
- lib: If a registration encounteres a conflict, the old registration is now recovered.
- CLI: The account.json file no longer has the executable flag set.
- lib: Made the client registration more robust in case of a 403 HTTP response.
- lib: Fixed an issue with zone lookups when they have a CNAME in another zone.
- lib: Fixed the lookup for the authoritative zone for Google Cloud.
- lib: Fixed a race condition in the nonce store.
- lib: The Google Cloud provider now removes old entries before trying to add new ones.
- lib: Fixed a condition where we could stall due to an early error condition.
- lib: Fixed an issue where Authz object could end up in an active state after an error condition.

## [0.3.1] - 2016-04-19

### Added:
- lib: A new DNS provider for Vultr.

### Fixed:
- lib: DNS Provider for DigitalOcean could not handle subdomains properly.
- lib: handleHTTPError should only try to JSON decode error messages with the right content type.
- lib: The propagation checker for the DNS challenge would not retry on send errors.


## [0.3.0] - 2016-03-19

### Added:
- CLI: The `--dns` switch. To include the DNS challenge for consideration. When using this switch, all other solvers are disabled. Supported are the following solvers: cloudflare, digitalocean, dnsimple, dyn, gandi, googlecloud, namecheap, route53, rfc2136 and manual.
- CLI: The `--accept-tos`  switch. Indicates your acceptance of the Let's Encrypt terms of service without prompting you.
- CLI: The `--webroot` switch. The HTTP-01 challenge may now be completed by dropping a file into a webroot. When using this switch, all other solvers are disabled.
- CLI: The `--key-type` switch. This replaces the `--rsa-key-size` switch and supports the following key types: EC256, EC384, RSA2048, RSA4096 and RSA8192.
- CLI: The `--dnshelp` switch. This displays a more in-depth help topic for DNS solvers.
- CLI: The `--no-bundle` sub switch for the `run` and `renew` commands. When this switch is set, the CLI will not bundle the issuer certificate with your certificate.
- lib: A new type for challenge identifiers `Challenge`
- lib: A new interface for custom challenge providers `acme.ChallengeProvider`
- lib: A new interface for DNS-01 providers to allow for custom timeouts for the validation function `acme.ChallengeProviderTimeout`
- lib: SetChallengeProvider function. Pass a challenge identifier and a Provider to replace the default behaviour of a challenge.
- lib: The DNS-01 challenge has been implemented with modular solvers using the `ChallengeProvider` interface. Included solvers are: cloudflare, digitalocean, dnsimple, gandi, namecheap, route53, rfc2136 and manual.
- lib: The `acme.KeyType` type was added and is used for the configuration of crypto parameters for RSA and EC keys. Valid KeyTypes are: EC256, EC384, RSA2048, RSA4096 and RSA8192.

### Changed
- lib: ExcludeChallenges now expects to be passed an array of `Challenge` types.
- lib: HTTP-01 now supports custom solvers using the `ChallengeProvider` interface.
- lib: TLS-SNI-01 now supports custom solvers using the `ChallengeProvider` interface.
- lib: The `GetPrivateKey` function in the `acme.User` interface is now expected to return a `crypto.PrivateKey` instead of an `rsa.PrivateKey` for EC compat.
- lib: The `acme.NewClient` function now expects an `acme.KeyType` instead of the keyBits parameter.
 
### Removed
- CLI: The `rsa-key-size` switch was removed in favor of `key-type` to support EC keys.

### Fixed
- lib: Fixed a race condition in HTTP-01
- lib: Fixed an issue where status codes on ACME challenge responses could lead to no action being taken.
- lib: Fixed a regression when calling the Renew function with a SAN certificate.

## [0.2.0] - 2016-01-09

### Added:
- CLI: The `--exclude` or `-x` switch. To exclude a challenge from being solved.
- CLI: The `--http` switch. To set the listen address and port of HTTP based challenges. Supports `host:port` and `:port` for any interface.
- CLI: The `--tls` switch. To set the listen address and port of TLS based challenges. Supports `host:port` and `:port` for any interface.
- CLI: The `--reuse-key` switch for the `renew` operation. This lets you reuse an existing private key for renewals.
- lib: ExcludeChallenges function. Pass an array of challenge identifiers to exclude them from solving.
- lib: SetHTTPAddress function. Pass a port to set the listen port for HTTP based challenges.
- lib: SetTLSAddress function. Pass a port to set the listen port of TLS based challenges.
- lib: acme.UserAgent variable. Use this to customize the user agent on all requests sent by lego.

### Changed:
- lib: NewClient does no longer accept the optPort parameter
- lib: ObtainCertificate now returns a SAN certificate if you pass more then one domain.
- lib: GetOCSPForCert now returns the parsed OCSP response instead of just the status.
- lib: ObtainCertificate has a new parameter `privKey crypto.PrivateKey` which lets you reuse an existing private key for new certificates.
- lib: RenewCertificate now expects the PrivateKey property of the CertificateResource to be set only if you want to reuse the key.

### Removed:
- CLI: The `--port` switch was removed.
- lib: RenewCertificate does no longer offer to also revoke your old certificate.

### Fixed:
- CLI: Fix logic using the `--days` parameter for renew

## [0.1.1] - 2015-12-18

### Added:
- CLI: Added a way to automate renewal through a cronjob using the --days parameter to renew

### Changed:
- lib: Improved log output on challenge failures.

### Fixed:
- CLI: The short parameter for domains would not get accepted
- CLI: The cli did not return proper exit codes on error library errors.
- lib: RenewCertificate did not properly renew SAN certificates.

### Security
- lib: Fix possible DOS on GetOCSPForCert

## [0.1.0] - 2015-12-03
- Initial release

[0.3.1]: https://github.com/xenolf/lego/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/xenolf/lego/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/xenolf/lego/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/xenolf/lego/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xenolf/lego/tree/v0.1.0
