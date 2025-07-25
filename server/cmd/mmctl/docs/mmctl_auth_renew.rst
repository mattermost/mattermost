.. _mmctl_auth_renew:

mmctl auth renew
----------------

Renews a set of credentials

Synopsis
~~~~~~~~


Renews the credentials for a given server

::

  mmctl auth renew [flags]

Examples
~~~~~~~~

::

    auth renew local-server

Options
~~~~~~~

::

  -t, --access-token-file string   Access token file to be read to use instead of username/password
  -h, --help                       help for renew
  -m, --mfa-token string           MFA token for the credentials
  -f, --password-file string       Password file to be read for the credentials

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --local-user-id string         allows to set the user-id for local connections
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl auth <mmctl_auth.rst>`_ 	 - Manages the credentials of the remote Mattermost instances

