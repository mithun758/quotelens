# Lens: transcripts

Recorded on 1 Oct 2026 against the live model with `npm run lens:demo`, using the single system prompt in lib/ai/lens/system-prompt.md. Each turn lists the tools Lens called and the result of the code checks: every number must appear in a tool result, and every citation must resolve (a cell citation must sit beside that cell's own figure). Citations appear here as raw [[cell:X:N]] and [[doc:id:locator]] tags; in the app they render as chips that highlight the cell or open the source.

## The seven demo questions (one conversation, Quote Comparison)

### 1. Who is cheapest overall on a like-for-like basis?

**Priya** (comparison): Who is cheapest overall on a like-for-like basis?

**Lens:** **Vertex is cheapest on paper, but its quote is Stale, so I wouldn't act on that price.** Vertex's quote is valid until 1 Oct, and approval completes on 10 Oct, so it lapses 9 days before approval.
> 
> **Quoted view, all 5 suppliers.** The common basket is 19 lines. It covers ₹57.76 lakh of last-cycle spend.
> 
> | Supplier | Total | Freshness |
> |---|---|---|
> | Vertex | ₹55.18 lakh | Stale |
> | Sri Ganesh | ₹56.63 lakh | Stale |
> | Prakash (incumbent) | ₹57.08 lakh | Fresh |
> | Lionbridge | ₹57.50 lakh | Reconfirm |
> | Nexa | ₹57.66 lakh | Fresh |
> 
> Sri Ganesh is also Stale. Its price basis is 118 days old, it states no validity, and the illustrative memory index is up 11.2% since the quote date.
> 
> **Decision-ready view, excluding Stale quotes.** Only Prakash, Nexa and Lionbridge remain. The common basket becomes 25 lines. It covers ₹82.87 lakh of last-cycle spend.
> 
> - Lionbridge is lowest at ₹81.93 lakh. Nexa follows at ₹82.13 lakh, then Prakash at ₹82.56 lakh.
> - Lionbridge's figure carries the most uncertainty. Its 20 lines in this basket are Inferred, mostly "same as last year" prices, so they may look cheap because they reflect last year's market. Its quote is also USD-based, and the illustrative rate is up 1.8% since the quote date.
> - Nexa is the cheapest supplier here that is both Fresh and free of "same as last year" prices. It has only 2 Inferred lines in the basket (lines 3 and 12).
> - The gaps between these three are small, so the ranking could change with reconfirmation.
> 
> All totals exclude any freight that is "extra" or "at actuals", and I haven't applied any conditional discounts.
> 
> Next steps: I can send Vertex a reconfirmation request ("please confirm your prices dated 24 Sep still hold, and state your validity"). I can also send Lionbridge one on its USD rate and its "same as last year" lines.

*Tools:* supplier_totals, get_freshness, supplier_totals. *Check:* every number found in a tool result; every citation resolves. *12 s, 3 rounds, $0.140*

### 2. Only among suppliers who passed the quality questionnaire?

**Priya** (comparison): Only among suppliers who passed the quality questionnaire?

**Lens:** **Among qualified suppliers, Vertex is cheapest at ₹1.29 crore, but its quote is Stale, so I wouldn't act on it.** Only Prakash and Vertex pass all 8 questions. Vertex's quote is valid until 1 Oct and approval completes on 10 Oct, so it lapses 9 days before approval.
> 
> **Basis:** Quoted view, common basket of 28 lines. It covers ₹1.35 crore of last-cycle spend. Lines 23 and 29 are left out because Vertex didn't quote them.
> 
> | Supplier | Total | Change vs last cycle | Freshness |
> |---|---|---|---|
> | Vertex | ₹1.29 crore  | Down 4.85% | Stale |
> | Prakash (incumbent) | ₹1.36 crore  | Up 1.04% | Fresh |
> 
> - **Decision-ready answer:** Prakash is the only qualified supplier with a Fresh quote, so it is the only one you can act on today. Vertex becomes usable if it reconfirms, since its quote date is 24 Sep.
> - **Prakash's inferred lines:** 7 of its lines in this basket are Inferred (1, 20, 21, 22, 24, 25, 30). I haven't checked the reasons, so treat its total as provisional until you've reviewed them. Vertex has no Inferred lines in the basket.
> - **Excluded for failing the questionnaire:**
>   - Nexa: 6/8. Its ISO 9001 certificate expired on 14 Mar 2026, and it has no OEM authorisation letter.
>   - Sri Ganesh: 0/8.
>   - Lionbridge: 1/8.
> - **Not applied:** I haven't applied any conditional discounts. The totals also exclude any freight that is "extra" or "at actuals".
> 
> Next step: I can send Vertex a reconfirmation request ("please confirm your prices dated 24 Sep still hold, and state your validity"). I can also draft a clarification asking Nexa for a renewed ISO certificate and an OEM letter, which could bring it back into the qualified set.

*Tools:* supplier_totals, filter_suppliers, get_freshness. *Check:* [[cell:B:1]] (Cites B line 1, whose value is not the figure beside it; removed); [[cell:A:1]] (Cites A line 1, whose value is not the figure beside it; removed). *9 s, 2 rounds, $0.096*

### 3. Are any of those quotes stale or at risk before approval?

**Priya** (comparison): Are any of those quotes stale or at risk before approval?

**Lens:** **Yes, Vertex is Stale. Prakash is Fresh with no fired rules.** Of the two qualified suppliers, only Vertex is at risk before approval.
> 
> | Supplier | Status | Quote date | Valid until | Days valid after approval (10 Oct) |
> |---|---|---|---|---|
> | Vertex | Stale | 24 Sep 2026 | 1 Oct 2026 | 9 days short |
> | Prakash (incumbent) | Fresh | 22 Sep 2026 | 22 Oct 2026 | 12 days |
> 
> - **Vertex:** One rule fired, validity against approval, at high severity. The quote lapses 9 days before approval completes. This is the only fired rule. It doesn't involve quote age, "same as last year" references, memory-exposed lines or FX.
> - **Prakash:** Its validity covers approval with 12 days to spare. Its 7 Inferred lines are a review item, not a freshness risk.
> - **What this means for the award:** Vertex's price of ₹1.29 crore is the lowest, but you can't award on it until its validity is extended. A Stale supplier is also an award blocker.
> 
> Next step: I can prepare a reconfirmation request to Vertex: "Please confirm your prices dated 24 Sep still hold, and state your validity." Want me to do that?

*Tools:* get_freshness. *Check:* every number found in a tool result; every citation resolves. *7 s, 2 rounds, $0.091*

### 4. If I exclude quotes that need reconfirmation, who becomes L1 per line? Show it as a chart.

**Priya** (comparison): If I exclude quotes that need reconfirmation, who becomes L1 per line? Show it as a chart.

**Lens:** **Excluding Stale and Reconfirm quotes leaves only Prakash and Nexa, and Nexa leads on L1 lines.** Nexa is L1 on 18 lines and Prakash on 14. Lines 16 and 27 are ties at the same price, so both suppliers are counted on them. The chart below shows the counts.
> 
> **Basis:** Quoted view, all 30 lines, with Vertex, Sri Ganesh and Lionbridge excluded. Vertex and Sri Ganesh are Stale, and Lionbridge needs reconfirmation. Every line has at least one price.
> 
> | L1 supplier | Lines |
> |---|---|
> | Nexa | 2, 4, 7, 8, 13, 14, 15, 17, 18, 20, 23, 25, 26, 28, 29, 30 |
> | Prakash | 1, 3, 5, 6, 9, 10, 11, 12, 19, 21, 22, 24 |
> | Tie (same price) | 16, 27 |
> 
> - **Margins are thin.** Nexa's lead over Prakash runs from 0.98% (line 25) to 6.45% (line 14). Prakash's lead over Nexa runs from 1.16% (line 12) to 6.78% (line 24).
> - **Inferred values:** Prakash's L1 on lines 1, 21, 22 and 24 is Inferred. On lines 1 and 22 Nexa has no price, so there is no L2 to compare against.
> - **Nexa is not qualified.** It scored 6/8 on the questionnaire. Its ISO 9001 certificate expired on 14 Mar 2026, and it has no OEM authorisation letter. If you restrict to qualified suppliers, Prakash is the only Fresh option.
> - **Freight and discounts:** These figures exclude any freight that is "extra" or "at actuals". I haven't applied any conditional discounts.
> 
> Next step: I can run Best Quote on this selection to get the total against last cycle. I can also draft a clarification asking Nexa for a renewed ISO certificate and an OEM letter.

*Tools:* rank_lines, make_chart. *Check:* every number found in a tool result; every citation resolves. *14 s, 3 rounds, $0.174*

### 5. Which suppliers raised prices against last cycle, and on which lines?

**Priya** (comparison): Which suppliers raised prices against last cycle, and on which lines?

**Lens:** **Prakash, Nexa and Sri Ganesh raised prices on some lines against last cycle. Vertex and Lionbridge raised none.** Sri Ganesh's increases rest on a Stale quote. Prakash's line 1 is Inferred.
> 
> **Basis:** Quoted view, all 5 suppliers, unit price against Meridian's last-cycle price.
> 
> | Supplier | Freshness | Lines raised | Count |
> |---|---|---|---|
> | Sri Ganesh (D) | Stale | 1, 3, 4, 7, 8, 11, 12, 13, 16, 25, 27 | 11 |
> | Nexa (C) | Fresh | 2, 5, 6, 9, 10, 19, 21, 24, 26, 28 | 10 |
> | Prakash (A) | Fresh | 1, 2, 4, 8, 26, 28 | 6 |
> | Vertex (B) | Stale | None | 0 |
> | Lionbridge (E) | Reconfirm | None | 0 |
> 
> **Largest increases:**
> - Prakash line 28, external SSD: ₹9,350 [[cell:A:28]], up 10% on ₹8,500.
> - Sri Ganesh line 1, laptop: ₹73,450 [[cell:D:1]], up 8.01%. Line 12, webcam: ₹4,860 [[cell:D:12]], up 8%. Line 27, USB-C adapter: ₹1,620 [[cell:D:27]], up 8%.
> - Prakash line 2, management laptop: ₹1,11,300 [[cell:A:2]], up 6%. Line 26, HDMI cable: ₹371 [[cell:A:26]], up 6%.
> - Nexa's biggest rise is line 28: ₹8,930 [[cell:C:28]], up 5.06%. The rest are 3.64% or less.
> 
> **Caveats:**
> - **Prakash line 1:** ₹71,400 [[cell:A:1]], up 5%, is Inferred. I haven't checked the reason.
> - **Sri Ganesh:** Its price basis is dated 4 Jun 2026, 118 days old, with no validity stated. The illustrative memory index is up 11.2% since then. The rises on lines 1 and 28 are on memory-exposed lines.
> - **Lionbridge:** It shows no rises, but 21 of its lines are "same as last year" prices. These equal last cycle by construction, so they say nothing about this year's pricing. Only 6 of its lines (1, 2, 4, 7, 8, 12) are genuinely new prices, and all are lower. Its USD rate is also up 1.8% (illustrative) since the quote date.
> - **Vertex:** It is lower on 28 lines, but its quote is Stale: valid until 1 Oct, before approval completes on 10 Oct.
> 
> Next step: I can check the source of Prakash's line 1 to see why it is Inferred. I can also prepare a reconfirmation request to Vertex or Lionbridge.

*Tools:* compare_last_cycle, get_freshness. *Check:* every number found in a tool result; every citation resolves. *10 s, 2 rounds, $0.111*

### 6. Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?

**Priya** (comparison): Split it: cheapest per line among qualified suppliers, excluding stale quotes. What's the total and the saving against last cycle?

**Lens:** **Only Prakash is left, so the split is a single award to Prakash. It costs ₹1.42 crore (exact ₹1,41,78,970), which is ₹1.32 lakh (0.94%) more than last cycle, not a saving.** Last cycle was ₹1.40 crore. This award is blocked by 8 Inferred values, all on Prakash lines.
> 
> **Basis:** Best Quote, Quoted view, all 30 lines. Only qualified suppliers (8/8 on the questionnaire) with a non-Stale quote are included. That leaves Prakash, which is Fresh and valid until 22 Oct, past approval on 10 Oct.
> - **Vertex:** Excluded because it is Stale. It is valid until 1 Oct, before approval completes.
> - **Nexa, Sri Ganesh and Lionbridge:** Excluded for failing the questionnaire. Sri Ganesh is also Stale.
> 
> **Blockers:** Prakash has 8 Inferred lines. I haven't checked these against the source documents.
> 
> | Reason | Lines |
> |---|---|
> | Bundle split (line 1 quoted only with line 3, split derived) | 1 |
> | GST-inclusive price back-calculated at 18% | 20, 21, 22, 23, 24, 25, 30 |
> | Plus: line 22 assumes the indoor AP is ceiling-mountable, which the quote doesn't state | 22 |
> 
> **Cost of this restriction:** The nominal L1 across all suppliers is ₹1.31 crore. This award is ₹10.78 lakh above that. The lower prices come from suppliers that are Stale or that failed the questionnaire. Lionbridge's lowest prices are also mostly "same as last year" references.
> 
> **Not included:** Any freight that is "extra" or "at actuals". No conditional discounts apply, because Prakash has none. I haven't pulled the illustrative market movement for this period.
> 
> Next steps:
> - I can prepare an accept card for Prakash's 7 GST back-calculations. I'd show you the source for line 1 and line 22 first, since those are judgement calls rather than routine conversions.
> - I can send Vertex a reconfirmation request ("please confirm your prices dated 24 Sep still hold, and state your validity"). If Vertex reconfirms, it would be both qualified and usable, and I'd re-run the split.

*Tools:* compute_scenario, list_blockers. *Check:* every number found in a tool result; every citation resolves. *12 s, 2 rounds, $0.119*

### 7. What must I resolve before I can send this award to Meera?

**Priya** (comparison): What must I resolve before I can send this award to Meera?

**Lens:** **Eight Inferred values on Prakash lines block the memo. Nothing else blocks it.** Prakash is Fresh, valid until 22 Oct, which is 12 days past approval on 10 Oct. There are no open flags or Stale suppliers on this award.
> 
> **Basis:** Best Quote, qualified suppliers only, Stale quotes excluded. That makes it a single award to Prakash across all 30 lines.
> 
> | Line | Why it's Inferred | Type |
> |---|---|---|
> | 1 | Quoted only as a bundle with line 3. I derived the price as the bundle price minus Prakash's standalone line 3 price of ₹1,180. | Judgement |
> | 22 | The indoor AP is assumed to be ceiling-mountable, because mounting isn't stated. The price is also GST-inclusive, back-calculated at 18%. | Judgement plus GST |
> | 20, 21, 23, 24, 25, 30 | Quoted GST-inclusive. I back-calculated the ex-GST price at 18%. | Routine GST conversion |
> 
> **To clear them:**
> 1. **Lines 20, 21, 23, 24, 25 and 30:** These are routine, so I can prepare one accept card for the GST back-calculations. Line 22 is also a GST item, but I'd keep it out of that batch.
> 2. **Lines 1 and 22:** These are judgement calls, so check the source before accepting. I can show you each source. Or I can draft a question to Prakash: "Line 1: how does the bundle price split between lines 1 and 3? Line 22: is the indoor AP ceiling-mountable?"
> 3. **Override:** If you'd rather not clear a value, the Award screen lets you override it with your own typed reason, under Decision readiness. I can't do that from chat.
> 
> **Also check before sending:**
> - **Freight:** I haven't confirmed whether Prakash's freight terms are resolved. The totals exclude any freight that is "extra" or "at actuals".
> - **Memo content:** It will include a freshness section. Prakash is Fresh, quote dated 22 Sep 2026, valid until 22 Oct 2026, with no reconfirmation needed.
> 
> Want me to start with the accept card for the GST lines, or show you the sources for lines 1 and 22?

*Tools:* list_blockers, get_freshness. *Check:* every number found in a tool result; every citation resolves. *10 s, 2 rounds, $0.110*

Note: in question 1 above, Lens called "excluding Stale quotes" the decision-ready view and kept two unqualified suppliers. The supplier filter now names the Decision-ready preset (qualified and not Stale). Re-run of question 1 after that fix:

**Priya** (comparison): Who is cheapest overall on a like-for-like basis?

**Lens:** **Vertex (B) is cheapest on the quoted view, but its quote is Stale.** Its quote is valid until 1 Oct 2026 and approval completes on 10 Oct 2026, so it lapses 9 days before approval. On the Decision-ready view, Prakash (A) is the only supplier left.
> 
> **Quoted view, common basket** (19 lines, all 5 suppliers, no exclusions; ₹57.76 lakh last cycle). I did not get the basket's share of last-cycle spend from the tools.
> 
> | Supplier | Total | Freshness |
> |---|---|---|
> | Vertex | ₹55.18 lakh | Stale |
> | Sri Ganesh | ₹56.63 lakh | Stale |
> | Prakash | ₹57.08 lakh | Fresh |
> | Lionbridge | ₹57.50 lakh | Reconfirm |
> | Nexa | ₹57.66 lakh | Fresh |
> 
> - **Vertex:** Its total is 4.47% below last cycle. Its price is not safe to act on until it reconfirms or extends validity.
> - **Sri Ganesh:** Its price basis is dated 4 Jun, which is 118 days old, and it states no validity. The illustrative memory index is up 11.2% since the quote date. It also didn't quote 10 of the 19 basket lines' neighbours, such as lines 2, 14 and 15, so its coverage is thin.
> - **Lionbridge:** 21 of its lines are "same as last year" prices, which are Inferred. Its USD quotes also carry FX movement of +1.8% (illustrative).
> - **Prakash:** Lines 21, 24 and 25 in this basket are Inferred.
> 
> **Decision-ready view** (qualified suppliers only, excluding Stale). Nexa fails the questionnaire (6/8), Lionbridge fails it (1/8), and Vertex and Sri Ganesh are Stale. Only Prakash remains, with all 30 lines at ₹1.42 crore. That is 0.94% above last cycle's ₹1.40 crore. It is Fresh, valid until 22 Oct. Eight of its lines are Inferred (1, 20, 21, 22, 23, 24, 25, 30).
> 
> I can send Vertex a reconfirmation request: "Please confirm your prices dated 24 Sep still hold, and state your validity." Do you want me to prepare it?

*Tools:* supplier_totals, get_freshness, supplier_totals. *Check:* every number found in a tool result; every citation resolves. *10 s, 2 rounds, $0.097*

## The five examples from the prompt

### Example 1

**Priya** (comparison): Who's cheapest overall?

**Lens:** Vertex is cheapest on the quoted view, but its quote is Stale, so it isn't safe to act on yet. Vertex's quote is valid until 1 Oct 2026, and approval completes on 10 Oct 2026, nine days later.
> 
> **Quoted view, common basket (19 lines, all five suppliers, ₹57.76 lakh last-cycle spend on those lines):**
> 
> | Supplier | Total | vs last cycle | Freshness |
> |---|---|---|---|
> | Vertex (B) | ₹55.18 lakh | 4.47% lower | Stale |
> | Sri Ganesh (D) | ₹56.63 lakh | 1.96% lower | Stale |
> | Prakash (A, incumbent) | ₹57.08 lakh | 1.18% lower | Fresh |
> | Lionbridge (E) | ₹57.50 lakh | 0.44% lower | Reconfirm |
> | Nexa (C) | ₹57.66 lakh | 0.17% lower | Fresh |
> 
> - **Sri Ganesh:** its quote is dated 4 Jun 2026 (118 days old) and states no validity. The illustrative memory index is up 11.2% since then.
> - **Lionbridge:** 21 of its lines are "same as last year", so they are Inferred at last-cycle prices. Its USD lines also carry FX movement of +1.8% (illustrative) since the quote date.
> - **Prakash:** three of its basket lines (21, 24, 25) are Inferred.
> - **Qualification:** only Prakash passes the questionnaire (8/8). Vertex also scores 8/8, but it is Stale.
> 
> **Decision-ready view** (qualified, not Stale): only Prakash remains. It totals ₹1.42 crore across all 30 lines, which is 0.94% above last cycle's ₹1.40 crore. Eight of those lines are Inferred (1, 20, 21, 22, 23, 24, 25, 30).
> 
> I can send Vertex a reconfirmation request ("Please confirm your prices dated 24 Sep 2026 still hold, and state your validity"). If it extends validity, its ₹55.18 lakh becomes a usable L1. Do you want me to prepare that?

*Tools:* supplier_totals, get_freshness, supplier_totals. *Check:* every number found in a tool result; every citation resolves. *9 s, 2 rounds, $0.094*


### Example 2

**Priya** (comparison): What's Lionbridge's price for the firewall?

**Lens:** Lionbridge didn't quote line 23, the branch firewall (UTM, quantity 4). That cell is Missing [[cell:E:23]], so it can't count toward L1 or any total. I haven't estimated a price for it.
> 
> Lionbridge's other networking lines all show last-cycle prices because it replied "same as last year". Those are Inferred, and Lionbridge's quote is on Reconfirm.
> 
> I can draft a clarification asking Lionbridge whether it will quote line 23. Do you want me to?

*Tools:* get_comparison. *Check:* every number found in a tool result; every citation resolves. *7 s, 2 rounds, $0.085*


### Example 3

**Priya** (quotes): Accept all of Prakash's GST ones.

**Lens:** I've prepared a card for Prakash's 7 GST-inclusive lines. Each price was back-calculated to ex-GST at 18%. Nothing is accepted until you click Confirm.
> 
> | Line | Item | Ex-GST price |
> |---|---|---|
> | 20 | 24-port managed PoE switch | ₹63,700 |
> | 21 | 8-port unmanaged switch | ₹3,430 |
> | 22 | Wi-Fi 6 ceiling access point | ₹13,700 |
> | 23 | Branch firewall (UTM) | ₹88,200 |
> | 24 | Cat6 patch cable, 2 m | ₹118 |
> | 25 | Cat6 cable box, 305 m | ₹9,310 |
> | 30 | Wall-mount network rack, 12U | ₹11,750 |
> 
> Check line 22 before you confirm. The card notes that Prakash didn't state the mounting type, so I assumed the access point can be ceiling-mounted. You may want to check that with Prakash separately.
> 
> Prakash has 8 items needing review in total. This card covers 7 of them, and I haven't looked at the remaining one yet.

*Tools:* accept_values. *Preview cards:* accept_values. *Check:* every number found in a tool result; every citation resolves. *9 s, 2 rounds, $0.086*


### Example 4

**Priya** (award): Override the Vertex stale blocker.

**Lens:** I can't override blockers from chat. An override needs your own typed reason, which is recorded against the decision.
> 
> To do it yourself:
> 1. Open **Decision readiness** on this Award screen.
> 2. Choose the Vertex blocker.
> 3. Select **Override with reason** and type your reason.
> 
> Vertex's quote is Stale, so the price may no longer be safe to act on. Before you override, I can prepare a reconfirmation request asking Vertex to confirm its prices still hold and to state its validity. If Vertex replies, I'll report its new freshness status. Do you want me to prepare that request?

*Tools:* none. *Check:* every number found in a tool result; every citation resolves. *5 s, 1 rounds, $0.042*


### Example 5

**Priya** (rfx): We need 60 HP laptops for the labs.

**Lens:** I've added line 1: 60 business laptops with a vendor-neutral spec. It asks for Core i5 14th gen or equivalent, 16 GB RAM, 512 GB SSD, a 14-inch screen and a 3-year India onsite warranty. I left HP out because naming it would limit bids to HP resellers and make quotes harder to compare. If you need HP for standardisation, tell me why and I'll record your reason.
> 
> I used Meridian defaults and your event dates for the rest:
> - **Hubs:** Bengaluru, Chennai and Hyderabad.
> - **Need-by date:** 31 Oct 2026.
> - **Delivery:** within 21 days of the PO, delivered to hub with freight included.
> - **Payment and currency:** 45 days from invoice, in INR.
> - **GST:** prices quoted ex-GST, with the rate stated per line.
> - **Quote validity:** 30 days. That clears the minimum of 17 days (10 days approval plus 7), so no warning is needed.
> - **Questionnaire:** the standard 8 questions for IT hardware.
> 
> Last cycle's refresh also included 10 management laptops (Core i7, 32 GB, 1 TB) and 70 backpacks. Do you want either of those on this RFx? Is 60 laptops split evenly across the three hubs, or should I record a split per hub?

*Tools:* get_purchase_history, get_meridian_standards, update_rfx_draft. *Check:* every number found in a tool result; every citation resolves. *16 s, 3 rounds, $0.143*

<details><summary>Draft: IT Refresh 2026: lab laptops, 1 lines</summary>

- 1. Business laptop, Intel Core i5 (14th gen) or equivalent, 16 GB RAM, 512 GB SSD, 14-inch: 60 piece. CPU: Intel Core i5, 14th gen or equivalent; RAM: 16 GB minimum; SSD: 512 GB minimum; Display: 14-inch; Form factor: Laptop; Warranty: 3-year India onsite

Terms: validity 30 days; Quote prices ex-GST, with the GST rate stated per line; warranty India warranty with onsite support in Bengaluru, Chennai and Hyderabad; payment 45 days from invoice

</details>

## A briefing (Priya opens Lens on the Quote Comparison)

**Priya** (comparison, briefing): Priya has just opened the Quote Comparison screen. Brief her: under 60 words, then two or three suggested next steps.

**Lens:** Vertex is lowest on the common basket at ₹55.18 lakh (Quoted view, 19 lines), but it is Stale. Its quote is valid until 1 Oct, and approval completes on 10 Oct. Sri Ganesh is also Stale and Lionbridge needs reconfirmation. Fresh suppliers are Prakash (₹57.08 lakh) and Nexa (₹57.66 lakh).
> 
> - Switch to Decision-ready view
> - Draft Vertex reconfirmation request
> - Show Sri Ganesh's L1 lines

*Tools:* supplier_totals, get_freshness, rank_lines. *Check:* every number found in a tool result; every citation resolves. *6 s, 2 rounds, $0.100*

