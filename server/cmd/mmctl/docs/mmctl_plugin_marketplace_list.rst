.. _mmctl_plugin_marketplace_list:

mmctl plugin marketplace list
-----------------------------

List marketplace plugins

Synopsis
~~~~~~~~


Gets all plugins from the marketplace server, merging data from locally installed plugins as well as prepackaged plugins shipped with the server

::

  mmctl plugin marketplace list [flags]

Examples
~~~~~~~~

::

    # You can list all the plugins
    $ mmctl plugin marketplace list --all

    # Pagination options can be used too
    $ mmctl plugin marketplace list --page 2 --per-page 10

    # Filtering will narrow down the search
    $ mmctl plugin marketplace list --filter jit

    # You can only retrieve local plugins
    $ mmctl plugin marketplace list --local-only

Options
~~~~~~~

::

      --all             Fetch all plugins. --page flag will be ignore if provided
      --filter string   Filter plugins by ID, name or description
  -h, --help            help for list
      --local-only      Only retrieve local plugins
      --page int        Page number to fetch for the list of users
      --per-page int    Number of users to be fetched (default 200)

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

* `mmctl plugin marketplace <mmctl_plugin_marketplace.rst>`_ 	 - Management of marketplace plugins

