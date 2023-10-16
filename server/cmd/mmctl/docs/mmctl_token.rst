.. _mmctl_token:

mmctl token
-----------

manage users' access tokens

Synopsis
~~~~~~~~


manage users' access tokens

Options
~~~~~~~

::

  -h, --help   help for token

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

* `mmctl <mmctl.rst>`_ 	 - Remote client for the Open Source, self-hosted Slack-alternative
* `mmctl token generate <mmctl_token_generate.rst>`_ 	 - Generate token for a user
* `mmctl token list <mmctl_token_list.rst>`_ 	 - List users tokens
* `mmctl token revoke <mmctl_token_revoke.rst>`_ 	 - Revoke tokens for a user

