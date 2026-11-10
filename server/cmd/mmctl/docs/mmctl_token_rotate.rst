.. _mmctl_token_rotate:

mmctl token rotate
------------------

Rotate a personal access token

Synopsis
~~~~~~~~


Generate a new secret for an existing personal access token, immediately invalidating the old secret. Use --expires-in to set a new expiry.

::

  mmctl token rotate [token-id] [flags]

Examples
~~~~~~~~

::

    rotate xwt6numaubyj9mqjfkqjk5pfqr
    rotate xwt6numaubyj9mqjfkqjk5pfqr --expires-in 90d

Options
~~~~~~~

::

      --expires-in string   New expiry duration for the rotated token (e.g. 90d, 12h). If empty, the token does not expire (subject to server policy).
  -h, --help                help for rotate

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

