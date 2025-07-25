.. _mmctl_user_preference_list:

mmctl user preference list
--------------------------

List user preferences

Synopsis
~~~~~~~~


List user preferences

::

  mmctl user preference list [--category category] [users] [flags]

Examples
~~~~~~~~

::

  preference list user@example.com

Options
~~~~~~~

::

  -c, --category string   The optional category by which to filter
  -h, --help              help for list

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

* `mmctl user preference <mmctl_user_preference.rst>`_ 	 - Manage user preferences

