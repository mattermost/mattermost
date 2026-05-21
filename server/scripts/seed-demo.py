#!/usr/bin/env python3
"""Generate a Mattermost bulk-import JSONL that seeds the `demo` team with
realistic threaded conversations authored by the sampledata users.

Idempotency:
  Every imported post (root + reply) is tagged with `props.demo_seed = "v1"`.
  prepare-demo.sh strips previously-seeded posts before re-importing so this
  script can be re-run safely.

Usage:
  python3 seed-demo.py                 # writes /tmp/demo-seed.jsonl
  SEED_OUT=/path/file.jsonl python3 seed-demo.py
"""

import json
import os
import sys
import time
from typing import List, Tuple

TEAM = "demo"
OUT = os.environ.get("SEED_OUT", "/tmp/demo-seed.jsonl")
SEED_MARKER = {"demo_seed": "v1"}

NOW_MS = int(time.time() * 1000)
MIN_MS = 60 * 1000
HOUR_MS = 60 * MIN_MS

Thread = Tuple[str, str, str, List[Tuple[str, str]]]


def thread(channel: str, author: str, message: str, replies: List[Tuple[str, str]]) -> Thread:
    return (channel, author, message, replies)


# Ordered oldest -> newest. Newer threads end up at the bottom of the channel
# scrollback (most visible). The final few threads cluster around the demo-prep
# narrative + @yvette mentions so yvette has a populated unread + mentions view
# when they open the app.
THREADS: List[Thread] = [
    # ─── ~3h ago: background chatter ─────────────────────────────────────
    thread(
        "off-topic", "lori.carter",
        "Anyone else trying out the new coffee place on 3rd? I went yesterday — the espresso is actually really good but the wait at 9am is brutal.",
        [
            ("samuel.palmer", "Went last week. Agree on the espresso. Try the cortado, it's the move."),
            ("ashley.berry", "Wait is fine if you order ahead in their app. I tested it twice this week, total ~4 min from order to pickup."),
            ("lori.carter", "Oh that's a game-changer. Pulling it up now."),
            ("gerald.gomez", "What's wrong with the office machine 🥲"),
            ("samuel.palmer", "@gerald.gomez genuinely curious if you're being sarcastic"),
            ("gerald.gomez", "100% sarcastic. The office machine is a war crime."),
        ],
    ),
    thread(
        "off-topic", "craig.reed",
        "Music thread — drop one album you've had on repeat this month. Any genre. I'll start: 'A Light for Attracting Attention' by The Smile. Slow burn, very good headphones-on-a-walk record.",
        [
            ("bobby.watson", "'Multitude' by Stromae. Even if you don't speak French it's just an incredible production record."),
            ("diana.wagner", "Going to be predictable here: the new Big Thief live album. I know, I know."),
            ("craig.reed", "Not predictable, just correct."),
            ("samuel.palmer", "I've been deep in old Talk Talk — 'Spirit of Eden' is criminally underplayed."),
            ("joe.cruz", "'For Ever' by Jungle. Pure summer-evening energy."),
            ("lois.harper", "Boygenius — 'the record'. Still hasn't left my rotation since it dropped."),
        ],
    ),
    thread(
        "town-square", "robert.ward",
        "Quick PSA: we hit a transient 503 spike between 14:02–14:09 UTC. Root cause was a noisy neighbor in the shared cluster, not us. No customer impact reported but I'm watching the dashboards. Will write up in the SRE channel.",
        [
            ("ashley.berry", "Thanks for the heads up. Did the autoscaler kick in correctly?"),
            ("robert.ward", "Yes — scale-out triggered at 14:04, fully recovered by 14:09. Mean latency stayed under SLA the whole time."),
            ("lori.carter", "Should we open a ticket with the platform team about the noisy neighbor?"),
            ("robert.ward", "Already filed. They're tracking it on their side. I'll link the ticket in the postmortem."),
        ],
    ),
    thread(
        "town-square", "diana.wagner",
        "We officially shipped v2.4 to GA this morning :tada: Huge thanks to everyone who helped land the migration work — it was a long road. Special shout-outs in thread.",
        [
            ("diana.wagner", "@bobby.watson for owning the schema migration end-to-end. Three months of careful work."),
            ("diana.wagner", "@craig.reed for the rollout tooling — the gradual ramp saved us from a real incident on day 1."),
            ("diana.wagner", "@joe.cruz and @kimberly.george for the UI polish in the final week. The before/after is night and day."),
            ("bobby.watson", "Thanks Diana. Honestly the migration was 90% the schema review process from @keith.ryan — caught the foreign-key issue that would have torpedoed us."),
            ("keith.ryan", "Team effort. Happy to see it land."),
            ("ashley.berry", "Congrats all! Looking forward to building on this foundation."),
        ],
    ),

    # ─── ~2h ago: starting to ramp toward the demo ───────────────────────
    thread(
        "demo-channel", "joe.cruz",
        "Heads up: webpack is throwing a deprecation warning about `mixed-decls` in `_sidebar-right.scss`. Not blocking but it's noisy in the dev console. Worth a follow-up ticket?",
        [
            ("samuel.palmer", "Yeah it's a Sass 2.x thing. The fix is wrapping the declaration in `& {}`. I can take a pass after the demo."),
            ("kimberly.george", "There are like 11 more of those repeated warnings hidden behind 'repetitive deprecation warnings omitted'. Whole batch is the same pattern."),
            ("joe.cruz", "Cool, opening a ticket. Linear or here?"),
            ("samuel.palmer", "Linear please. Tag me on it."),
        ],
    ),
    thread(
        "off-topic", "kimberly.george",
        "Weekend recs! I'm finally taking Saturday fully off. Open to anything: hike, museum, movie, board game cafe, whatever. What did people do recently that they actually liked?",
        [
            ("karen.austin", "Saw 'Past Lives' at the Roxie last weekend. Quiet but very good. Worth a Saturday afternoon."),
            ("joe.cruz", "If the weather holds: the Marin Headlands trail loop. ~2 hours, big views, not too gnarly."),
            ("ashley.berry", "Board game cafe rec: Mox on Mission. They have a way better selection than the bigger chain places."),
            ("kimberly.george", "Roxie + headlands hike is the plan now. Thank you 🙏"),
            ("karen.austin", "Report back!"),
        ],
    ),
    thread(
        "town-square", "sysadmin",
        ":mega: Reminder: all-hands tomorrow at 10am PT. Agenda is in the shared doc. Please drop questions in this thread ahead of time so we can batch them.",
        [
            ("gerald.gomez", "Will the recording be posted same-day? Some of us in EMEA can't make the live slot."),
            ("sysadmin", "Yes — same-day, in the #all-hands-recordings channel. We're also publishing the deck as a doc afterward."),
            ("karen.austin", "Any update on the Q3 hiring freeze guidance?"),
            ("sysadmin", "Touching on it briefly. The TL;DR: critical roles only, formal request process via your director. We'll publish the policy doc right after the meeting."),
            ("robert.ward", "Will we cover the on-call rotation changes? There were a few unanswered questions from the last review."),
            ("sysadmin", "Yes, that's on the agenda. Bringing in the SRE lead for the last 10 min."),
            ("lois.harper", "Can we get a 5-min Q&A at the end about the new perf review template? Lots of confusion on the team."),
            ("sysadmin", "Adding it. Thanks for flagging."),
        ],
    ),

    # ─── ~1h ago: demo planning kicks off ────────────────────────────────
    thread(
        "demo-channel", "yvette",
        "Hey team — I just filed a batch of Linear tickets for the Cursor demo. Six feature ideas in YVE-5 through YVE-10. Wanted to get a read on which one to lead with for the live build.",
        [
            ("ashley.berry", "Skimmed them — YVE-7 (Unread Thread Summary) is the cleanest IMO. Visible, scoped, and the agent has to navigate real component layers."),
            ("craig.reed", "+1 on Unread Summary. AI Command Palette (YVE-6) feels flashier but the surface area is bigger. Riskier for a live demo."),
            ("diana.wagner", "I'd vote Unread Summary too. Bonus: you can fall back to Action Items (YVE-8) if there's time — they share a lot of the thread-pane plumbing."),
            ("keith.ryan", "What about Reaction Heatmap (YVE-9)? Lower stakes, lots of visible payoff."),
            ("ashley.berry", "Heatmap is fun but doesn't show the 'find files / navigate codebase' part as well. The summary button forces the agent to actually understand the data model."),
            ("yvette", "OK — leading with YVE-7. I'll keep YVE-9 as a backup if we have headroom. Anyone want to take a stab at the design while I prep the prompt?"),
            ("diana.wagner", "I'll mock something quick in Figma. Give me ~30 min."),
        ],
    ),
    thread(
        "demo-channel", "bobby.watson",
        "Quick question before we kick this off: are we doing the demo against this `demo` team or one of the sample teams? The threading in ad-1 has more posts but this one has the people watching the demo in it.",
        [
            ("yvette", "Let's stay in `demo`. I just seeded users + threads here so the audience sees themselves in the member list. Feels less canned."),
            ("bobby.watson", "Perfect, that's what I'd want too."),
            ("lori.carter", "Should we pin a 'demo script' post to town-square so the audience can follow along?"),
            ("yvette", "Good idea. I'll write one up and pin it before the dry-run."),
        ],
    ),

    # ─── ~30m ago: design + product context, with @yvette mentions ───────
    thread(
        "demo-channel", "ashley.berry",
        "@yvette quick question — do you want the Unread Thread Summary button to live in the thread *header* or down in the reply composer? Mocking it both ways and they pull in slightly different components.",
        [
            ("diana.wagner", "Header is more discoverable IMO. Composer feels like you have to be 'in the conversation' before you realize it exists."),
            ("ashley.berry", "Yeah that's where I landed too. Just wanted a second opinion before I commit."),
            ("craig.reed", "Header. Also matches the pattern of the existing 'mark as unread' control."),
            ("ashley.berry", "@yvette your call ultimately though — happy to go either way."),
        ],
    ),
    thread(
        "demo-channel", "diana.wagner",
        "Figma mock for the summary panel: https://figma.com/file/abc123/Cursor-Demo — feedback welcome. @yvette I left a couple of comments on the loading state, would love your eyes when you get a sec.",
        [
            ("yvette", "Looking now."),
            ("diana.wagner", "Specifically — should the skeleton match the message bubble shape or be a generic 3-line shimmer? I went generic but I'm second-guessing."),
            ("joe.cruz", "Generic shimmer is probably right. Bubble-shaped skeleton tends to read as 'real message that's still loading' which is misleading."),
            ("diana.wagner", "Good point. Sticking with generic."),
        ],
    ),
    thread(
        "town-square", "kimberly.george",
        "Product weekly is moving from Tuesday 11am to Wednesday 2pm starting next week (calendar invites going out today). @yvette flagging in case you wanted to start joining — happy to add you.",
        [
            ("yvette", "Yes please — I'd like to attend at least the first couple while I'm ramping."),
            ("kimberly.george", "Added you, you'll see it on your calendar in a few minutes."),
            ("karen.austin", "Are we still doing the async pre-read? The 30 min in-meeting context dump last week was rough."),
            ("kimberly.george", "Yes — async pre-read is staying. Will be stricter about 'come having read it' from here on."),
            ("yvette", "Where does the pre-read live, in case I want to skim past ones?"),
            ("kimberly.george", "Shared drive → Product → Weekly Notes. I'll DM you the link."),
        ],
    ),

    # ─── ~15m ago: ops + dry-run ─────────────────────────────────────────
    thread(
        "town-square", "robert.ward",
        "Heads up everyone: planned maintenance window tomorrow 9-10pm PT. Brief Mattermost downtime (~5 min) while we cut over to the new auth proxy. @yvette — sharing this with you in particular since the demo is the same week, want to make sure it doesn't land mid-rehearsal.",
        [
            ("yvette", "Thanks for the flag — that's well outside the dry-run window, we're good."),
            ("robert.ward", "Cool. I'll post here when we start and when we're back."),
            ("lori.carter", "Will the SSO redirect change as part of this?"),
            ("robert.ward", "URL is the same. Just the backend handler is new. Should be a no-op from a user perspective."),
        ],
    ),
    thread(
        "demo-channel", "bobby.watson",
        "Dry-run prep checklist (let me know what's missing):\n  * Browser refreshed, cache cleared\n  * `make run` healthy, postgres + redis up\n  * Linear board open in second tab (YVE-5 through YVE-10)\n  * Figma open with the summary mock\n  * Recording app armed\n\n@yvette anything else you want pre-staged?",
        [
            ("yvette", "Add: have the Cursor agent panel open and pre-pointed at server/channels. Saves the 5-second navigate at the start."),
            ("bobby.watson", "Done."),
            ("samuel.palmer", "Also worth: have a 'dummy' channel with a few unread messages ready so the summary button has something to summarize on first click."),
            ("bobby.watson", "Smart. Will pin a fresh test thread right before we start."),
            ("yvette", "Perfect."),
        ],
    ),

    # ─── ~5m ago: most recent, lands at the very bottom of the scrollback ─
    thread(
        "town-square", "sysadmin",
        ":wave: Welcome @yvette to the team! Folks, drop your intros + a fun fact in this thread.",
        [
            ("ashley.berry", "Welcome! I'm Ashley — work mostly on the frontend, currently obsessed with thread infinite-scroll perf. Fun fact: I'm learning Mandarin (very slowly)."),
            ("bobby.watson", "Welcome @yvette! Bobby here, backend / data. Fun fact: I make hot sauce at home, will bring some in."),
            ("diana.wagner", "Welcome :) — Diana on design. Fun fact: I have a cat named Latency."),
            ("craig.reed", "Latency is a top-tier cat name and I won't be topping it. Welcome @yvette!"),
            ("kimberly.george", "Welcome! Kim from product. Fun fact: ran the LA marathon in March, will probably not do it again."),
            ("yvette", "Thanks all 💚 fun fact: I once accidentally pushed `rm -rf /` … to a Hello World test repo. The fear has not left me."),
            ("samuel.palmer", "That's a great fun fact actually. Welcome!"),
        ],
    ),
]


SAMPLE_USERS = {
    "yvette",
    "ashley.berry", "bobby.watson", "craig.reed", "diana.wagner",
    "gerald.gomez", "joe.cruz", "karen.austin", "keith.ryan",
    "kimberly.george", "lois.harper", "lori.carter", "robert.ward",
    "samuel.palmer", "sysadmin", "guest", "user-1",
}


def _check_authors() -> None:
    bad = set()
    for _, author, _, replies in THREADS:
        if author not in SAMPLE_USERS:
            bad.add(author)
        for user, _ in replies:
            if user not in SAMPLE_USERS:
                bad.add(user)
    if bad:
        print(f"Unknown usernames referenced: {sorted(bad)}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    _check_authors()

    lines: List[str] = []
    lines.append(json.dumps({"type": "version", "version": 1}))

    # Spread root posts across the past ~3h, ordered oldest -> newest in THREADS.
    # Newest threads land at the bottom of the channel scrollback in the UI.
    total_span_ms = 3 * HOUR_MS
    step_ms = total_span_ms // max(len(THREADS), 1)
    base = NOW_MS - total_span_ms - 5 * MIN_MS

    for i, (channel, author, message, replies) in enumerate(THREADS):
        thread_start = base + i * step_ms
        reply_objs = []
        for j, (ruser, rmsg) in enumerate(replies):
            reply_objs.append({
                "user": ruser,
                "message": rmsg,
                "create_at": thread_start + (j + 1) * (90 * 1000 + j * 17 * 1000),
                "props": dict(SEED_MARKER),
            })

        post = {
            "team": TEAM,
            "channel": channel,
            "user": author,
            "message": message,
            "create_at": thread_start,
            "props": dict(SEED_MARKER),
            "replies": reply_objs,
        }
        lines.append(json.dumps({"type": "post", "post": post}))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    total_replies = sum(len(t[3]) for t in THREADS)
    print(f"Wrote {len(THREADS)} threads ({total_replies} replies) to {OUT}")


if __name__ == "__main__":
    main()
