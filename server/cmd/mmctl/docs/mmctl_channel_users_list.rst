.. _mmctl_channel_users_list:

mmctl channel users list
------------------------

List users of a channel

Synopsis
~~~~~~~~


List the users belonging to a channel, printing each member's id, username, email and roles

::

  mmctl channel users list [channel] [flags]

Examples
~~~~~~~~

::

    channel users list myteam:mychannel
    channel users list myteam:mychannel --all

Options
~~~~~~~

::

      --all            Fetch all channel users. --page flag will be ignored if provided
  -h, --help           help for list
      --page int       Page number to fetch for the list of channel users
      --per-page int   Number of channel users to be fetched (default 200)

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

* `mmctl channel users <mmctl_channel_users.rst>`_ 	 - Management of channel users

