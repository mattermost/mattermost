.. _mmctl_oauth_list:

mmctl oauth list
----------------

List OAuth2 apps

Synopsis
~~~~~~~~


list all OAuth2 apps

::

  mmctl oauth list [flags]

Examples
~~~~~~~~

::

    oauth list

Options
~~~~~~~

::

  -h, --help           help for list
      --page int       Page number to fetch for the list of OAuth2 apps
      --per-page int   Number of OAuth2 apps to be fetched (default 200)

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

* `mmctl oauth <mmctl_oauth.rst>`_ 	 - Management of OAuth2 apps

