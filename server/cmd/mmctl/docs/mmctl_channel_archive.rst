.. _mmctl_channel_archive:

mmctl channel archive
---------------------

Archive channels

Synopsis
~~~~~~~~


Archive some channels.
Archive a channel along with all related information including posts from the database.
Channels can be specified by [team]:[channel]. ie. myteam:mychannel or by channel ID.

::

  mmctl channel archive [channels] [flags]

Examples
~~~~~~~~

::

    channel archive myteam:mychannel

Options
~~~~~~~

::

  -h, --help   help for archive

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

* `mmctl channel <mmctl_channel.rst>`_ 	 - Management of channels

