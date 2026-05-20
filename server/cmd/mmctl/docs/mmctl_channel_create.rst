.. _mmctl_channel_create:

mmctl channel create
--------------------

Create a channel

Synopsis
~~~~~~~~


Create a channel.

::

  mmctl channel create [flags]

Examples
~~~~~~~~

::

    channel create --team myteam --name mynewchannel --display-name "My New Channel"
    channel create --team myteam --name mynewprivatechannel --display-name "My New Private Channel" --private

Options
~~~~~~~

::

      --display-name string   Channel Display Name
      --header string         Channel header
  -h, --help                  help for create
      --name string           Channel Name
      --private               Create a private channel.
      --purpose string        Channel purpose
      --team string           Team name or ID

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

