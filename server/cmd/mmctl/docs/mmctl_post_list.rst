.. _mmctl_post_list:

mmctl post list
---------------

List posts for a channel

Synopsis
~~~~~~~~


List posts for a channel

::

  mmctl post list [flags]

Examples
~~~~~~~~

::

    post list myteam:mychannel
    post list myteam:mychannel --number 20

Options
~~~~~~~

::

  -f, --follow         Output appended data as new messages are posted to the channel
  -h, --help           help for list
  -n, --number int     Number of messages to list (default 20)
  -i, --show-ids       Show posts ids
  -s, --since string   List messages posted after a certain time (ISO 8601)

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

* `mmctl post <mmctl_post.rst>`_ 	 - Management of posts

