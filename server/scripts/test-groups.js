#!/usr/bin/env node
/**
 * test-groups.js — Deterministic server test groups per sub-component
 *
 * Single source of truth for how server test packages are grouped into CI
 * jobs. Each package belongs to exactly one group: the first group whose
 * prefix matches its path relative to server/ (public/ for the public
 * module), falling back to the catch-all group, which must be last. Heavy
 * groups are further split into shards by shard-split.js.
 *
 * Commands:
 *   matrix                 Print the GitHub Actions matrix JSON (one entry per group shard)
 *   filter <group>         Read package import paths on stdin, print those in <group>
 *   check-codecov <file>   Fail unless codecov.yml after_n_builds matches the job count
 */

const fs = require("node:fs");

const RUNNER_LARGE = "ubuntu-latest-8-cores";
const RUNNER_STANDARD = "ubuntu-22.04";

// Order matters: first match wins, so specific prefixes go before broader ones.
const GROUPS = [
    { name: "api4", prefixes: ["channels/api4"], shards: 2, runner: RUNNER_LARGE },
    { name: "app", prefixes: ["channels/app"], shards: 2, runner: RUNNER_LARGE },
    { name: "store", prefixes: ["channels/store"], shards: 1, runner: RUNNER_LARGE },
    { name: "channels", prefixes: ["channels"], shards: 1, runner: RUNNER_LARGE },
    { name: "platform", prefixes: ["platform"], shards: 1, runner: RUNNER_LARGE },
    { name: "public", prefixes: ["public"], shards: 1, runner: RUNNER_STANDARD },
    { name: "enterprise", prefixes: ["enterprise"], shards: 1, runner: RUNNER_STANDARD },
    { name: "other", prefixes: [], shards: 1, runner: RUNNER_STANDARD },
];

const MODULE_PREFIXES = [
    ["github.com/mattermost/mattermost/server/v8/", ""],
    ["github.com/mattermost/mattermost/server/public/", "public/"],
];

function fail(msg) {
    console.error(`ERROR: ${msg}`);
    process.exit(1);
}

function validate(groups) {
    const names = new Set();
    groups.forEach((g, i) => {
        if (!/^[a-z0-9-]+$/.test(g.name)) fail(`group name "${g.name}" must match [a-z0-9-]+`);
        if (names.has(g.name)) fail(`duplicate group "${g.name}"`);
        names.add(g.name);
        if (!Number.isInteger(g.shards) || g.shards < 1 || g.shards > 16) fail(`group "${g.name}": shards must be 1..16`);
        const catchAll = g.prefixes.length === 0;
        if (catchAll !== (i === groups.length - 1)) fail("exactly one catch-all group (no prefixes) is required, and it must be last");
    });
}

function relativePath(pkg) {
    for (const [prefix, replacement] of MODULE_PREFIXES) {
        if (pkg.startsWith(prefix)) return replacement + pkg.slice(prefix.length);
        if (pkg + "/" === prefix) return replacement.replace(/\/$/, "");
    }
    return pkg;
}

function groupOf(pkg) {
    const rel = relativePath(pkg);
    return GROUPS.find(
        (g) => g.prefixes.length === 0 || g.prefixes.some((p) => rel === p || rel.startsWith(p + "/")),
    );
}

const jobCount = () => GROUPS.reduce((n, g) => n + g.shards, 0);

function matrix() {
    const include = GROUPS.flatMap((g) =>
        Array.from({ length: g.shards }, (_, shard) => ({
            group: g.name,
            shard,
            shards: g.shards,
            runner: g.runner,
        })),
    );
    process.stdout.write(JSON.stringify({ include }));
}

function filter(name) {
    if (!GROUPS.some((g) => g.name === name)) fail(`unknown group "${name}"`);
    const pkgs = fs.readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
    const mine = pkgs.filter((p) => groupOf(p).name === name);
    if (mine.length > 0) process.stdout.write(mine.join("\n") + "\n");
}

function afterNBuilds(yaml, pattern, label) {
    const m = yaml.match(pattern);
    if (!m) fail(`could not find ${label} after_n_builds`);
    return parseInt(m[1], 10);
}

function checkCodecov(file) {
    const yaml = fs.readFileSync(file, "utf8");
    const server = afterNBuilds(yaml, /\n\s+server:\s*\n\s+after_n_builds:\s*(\d+)/, "flags.server");
    const webapp = afterNBuilds(yaml, /\n\s+webapp:\s*\n\s+after_n_builds:\s*(\d+)/, "flags.webapp");
    const notify = afterNBuilds(yaml, /notify:\s*\n\s+after_n_builds:\s*(\d+)/, "codecov.notify");
    const jobs = jobCount();
    if (server !== jobs) fail(`${file}: flags.server.after_n_builds is ${server}, expected ${jobs} (one upload per server test group shard)`);
    if (notify !== jobs + webapp) fail(`${file}: codecov.notify.after_n_builds is ${notify}, expected ${jobs + webapp} (server + webapp uploads)`);
    console.log(`codecov after_n_builds OK: ${jobs} server + ${webapp} webapp`);
}

validate(GROUPS);

const [cmd, arg] = process.argv.slice(2);
if (cmd === "matrix") matrix();
else if (cmd === "filter" && arg) filter(arg);
else if (cmd === "check-codecov" && arg) checkCodecov(arg);
else fail("usage: test-groups.js matrix | filter <group> | check-codecov <codecov.yml>");
