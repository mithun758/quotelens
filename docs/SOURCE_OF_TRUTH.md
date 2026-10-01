# QuoteLens: Product Source of Truth

Sep 30, 2026 · @Mithun Murali

## Purpose and scope

QuoteLens is a working prototype for the Aerchain PM take-home "Kill the Quote Spreadsheet". It covers one flow end to end: draft an RFx, collect messy supplier quotes, extract and normalise them, check whether each quote is still decision-worthy, interrogate the comparison in plain language, and reach a defensible award.

This document is the single source of truth for the build. Claude Code builds from it, and any change to workflows, screens or rules is made here first and logged in the Decision log.

**Deliverables:** a live hosted prototype, a Loom walkthrough of the analyst conversation, and a one-page note on decisions and exclusions. The deadline is 48 hours from receipt of the brief.

**The brief's one rule:** stub the plumbing, keep the AI loops real. Email is faked; extraction and reasoning are never faked, and no demo answer is hardcoded.

## Customer and personas

The customer is **Meridian Diagnostics**, a fictional diagnostics chain with 40 labs and collection centres across South India, headquartered in Bengaluru. It has about 2,500 employees and ₹800 crore revenue, and a four-person procurement team that buys through email, Excel and Tally.

**The event:** the annual IT refresh, 30 line items worth about ₹1.4 crore at last-cycle prices. Delivery goes to 3 regional hubs (Bengaluru, Chennai, Hyderabad). Suppliers must commit to India warranty and onsite support. All five suppliers are already onboarded, with GSTIN and contacts on file.

| Persona | Role | What they need from QuoteLens |
| --- | --- | --- |
| Priya | Category buyer, primary user | Turn five messy quotes into a comparison she trusts, fast, and recommend an award |
| Arjun | Head of IT, requester | Confirm whether substitute models meet the spec |
| Meera | Head of Commercial Finance, approver | An award memo she can approve without sending it back |

**Success for Meridian:** the comparison is ready in hours instead of three days, Meera approves the memo first time, and no number appears on screen without a source.

## Thesis and principles

**Thesis:** a quote can be correctly extracted, correctly normalised, and still be wrong for today's decision. QuoteLens shows the buyer both what each supplier offered and whether that offer is still safe to act on.

Positioning: QuoteLens is the Bid Analysis step of an Aerchain-style agent chain, run at the tactical tier where agents assist and buyers decide.

**Non-negotiable principles**

1. **The AI reads and reasons; code computes.** Every total, conversion, ranking and scenario is calculated by deterministic code. The model never does arithmetic that reaches the screen.
2. **No number without a source.** Every value links to the document, location and snippet it came from.
3. **Uncertainty is visible.** Every value is Extracted, Inferred or Missing. Inferred values carry a one-line reason. Missing values are never imputed or treated as zero.
4. **Every transformation is logged.** Currency, unit, pack-size and tax conversions each show their inputs, rate and source.
5. **The buyer decides.** The system surfaces exceptions, recommends and explains. It never awards on its own.
6. **No silent awards.** The award memo is blocked while it depends on an unconfirmed value or open flag, unless the buyer overrides with a typed reason that is logged.
7. **Nothing hardcoded.** Demo answers come from live model calls over the extracted data. Re-running extraction must reproduce the comparison.

## Evidence base

Every major product decision traces to one of the findings below. Vendor figures are marketing claims and are labelled as such.

**Trust is the constraint on AI in procurement**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Only 19% of IT application leaders have high or complete trust in their vendor's hallucination protection; only 15% are considering, piloting or deploying fully autonomous agents | [Gartner, 30 Sep 2025](https://www.gartner.com/en/newsroom/press-releases/2025-09-30-gartner-survey-finds-just-15-percent-of-it-application-leaders-are-considering-piloting-or-deploying-fully-autonomous-ai-agents) | Source link and confidence state on every value; the buyer decides, the system never awards |
| GenAI for procurement has entered the trough of disillusionment, with scepticism about AI-driven insights named as an obstacle | [Gartner, 30 Jul 2025](https://www.gartner.com/en/newsroom/press-releases/2025-07-30-gartner-says-generative-ai-for-procurement-has-entered-the-trough-of-disillusionment) | Analyst shows its tools and basis; number post-check on every answer |
| 74% of procurement leaders say their data isn't AI-ready (attributed to Gartner's 2025 CPO Leadership Vision) | [Art of Procurement](https://artofprocurement.com/blog/state-of-ai-in-procurement) | Missing values are never imputed; gaps become clarifications |
| Procurement workloads rising 8% while headcount and budgets fall; 56% have agentic AI at pilot or scale | [Hackett 2026 Key Issues study](https://info.ivalua.com/whitepaper/2026-hackett-group-procurement-key-issues) | Exceptions-first review queue, so buyer time goes only where judgement is needed |

**Aerchain today: the comparison and award steps are still manual**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Danone SOP (Nov 2025): buyers manually create the Quote Comparison and allocate business; auto-negotiation disabled while logic is revamped; generic reminders at 12 and 24 hours | [Aerchain support](https://support.aerchain.io/support/solutions/articles/82000921572-danone-autonomous-sourcing-in-aerchain) | QuoteLens targets exactly this step; negotiation is out of scope; clarifications are specific, not generic reminders |
| Quote Comparison scenarios: Best Quote, Best Supplier, Incumbent, Worst Quote, Best Quote Without Incumbent | [Aerchain support](https://support.aerchain.io/support/solutions/articles/82000909199-how-to-create-and-compare-scenario-quote-comparison) | Award scenarios reuse these names |
| Spend OS claims it normalises multilingual bids, flags non-compliant bids, and runs autonomy tiers from autonomous to buyer-led (vendor claim) | [spend.aerchain.io](https://spend.aerchain.io/) | Positioned as the Bid Analysis step at the tactical tier |
| No public material on low-confidence handling, supplier clarification, or explaining scores | Both research passes, 30 Sep 2026 | Confidence states, clarification loop and award memo are the differentiators |
| Reviewer notes "room to grow on the analytics side"; Contract and Analytics agents marked coming soon | [Gartner Peer Insights](https://www.gartner.com/reviews/product/aerchain-164583452) | Natural-language analyst over the comparison |
| Supplier onboarding uses a review loop (Under review, Requested, resubmitted); suppliers are onboarded before transacting | Aerchain supplier onboarding video | Suppliers are pre-onboarded; onboarding excluded |
| Cars24: PO turnaround cut from 8 to 10 days to 3 to 4 days; 95 to 99% adoption; value placed on GST reconciliation and audit; customer wants ChatGPT-style AI | Aerchain customer testimonial video | Cycle time framed as the headline benefit; audit trail and GST check built in; analyst chat |

**Competitors are converging on explainable awards**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Globality: every award recommendation comes with its reasoning (Glo 2.0, Sep 2026) | [Globality](https://www.globality.com/platform/) | Award memo explains why each alternative lost |
| Levelpath: agents produce ranked comparisons with plain-language award recommendations (Mar 2026) | [Business Wire](https://www.businesswire.com/news/home/20260324181418/en/Levelpath-Named-a-Representative-Vendor-in-2026-Gartner-Market-Guide-for-Sourcing-Applications) | Same bar, with evidence links added |
| Coupa launched Bid Comparison and Scenario Ranking agents (May 2026) | [Coupa](https://www.coupa.com/newsroom/coupa-launches-coupa-compose-and-catalyst-to-accelerate-agentic-ai-value-and-delivery-at-inspire-2026/) | Extraction alone is table stakes; trust and freshness carry the pitch |
| A Fairmarkit user asks for reports showing why to choose a supplier beyond price | [Capterra](https://www.capterra.com/p/174247/FairMarkIT/reviews/) | Memo covers terms, compliance and freshness alongside price |

**IT hardware prices are moving fast in 2026**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| ASUS India expects laptop prices up to 45% higher by Q3 2026 against December 2025, driven by memory costs | [Outlook Business](https://www.outlookbusiness.com/corporate/asus-sees-laptop-prices-rising-by-as-much-as-45-in-2026-on-memory-cost-spike) | Quote Freshness exists; laptops and desktops tagged memory-exposed |
| IDC India: prices already up 10 to 12%, with a further 8 to 10% expected (Mar 2026) | [91mobiles](https://www.91mobiles.com/hub/laptop-prices-india-could-rise-in-2026/) | Market movement thresholds set at 5% (Medium) and 10% (High) |
| Lenovo reportedly told customers all current quotations would expire on 1 January 2026 | [Tom's Guide](https://www.tomsguide.com/computing/ramageddon-lenovo-and-dell-tipped-to-raise-prices-soon) | Validity is extracted and checked against the approval timeline |
| OEMs under pressure to downgrade RAM in mid-range notebooks (TrendForce, via tech press) | Research pass 2, secondary sources | Substitute models checked attribute by attribute |

**Value leaks after the award**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Unfulfilled supplier obligations leak about 2% of spend at large enterprises | [McKinsey, Apr 2025](https://www.mckinsey.com/~/media/mckinsey/business%20functions/operations/our%20insights/mitigating%20procurement%20value%20leakage%20with%20generative%20ai/mitigating-procurement-value-leakage-with-generative-ai.pdf) | Award record positioned as the future reference for invoice checks |
| 3 to 5% savings erosion from unenforced negotiated terms | [EY, Sep 2026](https://www.ey.com/en_us/insights/consumer-products/how-procurement-can-find-new-sources-for-savings) | Same; named in Future direction |

**India-specific rules**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Input tax credit makes GST recoverable on business purchases | Standard GST treatment | Comparison on an ex-GST basis; GST rate errors flagged separately |
| Section 43B(h): payments to registered micro and small suppliers beyond 15 days (45 with agreement) lose tax deductibility | [Tally](https://tallysolutions.com/accounting/section-43b-h-msme-payment-rules-compliance/) | Payment terms shown beside price in the comparison |

**Primary research**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| PO creation is quick and system-generated; finding and researching vendors and negotiating are the hard parts | Interview, procurement professional at a large company | PO excluded; award memo feeds negotiation |
| Large companies prequalify suppliers, then run sealed bids via SAP SRM; quotes open only after the bid window closes | Same interview | Questionnaire gates eligibility; mid-size, email-based customer chosen so messy formats are realistic |
| IT buying is recurring and inventory-driven, with bulk orders placed for discounts | Same interview | Last-cycle prices seeded as the baseline |

**Industry context**

| Finding | Source | What it changes in QuoteLens |
| --- | --- | --- |
| Aerchain serves about 40 enterprise accounts; published spend figures conflict ($45B and $67B); raised $13M in Mar 2026 and an Infosys investment in Aug 2026 | User-supplied deep research report, 30 Sep 2026 | No spend figures quoted in the note |
| Agent features are becoming standard across SAP, Coupa, Zip, Fairmarkit, Pactum, ServiceNow and GEP; the highest-value gap is a decision-provenance layer for agent actions | Same report | "Better problem" framed as decision provenance |

## Workflow

The locked flow is RFx, supplier quotes, extraction, normalisation, comparison, Quote Freshness, analysis, award. It plays out in five acts.

1. **Create the RFx.** Priya describes the refresh in chat. The co-pilot asks follow-ups and drafts 30 line items with vendor-neutral specs, a quality questionnaire and commercial terms (validity, GST basis, delivery, warranty, payment). Priya edits and "sends"; sending is stubbed.
2. **Chaos arrives.** Five seeded supplier emails land with attachments: Excel, letterhead PDF, Word, phone photo and a one-line email. Each shows its processing status and lines found out of 30.
3. **AI creates order.** Extraction reads every document, maps items to the 30 RFx lines, and normalises to INR, per piece, ex-GST delivered. Only exceptions reach Priya's review queue. She accepts, corrects, or sends a clarification to the supplier.
4. **The twist.** Quote Freshness checks whether each quote is still decision-worthy: validity against the approval timeline, stale references, market movement and FX. The nominal L1 can become "reconfirm before award".
5. **Interrogate and award.** Priya questions the comparison in plain language, compares award scenarios, resolves blockers, and exports the award memo for Meera. Arjun signs off substitute models along the way.

The clarification loop is a single action: Priya clicks "Ask supplier", the system drafts a specific question, the cell shows Awaiting supplier, and a seeded reply is re-extracted by the real model to close it.

## Screens

The app has five screens for one seeded RFx. There is no RFx list and no separate inbox screen.

| # | Screen | What it must do |
| --- | --- | --- |
| 1 | RFx co-pilot | Chat on the left, live RFx draft on the right (lines, specs, questionnaire, terms). Every field editable. "Send to suppliers" button. |
| 2 | Quotes | Left rail: the five supplier emails with format, status and coverage (for example 27/30). Main pane: original document beside extracted values. Clicking a value highlights its source. Review queue shows only Inferred, Missing and flagged items ("7 items need you") with Accept, Correct and Ask supplier actions. |
| 3 | Comparison | 30 lines by 5 suppliers in INR, per piece, ex-GST delivered. L1 per line, coverage per supplier, confidence state per cell, flags, and a Freshness column per supplier. Hover any cell for its source and normalisation ledger. Tabs for questionnaire answers and attached documents. |
| 4 | Analyst | Chat panel docked beside the comparison. Answers as text, tables or charts, with cited cells, the basis used (basket and scenario) and the tools that ran. Excel and PDF export. |
| 5 | Award | Scenario comparison, the chosen award, savings versus L1 and last cycle, blockers still open, override log, and the exportable award memo for Meera. Stubbed buttons: "Send to negotiation" and "Convert to PO". |

A persistent header shows the RFx name, the as-of date, and a counter of open blockers.

## Data model

Thirteen entities, all in Postgres. Supplier master keeps only the fields the logic uses.

| Entity | Key fields |
| --- | --- |
| Rfx | id, title, category, need\_by\_date, approval\_days (default 10), terms (validity required, GST basis, delivery hubs, warranty, payment), status |
| LineItem | id, rfx\_id, line\_no, description, spec (JSON attributes), quantity, uom, acceptable\_equivalents, last\_cycle\_price\_inr |
| Supplier | id, name, gstin, state, default\_currency, is\_incumbent |
| Response | id, supplier\_id, received\_at, channel, body\_text, status, coverage\_count |
| Document | id, response\_id, file\_name, mime\_type, storage\_path, page\_count |
| ExtractedValue | id, response\_id, line\_item\_id, field, raw\_value, raw\_unit, raw\_currency, normalised\_value\_inr, confidence\_state (Extracted, Inferred, Missing), reason, source\_document\_id, source\_locator (page, cell, bounding box or text span), source\_snippet, status (auto\_accepted, needs\_review, confirmed, corrected) |
| NormalisationStep | id, extracted\_value\_id, step\_order, kind (fx, uom, pack\_size, gst, discount, freight), input, output, rate, rate\_source, rate\_date |
| QuoteTerms | id, response\_id, quote\_date, valid\_until, gst\_treatment, freight\_terms, warranty, payment\_terms, delivery\_days, references\_prior\_pricing |
| Flag | id, extracted\_value\_id or response\_id, type, severity, message, status (open, resolved, overridden) |
| Clarification | id, flag\_id, supplier\_id, question, reply\_text, status (awaiting, answered) |
| QuestionnaireAnswer | id, supplier\_id, question\_key, answer, pass\_fail, evidence\_document\_id |
| Award | id, rfx\_id, scenario, allocations (JSON), total\_inr, savings\_vs\_l1, savings\_vs\_last\_cycle, memo\_markdown, status |
| AuditEvent | id, actor (Priya, system, model), action, target, before, after, reason, created\_at |

Market and FX benchmark series are seeded tables (BenchmarkSeries, FxRate), labelled illustrative in the UI.

## Extraction, normalisation and confidence

Extraction is one model call per document, returning structured JSON against a fixed schema. Normalisation is deterministic code over that JSON.

**Extraction rules**

- Excel, Word and email text are converted to text before the call. PDFs and the phone photo go to the model as documents and images (vision).
- Every value returns with its source locator and verbatim snippet. A value without a snippet is rejected.
- The model maps each quoted item to an RFx line and states why. Unmatched items are listed, never dropped.
- The model also extracts quote-level terms: quote date, validity, GST treatment, freight, warranty, payment, delivery, and any reference to prior pricing ("same as last year").

**Confidence states**

| State | Meaning | Default handling |
| --- | --- | --- |
| Extracted | Read directly and unambiguously | Auto-accepted, click to source |
| Inferred | The model made a judgement (unit basis, footnote discount applied, handwritten digit, substitute model match), or the normalised price depends on a code-derived conversion (pack size, bundle split, GST-inclusive back-calculation) | Goes to review queue with a one-line reason; for conversions the reason states the conversion |
| Missing | Not quoted or unreadable | Never imputed, never zero; line excluded from that supplier's common-basket total |

**Normalisation basis:** INR, per piece, ex-GST, delivered to hub. Each step is stored as a NormalisationStep and shown in the ledger on hover, for example "USD 412.00 × 84.60 (illustrative rate, 30 Sep 2026) = ₹34,855" or "₹2,450 per pack of 10 = ₹245 per piece".

**Rules the code enforces**

- GST is compared ex-GST because input tax credit is recoverable. GST correctness is a separate flag (for example 28% quoted where 18% is expected).
- Footnote discounts apply only when their condition is met; otherwise they become Inferred with the condition shown.
- An ambiguous unit basis is never guessed. It becomes Inferred and is routed to Ask supplier.
- Totals are computed on the common basket (lines every supplier quoted) by default. A toggle shows all lines with gaps priced at the lowest other quote, labelled clearly.
- Substitute models are compared attribute by attribute against the RFx spec (meets, exceeds, deviates) and need Arjun's sign-off before they count.
- A bundle is split by subtracting the supplier's own standalone price for the other bundled line; the result is Inferred because the quote never states the split.
- FX conversion at the seeded as-of rate stays Extracted: the price is stated and the rate is on file, and the ledger shows both.

**Model and repeatability:** extraction uses structured outputs validated with zod and retries once on schema failure. The model does not accept a fixed temperature, so runs can differ; every full run is recorded with a snapshot, and /eval shows run-to-run variance as a known limitation alongside token use and cost per supplier and per run.

## Quote Freshness

Quote Freshness answers one question: can Priya still rely on this quote today? It is rule-based, and every rule that fires shows why. It reports risk and recommends an action; it never predicts supplier behaviour or adjusts a quoted price.

Why it matters now: ASUS India expects laptop prices up to 45% higher by Q3 2026 ([Outlook Business](https://www.outlookbusiness.com/corporate/asus-sees-laptop-prices-rising-by-as-much-as-45-in-2026-on-memory-cost-spike)), IDC India reports 10 to 12% rises already ([91mobiles](https://www.91mobiles.com/hub/laptop-prices-india-could-rise-in-2026/)), and Lenovo reportedly expired all open quotations on 1 January 2026 ([Tom's Guide](https://www.tomsguide.com/computing/ramageddon-lenovo-and-dell-tipped-to-raise-prices-soon)). A quote that was cheapest when submitted can be unavailable by the time Meera approves.

The as-of date is configurable and seeded as 30 September 2026. Approval is assumed to take 10 days (Rfx.approval\_days).

| Rule | Fires when | Severity | Recommended action |
| --- | --- | --- | --- |
| Validity vs approval | valid\_until falls before as-of date plus approval days | High | Reconfirm or extend validity before award |
| Validity missing | No validity stated anywhere in the quote | Medium | Ask supplier for validity |
| Old price basis | Document or price list dated more than 30 days before the as-of date (High above 90 days) | Medium or High | Request a current quote |
| Prior-pricing reference | Quote says prices are "same as last year" or similar | Medium | Show Meridian's last-cycle price as Inferred, and flag that market prices have moved since |
| Market movement | Line is tagged memory-exposed (laptops, desktops) and the illustrative memory benchmark moved more than 5% since the quote date (High above 10%) | Medium or High | Reconfirm pricing for those lines |
| FX movement | Quote is in a foreign currency and INR moved more than 1.5% since the quote date | Medium | Reconfirm rate or ask for an INR quote |

**Supplier status** is the worst severity across its rules: Fresh (none), Reconfirm (Medium), Stale (High). The comparison shows it as a column, and the analyst can exclude or include suppliers by status.

Example of what Priya sees:

> Supplier D is nominally L1 on 9 lines, but its rate card is dated 4 June 2026 and the memory benchmark has moved +11% since. Status: Stale. Request a current quote before treating it as L1.

## Analyst agent

The analyst is a Claude tool-use loop over the database. It plans which tools to call, reads their results, and explains them. Every number in its answer must come from a tool result.

| Tool | What it returns |
| --- | --- |
| get\_comparison | Normalised matrix, filtered by lines, suppliers or category |
| filter\_suppliers | Suppliers matching criteria: questionnaire pass, freshness status, coverage, incumbent |
| rank\_lines | L1, L2 and spread per line on a chosen basis |
| supplier\_totals | Totals per supplier on the common basket or all-lines basis |
| compute\_scenario | Best Quote, Best Supplier, Incumbent, Best Quote Without Incumbent, or a custom allocation, with totals and savings |
| compare\_last\_cycle | Price change per line and supplier against Meridian's last-cycle prices |
| get\_freshness | Freshness status and fired rules per supplier |
| list\_blockers | Open flags, Inferred values and clarifications that block the award |
| get\_source | Source document, locator, snippet and normalisation ledger for a cell |
| draft\_clarification | A specific question to a supplier for a given flag |
| make\_chart | Chart spec (bar or line) rendered by the UI |
| export | Excel or PDF of the current table or answer |

**Answer rules**

- Lead with the answer, then the table or chart.
- State the basis used: which basket, which scenario, which suppliers were excluded and why.
- If the answer depends on Inferred or Stale data, say so first.
- Show a collapsible "How I got this" list of tools called.
- A post-check compares every number in the answer text with the tool results. Any number not found is flagged in the UI.
- If a question cannot be answered from the data, say what is missing. Never estimate.

## Award scenarios, gating and memo

Scenarios use Aerchain's Quote Comparison vocabulary and are computed by code. Each shows total, savings versus L1, savings versus last cycle, suppliers involved, and open blockers.

| Scenario | Logic |
| --- | --- |
| Best Quote | Lowest normalised price per line across eligible suppliers (split award) |
| Best Supplier | Single award to the supplier with the highest coverage, then the lowest common-basket total |
| Incumbent | Everything to the incumbent supplier |
| Best Quote Without Incumbent | Best Quote with the incumbent excluded |
| Custom | Allocations set by Priya or requested through the analyst ("networking to C, the rest to B") |

Eligibility defaults: questionnaire passed and substitutes approved by Arjun. Priya can toggle both, and the scenario states what was included.

**Gating:** the memo cannot be generated while any line in the chosen scenario rests on an Inferred value, an open flag, or a Stale supplier. Priya can override a blocker with a typed reason, which is stored as an AuditEvent and printed in the memo.

**The award memo** (one page, for Meera) contains the recommended scenario and total, savings versus L1 and last cycle, why each alternative lost, assumptions (FX rate, basket, GST basis), freshness status, overrides with reasons, and open risks. Every figure links back to its cell. When a winning price rests on a prior-pricing reference ("same as last year"), the memo says so for that line and notes that the price may look cheap because it reflects last year's market, not today's. It exports as PDF and Markdown.

## Dataset

The seeded dataset is one RFx of 30 lines, five supplier responses in five formats, an 8-question questionnaire, attachments, last-cycle prices and illustrative benchmark series. Total at last-cycle prices is about ₹1.40 crore. Lines marked M are memory-exposed for Quote Freshness.

**Line items** (prices ex-GST, INR per piece)

| # | Item | Qty | Last cycle ₹ |
| --- | --- | --- | --- |
| 1 | Business laptop, Intel Core i5 (14th gen), 16 GB, 512 GB SSD, 14" (M) | 60 | 68,000 |
| 2 | Management laptop, Core i7, 32 GB, 1 TB SSD, 14" (M) | 10 | 1,05,000 |
| 3 | Laptop backpack | 70 | 1,200 |
| 4 | USB-C docking station | 40 | 14,000 |
| 5 | Lab desktop, Core i5, 16 GB, 512 GB SSD, small form factor (M) | 40 | 52,000 |
| 6 | Front-desk desktop, Core i3, 8 GB, 256 GB SSD (M) | 20 | 38,000 |
| 7 | 24" FHD monitor | 60 | 9,500 |
| 8 | 27" QHD monitor | 10 | 21,000 |
| 9 | Wired keyboard and mouse combo | 60 | 1,100 |
| 10 | Wireless keyboard and mouse combo | 70 | 2,200 |
| 11 | USB headset with mic | 50 | 2,500 |
| 12 | 1080p webcam | 20 | 4,500 |
| 13 | Mono laser printer, A4, network | 15 | 18,000 |
| 14 | Colour multifunction printer, A4 | 5 | 45,000 |
| 15 | Barcode label printer (specimen labels) | 20 | 22,000 |
| 16 | 2D barcode scanner | 40 | 6,500 |
| 17 | Online UPS, 1 kVA | 40 | 16,000 |
| 18 | Online UPS, 3 kVA | 6 | 55,000 |
| 19 | Surge protector, 6 socket | 60 | 900 |
| 20 | 24-port managed PoE switch | 8 | 65,000 |
| 21 | 8-port unmanaged switch | 20 | 3,500 |
| 22 | Wi-Fi 6 ceiling access point | 25 | 14,000 |
| 23 | Branch firewall (UTM) | 4 | 90,000 |
| 24 | Cat6 patch cable, 2 m | 400 | 120 |
| 25 | Cat6 cable box, 305 m | 10 | 9,500 |
| 26 | HDMI cable, 1.5 m | 100 | 350 |
| 27 | USB-C to HDMI adapter | 50 | 1,500 |
| 28 | External SSD, 1 TB (M) | 20 | 8,500 |
| 29 | NAS, 4-bay (one per hub) | 3 | 60,000 |
| 30 | Wall-mount network rack, 12U | 8 | 12,000 |

**Suppliers and planted anomalies**

| Supplier | Format | Coverage | Planted anomalies | Freshness outcome |
| --- | --- | --- | --- | --- |
| A. Prakash Distributors, Bengaluru (incumbent) | Excel ignoring the template | 30/30 | Own layout with merged headers and subtotal rows; laptop and backpack (lines 1 and 3) quoted as one bundle price; networking sheet quoted GST-inclusive while other sheets are ex-GST | Fresh (quote 22 Sep, valid 30 days) |
| B. Vertex Systems, Dell partner | Letterhead PDF | 28/30 (no firewall, no NAS) | Extra 4% discount in a footnote for orders above ₹25 lakh; UPS lines show 28% GST where 18% is expected | Stale (quote 24 Sep, valid 7 days, expires 1 Oct, before approval completes) |
| C. Nexa Integrators, Bengaluru | Word doc, commercials in paragraphs | 30/30 | Line 1 substituted with a 13th-gen Core i5; line 22 substituted with a Wi-Fi 5 access point (deviates); freight "at actuals" for Chennai and Hyderabad; ISO certificate attached but expired March 2026 | Fresh (quote 26 Sep, valid 15 days) |
| D. Sri Ganesh Computers, Bengaluru | Angled phone photo of a printed rate card | 20/30 | Patch cables priced per pack of 10; one handwritten price correction; no validity stated; no GST mention | Stale (rate card dated 4 Jun 2026; memory benchmark +11% since) |
| E. Lionbridge Tech Trading, Singapore | One short email | 27/30 (no UPS lines 17 and 18, no firewall) | USD prices for 6 lines in the body; "all other items same as last year's rates"; "freight extra"; no India warranty confirmation | Reconfirm (quote 14 Sep; INR moved 1.8% since; prior-pricing reference) |

**Questionnaire** (pass or fail per supplier): valid ISO 9001 certificate; OEM authorisation letter; India warranty with onsite support in all 3 cities; delivery within 21 days; GST registration; e-waste take-back; named escalation contact; two healthcare references. A and B pass. C fails on the expired ISO certificate and the missing OEM authorisation letter. D fails because it sends no certificate or OEM authorisation and answers nothing. E fails until clarified (no evidence, no India warranty, questionnaire unanswered) and passes once its clarification reply is re-extracted.

**Attachments:** ISO certificates (A, B, C expired), OEM authorisation letters (A, B), warranty letter (B). D sends none. E sends none with its quote; its clarification reply attaches a valid ISO 9001 certificate and an HP authorisation letter.

**Seeded clarification:** Priya asks E to confirm India warranty and quote lines 17, 18 and 23. E replies confirming a 3-year onsite India warranty on everything quoted, serviced in all three cities, declines the UPS and firewall lines, answers the rest of the questionnaire, and attaches its ISO 9001 certificate and HP authorisation letter. The reply and attachments are re-extracted by the model.

**Demo question 6 outcome** (checked by the seed generator): before E's clarification, the only qualified supplier that is not Stale is A, so the split awards everything to A, above last cycle. After the clarification, E qualifies and the split is A plus E: E wins both laptop lines plus 3 to 5 others (currently the dock, both monitors, HDMI cables and external SSDs), no more than 4 of which rest on its "same as last year" prices (currently HDMI cables and external SSDs), and A wins the rest. The A plus E total is below last cycle.

**Benchmarks (illustrative):** a weekly memory price index from June to September 2026 rising about 11% overall, and USD/INR moving from 83.10 on 14 Sep to 84.60 on 30 Sep.

## Architecture and stack

One Next.js app in TypeScript, deployed on Vercel, with Supabase for Postgres and file storage and Claude Sonnet for every AI loop. The AI loops call deterministic code through typed tools, so every number on screen is computed and repeatable.

&#91;embedded content: QuoteLens architecture · AI loops, deterministic code, services\]

Development is on a Mac (zsh). Secrets live in environment variables: ANTHROPIC\_API\_KEY, ANTHROPIC\_MODEL, NEXT\_PUBLIC\_SUPABASE\_URL, SUPABASE\_SERVICE\_ROLE\_KEY, DEMO\_PASSCODE and AS\_OF\_DATE (names as in CLAUDE.md). Charts render with Recharts; PDF export uses a server-side renderer.

## Demo script

The Loom runs about 6 minutes and follows the five acts. The analyst questions below run live; none of their answers is hardcoded.

1. **Act 1 (45 s):** Priya asks the co-pilot for a 30-line IT refresh across 3 hubs. Show the draft filling in, then Send.
2. **Act 2 (45 s):** Five responses arrive. Open the phone photo and the one-line email to show how messy they are.
3. **Act 3 (90 s):** Extraction runs. Click a price to see its source crop. Open the review queue: the per-pack cable price, the footnote discount, the bundled laptop line, the substitute models. Accept one, correct one, and send "Ask supplier" to E; show the reply updating the comparison.
4. **Act 4 (60 s):** The comparison shows D as nominal L1 on several lines, then its Stale status and the rule that fired. B shows validity expiring before approval.
5. **Act 5 (120 s):** Analyst conversation, then award.

**Analyst questions, in order**

1. Who is cheapest overall on a like-for-like basis?
2. Only among suppliers who passed the quality questionnaire?
3. Are any of those quotes stale or at risk before approval?
4. If I exclude quotes that need reconfirmation, who becomes L1 per line? Show it as a chart.
5. Which suppliers raised prices against last cycle, and on which lines?
6. Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?
7. What must I resolve before I can send this award to Meera?

The live demo Aerchain drives will go off-script, so every tool must work on any reasonable question, not just these seven.

## Out of scope and future direction

These are deliberate exclusions, each named in the one-page note with its reason.

| Excluded | Why |
| --- | --- |
| Supplier discovery and onboarding | Aerchain already ships an onboarding agent; suppliers are pre-onboarded |
| Negotiation rounds | Aerchain's own negotiation logic is being revamped; the prototype hands off a target list instead |
| Approval routing and PO creation | Handled by Aerchain and the ERP; the memo is the handoff |
| Real email sending | Plumbing is stubbed, as the brief allows |
| Live market and FX feeds | Seeded illustrative series keep the demo reproducible |
| Price prediction and "buy now or wait" | Needs category cost models and history; a recommendation without evidence would undermine trust |
| Weighted technical scorecards with multiple evaluators | Pass or fail plus key terms is enough for this event |
| Multilingual quotes, login and multi-tenant setup | Not needed to prove the thesis |

**Future direction**

- **Decision-provenance ledger.** At Aerchain's scale, the per-cell sources, confidence states and override logs become an auditable record of every agent decision, which is what buyers need before moving spend up the autonomy ladder.
- **Award record as the reference for invoices.** The locked award (supplier, SKU, price, validity, warranty) becomes the baseline every PO and invoice is checked against, catching quote-to-invoice drift.
- **Market timing intelligence.** Once freshness and category exposure exist, the same foundation could answer "award now, renegotiate, or wait?"

## Build plan and done criteria

Eight phases in 48 hours, ordered by what is graded. A phase is done only when its check passes.

| Hours | Phase | Done when |
| --- | --- | --- |
| 0 to 5 | Setup and dataset | Repo, Supabase schema and seed data in place; all five supplier files generated with every planted anomaly; ground-truth labels written for accuracy checking |
| 5 to 15 | Extraction and normalisation | All five documents extract to schema with source locators; normalisation ledger correct on the USD, per-pack, footnote and GST cases; field accuracy against ground truth reported on a hidden /eval page |
| 15 to 21 | Quotes and Comparison screens | Click-to-source works; review queue shows only exceptions; coverage, L1 and common-basket totals correct |
| 21 to 25 | Quote Freshness | All six rules fire correctly on the seeded data; B, D and E show the expected status with reasons |
| 25 to 32 | Analyst agent | All seven demo questions answered correctly from tool results; number post-check live; five unscripted questions answered sensibly |
| 32 to 36 | Award and memo | Scenarios computed; gating blocks the memo; override logged; memo exports as PDF |
| 36 to 39 | RFx co-pilot | Chat produces a usable 30-line draft; Send moves the flow to Quotes |
| 39 to 48 | Deploy, test, record, write | Live on Vercel; ugly-edge walkthrough passes; Loom recorded; one-page note written; 2 hours of buffer kept |

The co-pilot is built late on purpose: it is the least differentiated part and the least graded.

## Decision log

Newest first. Add a row for every change to this document.

| Date | Decision | Why |
| --- | --- | --- |
| 1 Oct 2026 | Any value whose normalised price depends on a code-derived conversion (pack size, bundle split, GST-inclusive back-calculation) is Inferred, with the conversion as its reason. FX stays Extracted | Conversions are code's assumptions about what the supplier meant; the buyer should see them in the review queue. Also stops confidence flipping between runs on these lines |
| 1 Oct 2026 | Extraction cannot be pinned to temperature 0 (the model rejects the parameter). Run-to-run variance, tokens and cost per call are recorded and shown on /eval | Honest about repeatability; cost visible before the live demo |
| 30 Sep 2026 | A's prices retuned: A stays above last cycle on laptops, dock, 27" monitor, HDMI cables and SSDs, and sits 1 to 4% below it elsewhere. After clarification E wins lines 1 and 2 plus 3 to 5 others, at most 4 of them on "same as last year" prices, and A wins the rest; the generator refuses to write output otherwise | Otherwise E swept 23 lines, 17 on last year's prices, which overstated E and buried the laptop story |
| 30 Sep 2026 | The award memo flags any winning line priced on a prior-pricing reference as possibly cheap because it reflects last year's market | A "same as last year" price can win on paper while being stale in a rising market; Meera should see that |
| 30 Sep 2026 | E's clarification reply attaches a valid ISO 9001 certificate and an HP authorisation letter and answers the questionnaire, so E fails before clarification and passes after. C keeps failing (expired ISO, no OEM letter). Demo question 6 reworded to "qualified suppliers, excluding stale quotes". Expected Q6: all to A before clarification; A plus E after, with E on both laptop lines. Both states are in ground\_truth.json and checked by the generator. | Without evidence E could never qualify, so Q6 always collapsed to A alone; the clarification loop now visibly changes the award |
| 30 Sep 2026 | docs/SOURCE\_OF\_TRUTH.md in the repo is the master copy; changes are made there directly | Ends re-exporting and keeps one authoritative version |
| 30 Sep 2026 | Supplier E invoices through its Indian branch in Chennai: Tamil Nadu GSTIN (state code 33). Quotes stay in USD. Supply to the Bengaluru and Hyderabad hubs is inter-state (IGST); Chennai is intra-state (CGST and SGST). Customs and importer of record are out of scope. | Gives E a real GST registration for the questionnaire while keeping its USD quote as the FX case; the comparison is ex-GST, so the tax split does not change prices |
| 30 Sep 2026 | Schema adds fields the logic needs beyond the Data model table: Rfx.sent\_at (12 Sep 2026) and Rfx.questionnaire (question definitions); LineItem.category and LineItem.memory\_exposed (lines 1, 2, 5, 6, 28); Supplier.code (A to E); Response.rfx\_id; ExtractedValue.match\_reason, substitute\_check and substitute\_status (Arjun's sign-off). Unmatched quoted items are ExtractedValues with no line. | The analyst filters by category, freshness needs the memory tag, substitutes need a sign-off state, and unmatched items must be listed, never dropped |
| 30 Sep 2026 | Prior-pricing rule set to Medium; D fails the questionnaire; RFx sent 12 Sep 2026; supplier prices designed to hit demo beats and logged in ground truth | Resolves Claude Code's pre-build questions: keeps E at Reconfirm as the dataset intends, and makes the timeline consistent |
| 30 Sep 2026 | Added Evidence base section linking each decision to research | Every choice should be defensible with a source, the same standard the product holds itself to |
| 30 Sep 2026 | Added Quote Freshness between comparison and analysis | A correctly normalised quote can still be unsafe to act on; 2026 laptop prices are rising sharply and quotes expire quickly |
| 30 Sep 2026 | Kept IT hardware, rejected steel | Domain credibility in a live demo; the 2026 memory price shock gives freshness a real basis |
| 30 Sep 2026 | Customer is fictional Meridian Diagnostics | Mid-size, email and Excel buying makes messy quotes realistic; avoids attaching fabricated data to a real company |
| 30 Sep 2026 | Freshness is rule-based and never adjusts prices | No cost-structure data or supplier history to support predictions |
| 30 Sep 2026 | Compare ex-GST, flag GST errors separately | Input tax credit is recoverable for business purchases |
| 30 Sep 2026 | Clarification is one action, not a four-state workflow | Enough to prove the AI loop without building a workflow nobody grades |
| 30 Sep 2026 | Use Aerchain scenario names and "supplier" terminology | Matches the language their evaluators work in |
| 30 Sep 2026 | Build to the brief; "better problem" framed as decision provenance | Two research passes point to trust as the unsolved layer |
