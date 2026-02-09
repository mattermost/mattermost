FROM postgres:14

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-server-dev-14 make gcc libicu-dev wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN wget https://github.com/pgbigm/pg_bigm/releases/download/v1.2-20200228/pg_bigm-1.2-20200228.tar.gz \
    && tar zxf pg_bigm-1.2-20200228.tar.gz \
    && cd pg_bigm-1.2-20200228 \
    && make USE_PGXS=1 PG_CONFIG="$(which pg_config)" \
    && make USE_PGXS=1 PG_CONFIG="$(which pg_config)" install \
    && cd .. \
    && rm -rf pg_bigm-1.2-20200228 pg_bigm-1.2-20200228.tar.gz

USER postgres
