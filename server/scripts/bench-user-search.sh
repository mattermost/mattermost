#!/usr/bin/env bash
# bench-user-search.sh — run the user search benchmarks and compare refs with benchstat.
#
# Usage, from server/ (Postgres and Redis must be running, e.g.
# ENABLED_DOCKER_SERVICES='postgres redis' make start-docker):
#
#   scripts/bench-user-search.sh run [label]         # write $OUT_DIR/<label>.txt (default label: current branch)
#   scripts/bench-user-search.sh compare [base-ref]  # benchstat base-ref (default origin/master) vs the working tree
#   scripts/bench-user-search.sh enable-db-stats     # preload pg_stat_statements in the dev Postgres container
#
# compare checks base-ref out into a temporary git worktree and copies the
# benchmark harness over it, so both sides run identical benchmark code even
# before the harness exists on base-ref. Samples are collected in rounds that
# alternate base and head, so machine drift spreads over both sides.
#
# Environment:
#   BENCH_COUNT   samples per benchmark (default 6; benchstat wants >= 6)
#   BENCH_ROUNDS  compare only: base/head alternations BENCH_COUNT is split over (default 3)
#   BENCH_TIME    -benchtime per sample (default 500ms)
#   BENCH_LAYERS  any of: store api (default both)
#   BENCH_FILTER  sub-benchmark regex, e.g. 'op=Search/scope=team_large' or 'layer=api/op=autocomplete'
#   OUT_DIR       results directory (default server/bench-results/user-search)
#   MM_USERSEARCH_BENCH_USERS, MM_USERSEARCH_BENCH_TEAMS, MM_USERSEARCH_BENCH_CHANNELS_PER_TEAM
#                 dataset size (defaults 100000, 5, 50)
#   MM_USERSEARCH_BENCH_TOP_QUERIES
#                 log the N most expensive statements per benchmark (needs enable-db-stats)

set -euo pipefail

SERVER_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO_DIR=$(cd "$SERVER_DIR/.." && pwd)

BENCH_COUNT=${BENCH_COUNT:-6}
BENCH_ROUNDS=${BENCH_ROUNDS:-3}
BENCH_TIME=${BENCH_TIME:-500ms}
BENCH_LAYERS=${BENCH_LAYERS:-store api}
BENCH_FILTER=${BENCH_FILTER:-}
OUT_DIR=${OUT_DIR:-$SERVER_DIR/bench-results/user-search}
PG_CONTAINER=${PG_CONTAINER:-mattermost-postgres}

# Files that make up the harness; compare overlays them onto the base ref.
HARNESS_FILES=(
	channels/testlib/usersearchbench/dataset.go
	channels/testlib/usersearchbench/measure.go
	channels/store/sqlstore/user_search_bench_test.go
	channels/api4/user_search_bench_test.go
)

layer_target() {
	case $1 in
	store) echo "./channels/store/sqlstore BenchmarkUserSearchStore" ;;
	api) echo "./channels/api4 BenchmarkUserSearchAppAPI" ;;
	*)
		echo "unknown layer '$1' (want store or api)" >&2
		exit 2
		;;
	esac
}

# run_layer <server dir> <layer> <output file> <count>
run_layer() {
	local dir=$1 layer=$2 out=$3 count=$4 pkg bench pattern
	read -r pkg bench <<<"$(layer_target "$layer")"
	pattern="^${bench}\$"
	if [ -n "$BENCH_FILTER" ]; then
		pattern="$pattern/$BENCH_FILTER"
	fi

	echo "==> $layer in $dir" >&2
	(
		cd "$dir"
		MM_LOGSETTINGS_CONSOLELEVEL=ERROR go test "$pkg" -run '^$' -bench "$pattern" \
			-benchtime "$BENCH_TIME" -count "$count" -timeout 180m
	) 2>&1 | tee -a "${out%.txt}.log" |
		grep -E '^(goos|goarch|pkg|cpu|usersearch-[a-z-]+): |^Benchmark|^(FAIL|panic)' >>"$out" || true

	if grep -qE '^(FAIL|panic)' "$out"; then
		echo "benchmarks failed in $dir, see ${out%.txt}.log" >&2
		exit 1
	fi
}

benchstat_cmd() {
	if command -v benchstat >/dev/null 2>&1; then
		benchstat "$@"
	else
		go run golang.org/x/perf/cmd/benchstat@latest "$@"
	fi
}

# Recreates the go.work of the current tree (minus its location) in another tree.
make_go_work() {
	local target=$1 path abs
	(cd "$target" && rm -f go.work go.work.sum && go work init . ./public)
	while read -r path; do
		case $path in "" | . | ./public) continue ;; esac
		abs=$(cd "$SERVER_DIR" && cd "$path" && pwd)
		(cd "$target" && go work use "$abs")
	done < <(cd "$SERVER_DIR" && go work edit -json 2>/dev/null | sed -n 's/.*"DiskPath": "\(.*\)".*/\1/p')
}

cmd_run() {
	local label=${1:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD | tr '/' '-')}
	local out="$OUT_DIR/$label.txt"
	mkdir -p "$OUT_DIR"
	rm -f "$out" "${out%.txt}.log"
	for layer in $BENCH_LAYERS; do
		run_layer "$SERVER_DIR" "$layer" "$out" "$BENCH_COUNT"
	done
	echo "results: $out" >&2
	benchstat_cmd "$out"
}

cmd_compare() {
	local base_ref=${1:-origin/master} tmp wt base head per_round
	per_round=$(((BENCH_COUNT + BENCH_ROUNDS - 1) / BENCH_ROUNDS))
	git -C "$REPO_DIR" rev-parse --verify --quiet "$base_ref^{commit}" >/dev/null || {
		echo "unknown ref $base_ref (try: git fetch origin master)" >&2
		exit 2
	}

	tmp=$(mktemp -d)
	wt="$tmp/mattermost"
	git -C "$REPO_DIR" worktree add --detach --quiet "$wt" "$base_ref"
	# shellcheck disable=SC2064 # expand now: these locals are gone when the trap fires.
	trap "git -C '$REPO_DIR' worktree remove --force '$wt'; rm -rf '$tmp'" EXIT

	for f in "${HARNESS_FILES[@]}"; do
		mkdir -p "$(dirname "$wt/server/$f")"
		cp "$SERVER_DIR/$f" "$wt/server/$f"
	done
	make_go_work "$wt/server"

	mkdir -p "$OUT_DIR"
	base="$OUT_DIR/base.txt"
	head="$OUT_DIR/head.txt"
	rm -f "$base" "$head" "${base%.txt}.log" "${head%.txt}.log"
	for layer in $BENCH_LAYERS; do
		for _ in $(seq "$BENCH_ROUNDS"); do
			run_layer "$wt/server" "$layer" "$base" "$per_round"
			run_layer "$SERVER_DIR" "$layer" "$head" "$per_round"
		done
	done

	echo "base ($base_ref): $base" >&2
	echo "head (working tree): $head" >&2
	benchstat_cmd base="$base" head="$head"
}

cmd_enable_db_stats() {
	docker exec -e PGPASSWORD=mostest_password "$PG_CONTAINER" psql -h localhost -U mmuser -d postgres \
		-c "ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements'"
	docker restart "$PG_CONTAINER" >/dev/null
	for _ in $(seq 1 60); do
		if docker exec "$PG_CONTAINER" pg_isready -h localhost >/dev/null 2>&1; then
			echo "pg_stat_statements preloaded in $PG_CONTAINER" >&2
			return
		fi
		sleep 1
	done
	echo "$PG_CONTAINER did not come back up" >&2
	exit 1
}

case ${1:-} in
run) cmd_run "${@:2}" ;;
compare) cmd_compare "${@:2}" ;;
enable-db-stats) cmd_enable_db_stats ;;
*)
	sed -n '2,26p' "$0" | sed 's/^# \{0,1\}//'
	exit 2
	;;
esac
