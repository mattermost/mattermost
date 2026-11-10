.. _mmctl_token_generate:

mmctl token generate
--------------------

Generate token for a user

Synopsis
~~~~~~~~


Generate token for a user. Use --expires-in to set an expiry, which may be required by the server's MaximumPersonalAccessTokenLifetimeDays setting.

::

  mmctl token generate [user] [description] [flags]

Examples
~~~~~~~~

::

    generate testuser test-token
    generate testuser ci-token --expires-in 90d
    generate testuser short-lived --expires-in 12h

Options
~~~~~~~

::

      --expires-in string   Duration after which the token expires (e.g. 90d, 12h, 30m). Accepts the standard Go duration syntax plus a 'd' (days) suffix. If empty, the token does not expire.
  -h, --help                help for generate

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl token <mmctl_token.rst>`_ 	 - manage users' access tokens

