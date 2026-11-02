# Research notes

Measured, reproducible write-ups from building and operating [WhisperYes](https://play.google.com/store/apps/details?id=com.whisperyes.app), a dating app with a small, real user base — where every decision has to be cheap, honest, and reversible.

1. **[Can a synchronized push notification create liquidity in a small dating app?](synchrony-push-experiment/)** — a nine-week pre-registered experiment with a within-subject baseline, attribution checks, and a verdict the numbers forced: statistically real, product-inert. Data in [`windows.csv`](synchrony-push-experiment/data/windows.csv).

2. **[GPT-4o-mini vs GPT-4o on Hebrew negation in structured extraction](hebrew-negation-llm-benchmark/)** — a production bug turned into a 24-case, two-model benchmark isolating whether a prompt fix or a model upgrade did the work. Fully reproducible: `cases.json` + `eval.js` + raw `results.json`.
