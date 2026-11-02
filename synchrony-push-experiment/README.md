# Can a synchronized push notification create liquidity in a small dating app? A pre-registered experiment

*Eliran Kdoshim — November 2026. Data: [`data/windows.csv`](data/windows.csv). All numbers below come from read-only analysis scripts run against the production database of [WhisperYes](https://play.google.com/store/apps/details?id=com.whisperyes.app), a dating app I built and operate.*

## The problem

Small dating apps die of emptiness, not of bad features. With ~150–200 weekly active users, the probability that two mutually interested people are online *at the same time* is low — you like someone, they see it twelve hours later, the energy is gone.

So I tested the obvious intervention: **synchronize the audience.** Every Tuesday at 20:00 Israel time, every eligible user gets a push notification at the same moment. If it works, the app has a weekly "happy hour" where the room is actually full.

This is a write-up of nine experimental windows, run with pre-registered success criteria, a within-subject baseline, an attribution check, and — the part I care most about — an honest final verdict that the feature, while statistically real, is **not worth scaling**.

## Design decisions that mattered

**1. Reserve-then-send.** The server first writes a reservation row per targeted user, then attempts delivery and marks the outcome. This separates "did it deliver" from "did it work": across all nine windows, zero reservations were left unattempted, so a null result is a product result, not a wiring failure. Without this, a silent delivery bug is indistinguishable from "users don't care" — a failure mode that produces confident wrong conclusions.

**2. Within-subject baseline.** The success metric is not "how many people were online Tuesday 20:00" (a growing user base inflates that for free). It is: *of the exact people pushed this week, how many were present in that hour* — compared against **the same people's presence in the same hour on previous Tuesdays**. Growth cancels out; the comparison is each cohort against itself.

**3. Pre-registered criteria, written before data.** Three windows (Sep 1, 8, 15), then a verdict — no peeking-and-extending. When the three-window answer came back "suggestive, not significant," I allowed exactly **one** extension (windows 4+5), with the bar written down *before* the windows fired: pooled real-user presence ≥ 12 (vs ~6 expected) clears the 5% chance level. One extension, pre-committed, no more.

**4. Attribution.** Of everyone present in the window hour, how many were actually pushed? Early on this caught the crudest error: crediting people to the push who were there anyway.

## Results

| window | date | reserved | sent | fail % | pushed users present in hour | baseline (same people, prior Tuesdays) |
|---|---|---|---|---|---|---|
| 1 | Sep 1 | 145 | 130 | 10.3% | 2 | 3.8 |
| 2 | Sep 8 | 159 | 143 | 10.1% | 4 | 2.8 |
| 3 | Sep 15 | 170 | 145 | 14.7% | 6 | 3.0 |
| 4 | Sep 22 | 191 | 165 | 13.6% | 5 | 3.0 |
| 5 | Sep 29 | 197 | 176 | 10.7% | **9** | — |
| 6 | Oct 6 | 193 | 161 | 16.6% | 8 | — |
| 7 | Oct 13 | 200 | 164 | 18.0% | 4 | — |
| 8 | Oct 20 | 188 | 149 | 20.7% | 6 | 4.5 |
| 9 | Oct 27 | 171 | 133 | 22.2% | 2 | 4.8 |

**The pre-committed three-window verdict (Sep 16): not proven.** Pooled presence 12–13 vs 9.6 expected, ≈20% probability by chance alone. Counts this small are Poisson-noisy; single windows mean nothing, which is why the criteria pooled them.

**The extension verdict (Sep 30): the effect is real — and small.** Windows 4+5 pooled: 14 real pushed users present vs ~6 expected; the pre-registered bar of ≥12 was cleared, P ≈ 0.3–0.5%. So the push genuinely moves people: roughly **+3 extra people present per window**, out of ~150 sent notifications.

**The value read (Oct 7): real, but inert.** Statistical significance is not product value, so the next question was pre-registered too: do window attendees *do* anything? Measured against same-evening flanking hours (19:00–20:00 and 21:00–22:00, which holiday effects can't fake): attendees averaged **2.8 deck actions per person vs 4.4 and 9.0 in the flanks, and zero matches formed in seven consecutive window hours.** People showed up and stood around. Presence without action. The verdict I wrote in the log: *do not scale.*

The nominated mechanism (from a separate supply audit): the swipe decks themselves were stale — 83% of visible profiles belonged to users gone >14 days. A synchronized crowd in front of a dead inventory does nothing. Deck freshness is upstream of synchrony value; we fixed that lever next, and the push stays parked.

## The secondary finding I didn't plan: watching tokens die

The send-check column produced its own result. Delivery failure rate (stale FCM device tokens — users who uninstalled or whose tokens rotted) climbed monotonically: **10.3% → 10.1% → 14.7% → 13.6% → 10.7% → 16.6% → 18.0% → 20.7% → 22.2%** over nine weeks. Dead tokens accumulate in the eligible-audience window faster than organic re-engagement drains them. In week nine, more than one in five "reachable" users was a phone that no longer had the app. If you run push campaigns against a monthly-active audience and don't measure this, your real reach is quietly 20%+ smaller than your dashboard says.

## Three lessons on method

1. **Pre-registration is what kept window 5 honest.** Window 5 read 9-vs-baseline — easily a "it works!" headline if I'd been free to stop there. The pre-committed design forced pooling, and the pooled answer ("real, +3 people") led to the right next question ("do they do anything?") instead of a victory lap.
2. **Baselines rot.** From window 2 onward, "prior Tuesdays" increasingly contained *pushed* Tuesdays, so the baseline self-contaminates toward the treatment. By window 7 the clean pre-push baseline had aged out of the lookback entirely. Conveniently, the contamination is conservative (it inflates the baseline, biasing *against* the push), but any long-running within-subject design needs an explicit answer for this.
3. **Filter your own accounts, and your own behavior.** Window 3's raw read was inflated by a founder/test account (7 → 6 after filtering) — enough to flip "suggestive" to "significant" if unnoticed. From window 4 on, I also kept myself out of the app during the window hour: I knew the schedule, so my presence was observer contamination.

## Limitations

Counts of 2–9 people are brutally noisy even pooled; the ±3-people effect size has wide error bars. The hour-bucket metric undercounts (a 20:59 arrival and a 21:01 arrival land in different buckets). The "accidental control" (users selected but with failed delivery) is tempting and useless — their token is stale *because* they disengaged, so they're selected for absence. And this is one app, one geography, one audience size; the result is "synchrony didn't create value *at this liquidity*," not "synchrony never works."
