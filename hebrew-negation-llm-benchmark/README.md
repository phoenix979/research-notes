# GPT-4o-mini vs GPT-4o on Hebrew negation in structured extraction: a production bug turned benchmark

*Eliran Kdoshim — November 2026. Reproducible: [`cases.json`](cases.json) (24 labeled cases), [`eval.js`](eval.js) (runner), [`results.json`](results.json) (raw model outputs). Run it yourself: `OPENAI_API_KEY=sk-... node eval.js` — 48 API calls, a few cents.*

## The production bug

My dating app ([WhisperYes](https://play.google.com/store/apps/details?id=com.whisperyes.app)) asks users two free-text questions during onboarding — who they are, and their dealbreakers in a partner — mostly answered in Hebrew. An LLM converts the text into structured matching signals: trait tags from a controlled vocabulary, plus a hard filter of **excluded marital statuses** (`single / divorced / separated / widowed / complicated`).

A hard filter is the worst place for an extraction error. If the model wrongly excludes "divorced," the user silently never sees divorced candidates — in a small market, that can empty their deck entirely, and nobody gets an error message.

GPT-4o-mini, my default model for cost reasons, produced exactly that failure, in two flavors:

1. **Negation misreads** — Hebrew negation ("לא פרוד" — *not separated*) parsed incorrectly.
2. **Self-status projection** — the killer. A user wrote: *"אני גרושה ובשמחה אצא עם גרוש"* ("I'm divorced and would happily date a divorced man"). Mini excluded `divorced` — turning an explicit *inclusion* into a hard *exclusion*, for the very population she asked for.

The fix in production was two changes at once: a hardened prompt (explicit Hebrew mappings, explicit "the user's own status is not an exclusion" rule) **and** routing this one task to GPT-4o at temperature 0. Which raised a question the incident couldn't answer: *was the model upgrade actually necessary, or did the prompt fix do all the work?*

This benchmark isolates the variable: **both models, identical hardened prompt, identical temperature-0 JSON-mode calls.** The only difference is the model.

## Method

24 hand-labeled cases (14 Hebrew, 10 English), in four deliberate categories:

- **Plain exclusions** — "לא רוצה גרושים" → `["divorced"]`
- **Self-status traps** — "אני פרודה כרגע" (*I'm currently separated*) → exclude nothing
- **No-inference traps** — "I love quiet nights in" → no tags (the model must not invent)
- **Mapping edge cases** — "לא נשוי" excludes *married*, which has **no tag** in the enum and must be silently dropped, while statuses mentioned alongside it still count

Scoring is exact set-match per field (order-insensitive), per case. The prompt includes the same defenses as production: controlled vocabulary only, explicit negation examples, Hebrew status-word mappings, a CRITICAL self-status rule, and "when in doubt, leave it out."

## Results

| model | overall | Hebrew cases | trap cases |
|---|---|---|---|
| gpt-4o-mini | 20/24 (83%) | 10/14 | 5/8 |
| gpt-4o | **23/24 (96%)** | **13/14** | **7/8** |

The headline isn't the three-point… thirteen-point gap. It's **where** the failures land. Every one of mini's four failures is in the dangerous category — even with the hardened prompt explicitly warning against each one:

| # | input | mini's output | why it's bad |
|---|---|---|---|
| 4 | "אני גרושה ובשמחה אצא עם גרוש" | excluded `single` | hallucinated an exclusion from a sentence containing an explicit inclusion — the verbatim production case, still failing after the prompt fix |
| 10 | "אני פרודה כרגע" (*I'm currently separated*) | excluded `separated` | self-status projected onto the partner filter — would hide every separated candidate from a separated user |
| 12 | "בלי סטטוס מסובך" (*no complicated status*) | excluded nothing | missed a real exclusion (the only under-extraction) |
| 24 | "אני מעשנת ומחפשת מישהו שזה לא מפריע לו" (*I smoke, looking for someone who doesn't mind*) | dealbreaker: `smoker must_not` | inverted the user's intent — a smoker who'd accept smokers would never be shown one |

So the answer to the incident question is: **no, the prompt fix alone was not enough.** The hardened prompt, with the self-status rule spelled out in capital letters, still loses 3-of-8 traps on mini. The model upgrade was load-bearing.

**The honest wrinkle:** GPT-4o is not immune. Its single failure (#18, "אני לא שותה" — *I don't drink*) projected a self-statement into a partner dealbreaker (`heavy_drinker must_not`) — the same error class, lower rate. Mini, amusingly, passed that case. One run at temperature 0 per case; n=24 is a probe, not a leaderboard.

## The engineering conclusion: layers, not trust

The model choice was only one of three defenses that ended up in production, because 96% is still not 100% on a hard filter:

1. **Right-size the model to the blast radius.** This extraction runs *once per quiz save* — upgrading it to GPT-4o costs effectively nothing at my volume. Meanwhile the chatty, high-volume, low-stakes features (group-chat icebreakers, reply suggestions) stay on mini. "Which model" is a per-task decision weighted by the cost of being wrong, not a global setting.
2. **Deterministic validation after the model.** Every returned tag is checked against the vocabulary; hallucinated enum values are dropped; if the model returns a trait and its logical opposite, *both* are dropped (a contradiction means neither can be trusted).
3. **Graceful degradation.** Any failure — API down, bad JSON, empty key — returns empty signals, and matching proceeds on structured quiz data alone. The LLM can only ever *add* filters it's confident about; it can never be a single point of failure.

## Reproduce / extend

```
OPENAI_API_KEY=sk-... node eval.js
```

`eval.js` is ~130 lines with no dependencies (Node 18+). Add cases to `cases.json`, add model names to the `MODELS` array (any Chat Completions-compatible endpoint), and the summary table recomputes. Raw per-case model outputs land in `results.json`.
