// Benchmark: gpt-4o-mini vs gpt-4o on negation + self-reference in structured
// extraction from dating-profile free text (Hebrew + English).
//
// Both models get the IDENTICAL hardened prompt at temperature 0 with JSON
// mode, so the model is the only variable. Run:
//
//   OPENAI_API_KEY=sk-... node eval.js
//
// Writes results.json and prints a per-case table + summary.

const fs = require('fs');
const path = require('path');

const MODELS = ['gpt-4o-mini', 'gpt-4o'];
const VOCAB = ['smoker', 'heavy_drinker', 'has_pets', 'dislikes_pets', 'ambitious', 'homebody'];
const MARITAL_ENUM = ['single', 'divorced', 'separated', 'widowed', 'complicated'];

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));

const SYSTEM_PROMPT =
  'You convert dating-profile free text into structured tags. You ONLY use tags from the provided controlled vocabulary. You understand negation (e.g. "I don\'t smoke" means the person is NOT a smoker). Output strict JSON.';

function userPrompt(text) {
  return `Controlled vocabulary (use ONLY these exact tags):
${VOCAB.join(', ')}

User's free text (may describe themselves AND/OR what they require of a partner):
"${text}"

Return JSON with exactly these fields:
{
  "dealbreakers": [{ "trait": "a vocabulary tag", "polarity": "must" | "must_not" }],
  "excludedMaritalStatuses": ["subset of: ${MARITAL_ENUM.join(', ')} -- the partner relationship statuses the user says they will NOT date"]
}

Rules:
- Use ONLY tags that appear in the controlled vocabulary. Drop anything that doesn't map cleanly.
- excludedMaritalStatuses: include a status ONLY when the text EXPLICITLY rules out dating a partner who is in that relationship status. Note there is NO "married" value -- if they exclude married people, that concept has no tag here, so simply omit it (still capture the other statuses if mentioned).
- Hebrew relationship-status words map like this: רווק/רווקה = single, גרוש/גרושה = divorced, פרוד/פרודה = separated, אלמן/אלמנה = widowed, נשוי/נשואה = married (NO tag -- omit). Phrasing like "לא X", "לא מעוניין/ת ב-X", "בלי X" means the user EXCLUDES status X.
- CRITICAL: do NOT exclude a status merely because the USER THEMSELVES is that status. Only the partner statuses they refuse count. (e.g. "I'm divorced and happy to date divorced people" -> exclude NOTHING.)
- dealbreakers describe what the user requires of a PARTNER. A statement about the user themselves ("I don't smoke") is NOT a dealbreaker.
- "must" means the partner MUST have this trait; "must_not" means the partner must NOT have it.
- BE CONSERVATIVE: only include a tag when the text EXPLICITLY and clearly supports it. Do NOT infer, guess, or add tags that are merely plausible. When in doubt, leave it out.
- If a field has no clear mappable content, return an empty array for it.
- Output ONLY the JSON object.`;
}

async function callModel(model, text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(text) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${model} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content);
}

// Order-insensitive set equality.
const setEq = (a, b) => {
  const A = [...new Set(a)].sort();
  const B = [...new Set(b)].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};
const dbKey = (d) => `${d.trait}:${d.polarity}`;

function score(expected, got) {
  const gotDb = Array.isArray(got.dealbreakers) ? got.dealbreakers.filter((d) => d && d.trait && d.polarity).map(dbKey) : [];
  const gotMs = Array.isArray(got.excludedMaritalStatuses) ? got.excludedMaritalStatuses : [];
  return {
    maritalOk: setEq(expected.excludedMaritalStatuses, gotMs),
    dealbreakersOk: setEq(expected.dealbreakers.map(dbKey), gotDb),
  };
}

(async () => {
  if (!process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY');
  const results = [];

  for (const c of cases) {
    const row = { id: c.id, lang: c.lang, field: c.field, text: c.text, expected: c.expected, models: {} };
    for (const model of MODELS) {
      const got = await callModel(model, c.text);
      const s = score(c.expected, got);
      row.models[model] = { got, ...s, pass: s.maritalOk && s.dealbreakersOk };
    }
    results.push(row);
    const cells = MODELS.map((m) => `${m}: ${row.models[m].pass ? 'PASS' : 'FAIL'}`).join(' | ');
    console.log(`#${String(c.id).padStart(2)} [${c.lang}] ${cells}  ${c.text.slice(0, 60)}`);
  }

  console.log('\n================ SUMMARY ================');
  for (const model of MODELS) {
    const all = results.length;
    const pass = results.filter((r) => r.models[model].pass).length;
    const he = results.filter((r) => r.lang === 'he');
    const hePass = he.filter((r) => r.models[model].pass).length;
    const traps = results.filter((r) => /TRAP/i.test(cases.find((c) => c.id === r.id).note || ''));
    const trapPass = traps.filter((r) => r.models[model].pass).length;
    console.log(`${model.padEnd(12)} overall ${pass}/${all}  hebrew ${hePass}/${he.length}  traps ${trapPass}/${traps.length}`);
  }

  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
  console.log('\nWrote results.json');
})();
