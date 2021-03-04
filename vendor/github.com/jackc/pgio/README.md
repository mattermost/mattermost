[![](https://godoc.org/github.com/jackc/pgio?status.svg)](https://godoc.org/github.com/jackc/pgio)
[![Build Status](https://travis-ci.org/jackc/pgio.svg)](https://travis-ci.org/jackc/pgio)

# pgio

Package pgio is a low-level toolkit building messages in the PostgreSQL wire protocol.

pgio provides functions for appending integers to a []byte while doing byte
order conversion.

Extracted from original implementation in https://github.com/jackc/pgx.
