// POST /api/bootstrap
// One-time: seeds the Blobs store with the original sample content
// so the site doesn't launch empty. Protected by a secret header so
// it can only be called by the site admin.
//
// Requires env var BOOTSTRAP_SECRET to be set. Call with:
//   curl -X POST -H "x-bootstrap-secret: $SECRET" https://site.netlify.app/api/bootstrap

import { getStore } from "@netlify/blobs";

const ADMIN_SUB = "system-seed";
const ADMIN_NAME = "EndoWiki seed";

const articles = [
  {
    slug: "root-canal-treatment--by-endowiki-seed",
    title: "Root canal treatment — an overview",
    summary:
      "A practical, peer-level overview of nonsurgical endodontic treatment: indications, workflow, evidence.",
    tags: ["rct", "overview"],
    body: `**Root canal treatment (RCT)**, also known as endodontic therapy, is the clinical procedure that removes infected or inflamed dental pulp, disinfects the root canal system, and seals it to prevent reinfection.

## Indications

- Irreversible pulpitis (confirmed clinically)
- Pulp necrosis, with or without periapical pathology
- Teeth requiring post-and-core build-up where the pulp is compromised
- Elective devitalization for restorative reasons

Contraindications are largely anatomical or prosthetic: unrestorable tooth structure, severe periodontal compromise, vertical root fracture.

## Workflow

Each step deserves its own article — diagnosis, isolation, access, working length, shaping, irrigation, obturation, restoration.

## Outcomes

Modern literature puts single-visit nonsurgical endodontic treatment success at **~90% for vital teeth** and **~80% for teeth with pre-existing apical periodontitis**. Success depends heavily on coronal restoration quality, rubber dam isolation, adequate shaping, disinfection, and obturation.`,
  },
  {
    slug: "apex-locators--by-endowiki-seed",
    title: "Apex locators: how they work and when to trust them",
    summary: "Generations, accuracy, workflow, and practical pitfalls.",
    tags: ["apex-locator", "working-length"],
    body: `**Electronic apex locators (EALs)** determine the position of the root canal terminus by measuring electrical properties of the tissues around the file tip.

## How they work

Modern 4th–5th generation devices measure impedance at multiple frequencies simultaneously. They're accurate to within ±0.5 mm of the minor apical foramen in ~95% of cases — better than periapical radiography alone.

## Practical tips

- Pre-flare the coronal two-thirds before measuring
- Dry the pulp chamber before insertion
- Use the smallest file that binds at the apex
- Recheck after irrigation and shaping
- Don't trust a reading that moves

## When to confirm radiographically

Only when the reading is unstable, anatomy is unusual, or medicolegal documentation requires it. Routine confirmation is not supported by current evidence.`,
  },
  {
    slug: "irrigation-protocols--by-endowiki-seed",
    title: "Irrigation protocols for predictable disinfection",
    summary:
      "Hypochlorite, EDTA, chlorhexidine — core solutions, a reasonable default protocol, and agitation options.",
    tags: ["irrigation", "disinfection"],
    body: `Shaping creates space. **Irrigation is what actually disinfects.** The instruments cannot reach the isthmuses, fins, lateral canals, and apical deltas where bacteria persist — the irrigant has to.

## Core solutions

**Sodium hypochlorite (1–5.25%)** — primary irrigant. Tissue dissolution + antimicrobial. Contact time matters more than concentration.

**EDTA 17%** — final rinse (1 min). Smear layer removal.

**Chlorhexidine 2%** — optional final antimicrobial in retreatment. Do not mix with hypochlorite.

## Default protocol

Throughout shaping: 3% NaOCl, continuous, refreshed every 1–2 min, side-vented needle 2 mm short. Saline flush → 17% EDTA 1 min → saline flush → 3% NaOCl 3 min with agitation.

Target ≥30 minutes of NaOCl contact for infected cases.

## Agitation

Sonic (EndoActivator), passive ultrasonic (PUI), multisonic (GentleWave) — all ~double the antimicrobial effect versus static irrigant.`,
  },
  {
    slug: "rotary-vs-reciprocating--by-endowiki-seed",
    title: "Rotary vs reciprocating files: what the evidence shows",
    summary: "Both systems produce clinically comparable outcomes when used correctly.",
    tags: ["files", "shaping"],
    body: `**Short version:** both systems produce clinically comparable outcomes when used correctly. The "best" system is the one you are fluent with — operator familiarity beats small differences in file design.

## Evidence summary

- **Canal centering:** modern heat-treated systems perform similarly.
- **File separation:** reciprocating motion reduces cyclic fatigue stress at comparable load, but most separations are operator error.
- **Debris extrusion:** reciprocating pushes slightly more apically in lab studies; clinical relevance unclear.
- **Clinical outcomes:** RCTs show no significant difference in healing or symptom resolution at 1–2 years.

## Guidance

- Pick one system from either category and learn it thoroughly.
- If experienced with one, switching buys very little.
- For retreatment, rotary with varied tapers is often more useful.
- Never reuse a file that has been through a difficult case.`,
  },
];

const courseReviews = [
  {
    slug: "styleitaliano-endodontics-masterclass--by-endowiki-seed",
    title: "Styleitaliano Endodontics Masterclass",
    rating: 5,
    provider: "Styleitaliano Endodontics",
    instructor: "Marco Martignoni, Arnaldo Castellucci, et al.",
    location: "Rome, Italy",
    format: "In-person hands-on",
    duration: "5 days",
    price: "~€3,200",
    pros: [
      "Live treatment demonstrations on actual patients — not mannequins",
      "Hands-on sessions on extracted teeth with real anatomy",
      "Small instructor-to-participant ratio (about 1:4 during hands-on)",
      "Strong emphasis on magnification and microsurgical skills",
      "Good balance between technique and decision-making",
    ],
    cons: [
      "Price is at the top of the European market",
      "Intense schedule — 10-hour days, limited downtime",
      "Heavy focus on the faculty's preferred NiTi systems",
      "Rome is expensive for accommodation",
    ],
    would_recommend: "yes",
    verdict:
      "The best endodontic hands-on I have taken. Worth the price if you want to seriously upgrade case selection and apical-third management.",
    body: `*Disclosure: paid standard course fee myself. No relationship with the organizers.*

## Who this is for

General dentists who already do endodontics regularly and want to move up a level — especially on molars and difficult anatomy. Not a beginner course.

## What worked

The faculty's willingness to show their own failures was the single most valuable thing. The hands-on anatomy bank was real — extracted teeth with calcified chambers, separated files, open apices. Small groups meant you could screw up on-camera under a microscope and get real feedback.

## What didn't

Price is a barrier. €3,200 + travel + lodging + lost practice income is easily a €5,000+ week.`,
  },
  {
    slug: "endo-mastery-online-ce--by-endowiki-seed",
    title: "Endo Mastery online CE",
    rating: 3,
    provider: "Endo Mastery",
    instructor: "Rotating faculty (recorded lectures)",
    location: "Online",
    format: "Online self-paced",
    duration: "~25 hours of content",
    price: "~$495",
    pros: [
      "Microscope footage is crisp and well-captioned",
      "CE credits accepted by most US state boards",
      "Per-hour cost is low",
      "You can watch, try the technique, and rewatch",
    ],
    cons: [
      "No hands-on component — the whole experience is passive video",
      "Some lectures feel like marketing for a specific file system",
      "Live Q&A sessions are in US timezones only",
      "Community / discussion forum is thin",
    ],
    would_recommend: "mixed",
    verdict: "Fine as a supplement. Do not expect it to replace a hands-on course.",
    body: `## Who this is for

Dentists who need CE credits on a budget and can't travel. Decent for theory, not for technique acquisition.`,
  },
];

const equipmentReviews = [
  {
    slug: "woodpex-iii-apex-locator--by-endowiki-seed",
    title: "Woodpex III apex locator",
    rating: 4,
    brand: "Woodpecker",
    model: "Woodpex III",
    category: "Apex locator",
    price: "~$140",
    duration_used: "~6 months, daily use",
    pros: [
      "Excellent accuracy for the price — matches high-end devices in routine cases",
      "Clear color display, visible under operatory light",
      "Rechargeable battery lasts a full week of busy endo days",
      "Build quality feels better than the price suggests",
    ],
    cons: [
      "Audio feedback tones are shrill",
      "Clip cables are shorter than ideal",
      "Wide-open apices give unreliable readings",
      "Manual is unhelpful for advanced features",
    ],
    would_recommend: "yes",
    verdict:
      "Outstanding value. Accuracy comparable to devices at 3× the price for routine endodontic cases.",
    body: `## What I was using before

A first-generation Root ZX. The Woodpex III is a direct upgrade at a fraction of the price.

## Value

At ~$140, this sits in "buy a spare" territory for most practices. If starting a practice today, I'd make this my primary locator and not feel any technical deficit compared to colleagues on Root ZX II units.`,
  },
  {
    slug: "x-smart-iq-endomotor--by-endowiki-seed",
    title: "X-Smart IQ endomotor",
    rating: 4,
    brand: "Dentsply Sirona",
    model: "X-Smart IQ",
    category: "Endomotor",
    price: "~$1,800",
    duration_used: "~10 months, several cases per week",
    pros: [
      "iPad app gives you a large, clean torque and speed display",
      "Cordless handpiece — no cable snag",
      "Pre-loaded torque / speed presets for most Dentsply systems",
      "Apical reverse and auto-stop work reliably",
      "Battery lasts a full clinical day",
    ],
    cons: [
      "You need the iPad — no unit-screen fallback",
      "Tied to Dentsply's ecosystem",
      "App has hung or lost pairing twice in 10 months",
      "Price is hard to justify if you're happy with a corded unit",
    ],
    would_recommend: "yes",
    verdict:
      "Premium product that genuinely improves ergonomics for high-volume endodontic practices. Overkill for occasional endo.",
    body: `## What I was using before

A corded X-Smart Plus. The IQ is a step-change in ergonomics but not in clinical outcomes — my shapes were fine on the old motor.

## Value

For a specialist or a generalist doing 10+ RCTs a week, the ergonomics add up over years. For a 2-per-week general dentist, overkill.`,
  },
  {
    slug: "zeiss-extaro-300-microscope--by-endowiki-seed",
    title: "Zeiss Extaro 300 microscope",
    rating: 4,
    brand: "Carl Zeiss Meditec",
    model: "Extaro 300",
    category: "Microscope",
    price: "~$38,000",
    duration_used: "~18 months, daily use",
    pros: [
      "Apochromatic optics — color fidelity is the best I've used",
      "Integrated fluorescence mode highlights caries and restorative margins",
      "Counterbalance arm holds position precisely",
      "Built-in 4K documentation camera with SD card slot",
      "Tissue illumination modes are best-in-class",
    ],
    cons: [
      "Learning curve on the illumination modes",
      "Zeiss service response can be slow in some regions",
      "Heavy — wall mount requires real engineering",
      "Fluorescence needs specific indicator dyes for full effect",
      "Top of the market price",
    ],
    would_recommend: "yes",
    verdict:
      "Best microscope I've worked with. If you can't justify the price, a Leica M320 or used Global G6 serves you almost as well.",
    body: `*Disclosure: purchased through a standard dealer. No special relationship with Zeiss.*

## What I was using before

A 2014 Global G6. The Extaro is a step up in optics and illumination, not in magnification range.

## Value

Starting out: do not buy a new Zeiss. Upgrading from a basic scope with capex to justify: excellent. Already have a good scope that works: case to upgrade is weak unless you specifically want fluorescence mode.`,
  },
];

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function seedOne(store, kind, record) {
  const key = `${kind}/${record.slug}`;
  const now = new Date().toISOString();
  const full = {
    kind,
    ...record,
    author_id: ADMIN_SUB,
    author_name: ADMIN_NAME,
    author_email: null,
    created_at: now,
    updated_at: now,
  };
  await store.setJSON(key, full);
  return {
    slug: record.slug,
    title: record.title,
    author_name: ADMIN_NAME,
    updated_at: now,
    ...(kind !== "article" ? { rating: record.rating } : {}),
  };
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "POST only" });
  }
  const provided = req.headers.get("x-bootstrap-secret");
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected || provided !== expected) {
    return json(401, { error: "Unauthorized" });
  }
  const store = getStore("content");
  const summary = { article: [], course: [], equipment: [] };

  for (const a of articles) summary.article.push(await seedOne(store, "article", a));
  for (const c of courseReviews) summary.course.push(await seedOne(store, "course", c));
  for (const e of equipmentReviews) summary.equipment.push(await seedOne(store, "equipment", e));

  // Write indexes
  for (const [kind, items] of Object.entries(summary)) {
    await store.setJSON(`__index/${kind}`, { items });
  }

  return json(200, { ok: true, seeded: { article: articles.length, course: courseReviews.length, equipment: equipmentReviews.length } });
};

export const config = {
  path: "/api/bootstrap",
};
