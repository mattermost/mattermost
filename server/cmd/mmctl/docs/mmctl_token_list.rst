.. _mmctl_token_list:

mmctl token list
----------------

List users tokens

Synopsis
~~~~~~~~


List the tokens of a user

::

  mmctl token list [user] [flags]

Examples
~~~~~~~~

::

    user tokens testuser

Options
~~~~~~~

::

      --active         List only active tokens (default true)
      --all            Fetch all tokens. --page flag will be ignore if provided
  -h, --help           help for list
      --inactive       List only inactive tokens
      --page int       Page number to fetch for the list of users
      --per-page int   Number of users to be fetched (default 200)

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

