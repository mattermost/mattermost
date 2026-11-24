.. _mmctl_channel_create:

mmctl channel create
--------------------

Create a channel

Synopsis
~~~~~~~~


Create a channel.

When the server requires channel attributes, pass each value with --attribute "<attribute>=<value>". The attribute can be its name or its ID, and a select value can be an option name or option ID. Quote the argument when it contains spaces. The text splits on the first "=", so a value may contain "=" and commas.

An attribute that holds one value (select, text) can be passed only once. Repeat --attribute to set several values on a multiselect attribute. The values you pass replace any value the channel already holds for those attributes. Run "mmctl channel attributes fields" to see the attributes and their options.

::

  mmctl channel create [flags]

Examples
~~~~~~~~

::

    channel create --team myteam --name mynewchannel --display-name "My New Channel"
    channel create --team myteam --name mynewprivatechannel --display-name "My New Private Channel" --private
    channel create --team myteam --name ops --display-name "Ops" --attribute "Classification=Secret" --attribute "Region=EMEA" --attribute "Region=APAC"

Options
~~~~~~~

::

      --attribute stringArray   Attribute value to set, as "<attribute>=<value>". Repeat the flag to set several attributes or several values of a multiselect attribute
      --display-name string     Channel Display Name
      --header string           Channel header
  -h, --help                    help for create
      --name string             Channel Name
      --private                 Create a private channel.
      --purpose string          Channel purpose
      --team string             Team name or ID

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

