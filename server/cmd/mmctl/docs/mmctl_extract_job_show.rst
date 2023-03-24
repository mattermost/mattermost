.. _mmctl_extract_job_show:

mmctl extract job show
----------------------

Show extract job

Synopsis
~~~~~~~~


Show extract job

::

  mmctl extract job show [extractJobID] [flags]

Examples
~~~~~~~~

::

   extract job show f3d68qkkm7n8xgsfxwuo498rah

Options
~~~~~~~

::

  -h, --help   help for show

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

* `mmctl extract job <mmctl_extract_job.rst>`_ 	 - List and show content extraction jobs

