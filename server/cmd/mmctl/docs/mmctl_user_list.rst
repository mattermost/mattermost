.. _mmctl_user_list:

mmctl user list
---------------

List users

Synopsis
~~~~~~~~


List all users

::

  mmctl user list [flags]

Examples
~~~~~~~~

::

    user list

Options
~~~~~~~

::

      --all            Fetch all users. --page flag will be ignore if provided
  -h, --help           help for list
      --page int       Page number to fetch for the list of users
      --per-page int   Number of users to be fetched (default 200)
      --team string    If supplied, only users belonging to this team will be listed

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

* `mmctl user <mmctl_user.rst>`_ 	 - Management of users

