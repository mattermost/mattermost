.. _mmctl_compliance-export_list:

mmctl compliance-export list
----------------------------

List compliance export jobs, sorted by creation date descending (newest first)

Synopsis
~~~~~~~~


List compliance export jobs, sorted by creation date descending (newest first)

::

  mmctl compliance-export list [flags]

Options
~~~~~~~

::

      --all            Fetch all compliance export jobs. --page flag will be ignored if provided
  -h, --help           help for list
      --page int       Page number to fetch for the list of compliance export jobs
      --per-page int   Number of compliance export jobs to be fetched (default 200)

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

* `mmctl compliance-export <mmctl_compliance-export.rst>`_ 	 - Management of compliance exports

