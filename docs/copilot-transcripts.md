# RFx co-pilot: five unscripted prompts

Recorded on 1 Oct 2026 against the live model with `npm run copilot:demo`. Priya's replies were written after reading each question. Each turn lists the tools called and the essentials still missing after it; the draft is shown once lines exist.

## 1. Brand-locked: HP EliteBook laptops

**Priya:** We need 25 HP EliteBook laptops for the Chennai lab team.

**Co-pilot:** I've started the RFx with 25 laptops delivered to Chennai. I haven't drafted the lines yet. I have two questions:
> 
> 1. What is the need-by date?
> 2. For warranty, quote validity and GST basis, should I use Meridian's standard terms, or something else?
> 
> I'll write the laptop line as a vendor-neutral spec, not "HP EliteBook". That widens competition and makes quotes comparable. If you want to keep HP, tell me the reason and I'll record it in your words.

*Tools:* set_rfx_header. *Missing essentials after this turn:* quantity, need-by date, warranty, quote validity, GST basis. *8 s, $0.016*

**Priya:** By 20 November. Use our standard terms. Keep HP though: our device management and spare-parts pool in Chennai are all HP, so a second brand means a second support contract.

**Co-pilot:** I've drafted the RFx with one laptop line, Meridian's standard terms and the questionnaire.
> 
> - **Header:** need-by date is 20 November 2026, delivery to Chennai.
> - **Brand:** I kept HP on the line and recorded your reason: device management and the spare-parts pool in Chennai are all HP, so a second brand means a second support contract.
> - **Terms:**
>   - 30-day quote validity.
>   - Prices ex-GST, with the GST rate stated per line.
>   - Delivered to hub, freight included, within 21 days.
>   - India warranty with onsite support.
>   - Payment 45 days from invoice.
> - **Questionnaire:** I used the standard questions. I narrowed the warranty and delivery questions to Chennai and the 20 November date.
> 
> **Specs to check:** Last cycle's purchase history had no laptop to copy from, so I chose these values myself:
> - Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer
> - 16 GB memory
> - 512 GB SSD
> - 14-inch full HD anti-glare display
> - Windows 11 Pro
> - Weight 1.6 kg or less
> - 8-hour battery
> 
> I wrote the line as "HP EliteBook series", not a model. Please confirm that suits you, and change any spec value that is off.
> 
> **Warranty wording:** The standard warranty text names Bengaluru, Chennai and Hyderabad. You may want to cut it to Chennai only.

*Tools:* set_rfx_header, get_meridian_standards, get_purchase_history, upsert_lines, set_terms, set_questionnaire. *Missing essentials after this turn:* none. *17 s, $0.032*

<details><summary>Draft: Laptops for Chennai lab team (IT hardware), 1 lines, need by 2026-11-20, hubs Chennai</summary>

- 1. Business laptop, 14-inch, for lab team: 25 piece. Brand: HP EliteBook series; Processor: Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer; Memory: 16 GB DDR5, upgradeable; Storage: 512 GB NVMe SSD; Display: 14-inch, 1920x1080, anti-glare IPS; Operating system: Windows 11 Pro, 64-bit; Connectivity: Wi-Fi 6 or newer, Bluetooth 5.x, 2 x USB-A, 1 x USB-C, HDMI; Weight: 1.6 kg or less; Battery: 3-cell or larger, 8 hours typical use; Security: TPM 2.0, fingerprint reader or IR camera; Brand required: HP; Reason for brand: Our device management and spare-parts pool in Chennai are all HP, so a second brand means a second support contract.

Terms: validity 30 days; GST Quote prices ex-GST, with the GST rate stated per line; delivery Delivered to hub, freight included, 21 days; warranty India warranty with onsite support in Bengaluru, Chennai and Hyderabad; payment 45 days from invoice

Questionnaire: Do you hold a valid ISO 9001 certificate? Attach it. | Are you authorised by the OEM for the models quoted? Attach the authorisation letter. | Do you provide India warranty with onsite support in Chennai? | Can you deliver to Chennai within 21 days of the purchase order, and by 20 November 2026? | Are you registered for GST in India? State your GSTIN. | Do you offer e-waste take-back for replaced equipment? | Name an escalation contact for this account. | Provide two references from healthcare or diagnostics customers.

</details>


## 2. Vague: good monitors for radiology

**Priya:** Get quotes for some good monitors for the radiology reporting rooms.

**Co-pilot:** I've set the RFx title and category. I need two things before I draft the lines:
> 
> 1. How many monitors do you need, and which hubs (Bengaluru, Chennai, Hyderabad) should they go to by what date?
> 2. For warranty, quote validity and GST basis, should I use Meridian's standard terms, or something else?
> 
> For "good monitors", I plan to write a vendor-neutral spec for diagnostic-grade displays. Please tell me if the reporting rooms need something specific, such as a resolution or size for CT and MRI reading, or if the displays are for general X-ray reporting. If you don't say, I'll choose sensible values and flag them for you to check.

*Tools:* set_rfx_header. *Missing essentials after this turn:* quantity, delivery locations, need-by date, warranty, quote validity, GST basis. *7 s, $0.008*

**Priya:** 12 of them, 6 each for Bengaluru and Hyderabad, before 15 December. Standard terms. They are for X-ray and CT reporting.

**Co-pilot:** I've drafted the RFx for 12 diagnostic-grade monitors, with 6 delivered to Bengaluru and 6 to Hyderabad.
> 
> - **Header and terms:** The need-by date is 14 December 2026, which is my reading of "before 15 December". Terms are Meridian's standard ones. Warranty is India onsite support, narrowed to Bengaluru and Hyderabad. Quote validity is 30 days. Prices are ex-GST with the rate stated per line. Delivery is to the hub with freight included, within 21 days. Payment is 45 days from invoice.
> - **Line spec:** I didn't reuse the last cycle's 24" and 27" office monitors, because they aren't suitable for diagnostic reading. The spec is vendor-neutral so quotes are comparable and more suppliers can bid. I chose these values for you:
>   - 21 to 21.3 inch portrait screen, 5MP (2048 x 2560).
>   - Monochrome preferred.
>   - 1000 cd/m2 maximum luminance, 500 cd/m2 calibrated.
>   - 1500:1 contrast ratio.
>   - 10-bit grey scale.
>   - DICOM Part 14 calibration with a built-in front sensor.
>   - IEC 60601-1 safety standard.
> - **Questionnaire:** I replaced the IT-only questions with medical compliance, a sample DICOM calibration report and a demo unit. I also asked suppliers to cover backlight life in the warranty answer.
> 
> Please check these points:
> 1. **Monochrome or colour:** Is monochrome right? If your CT reading uses colour images (3D or fusion), tell me and I'll switch to colour or add a colour line.
> 2. **Same spec for both modalities:** I used one 5MP spec for X-ray and CT. If CT rooms can use a cheaper 3MP or 2MP display, I can split the line.

*Tools:* get_meridian_standards, get_purchase_history, set_rfx_header, set_terms, upsert_lines (refused: Invalid input: ✖ Invalid input: expected array, received string
  → at lines), set_questionnaire, upsert_lines. *Missing essentials after this turn:* none. *29 s, $0.078*

<details><summary>Draft: Monitors for radiology reporting rooms (IT hardware), 1 lines, need by 2026-12-14, hubs Bengaluru, Hyderabad</summary>

- 1. Diagnostic-grade radiology reporting monitor, 5MP, for X-ray and CT reading (6 each for Bengaluru and Hyderabad): 12 piece. Screen size: 21 to 21.3 inch, portrait orientation; Resolution: 5 megapixel, 2048 x 2560 minimum; Panel type: IPS or equivalent wide-viewing-angle panel, 178 degree viewing angle; Colour mode: Monochrome (greyscale) preferred; quote colour option separately if offered; Maximum luminance: 1000 cd/m2 or higher; calibrated luminance 500 cd/m2 or higher; Contrast ratio: 1500:1 or better; Grey scale depth: 10-bit or higher; Calibration: DICOM Part 14 Grayscale Standard Display Function, with built-in front sensor for automatic calibration and constancy checks; Inputs: DisplayPort 1.2 or newer, plus one additional digital input; Quality assurance software: Included, with calibration and conformance reports; Safety and regulatory: Medical electrical equipment, IEC 60601-1; medical device display for diagnostic use; BIS or CDSCO compliance as applicable; Included accessories: Display cable, power cable, height-adjustable stand; Delivery split: 6 to Bengaluru, 6 to Hyderabad

Terms: validity 30 days; GST Quote prices ex-GST, with the GST rate stated per line; delivery Delivered to hub, freight included, 21 days; warranty India warranty with onsite support in Bengaluru and Hyderabad; payment 45 days from invoice

Questionnaire: Do you hold a valid ISO 9001 certificate? Attach it. | Are you authorised by the manufacturer for the products quoted? Attach the authorisation letter. | Do the displays comply with IEC 60601-1 and carry the required Indian medical device or BIS registration? Attach certificates. | Attach a sample DICOM Part 14 calibration and luminance conformance report for the model quoted. | Can you provide a demo or evaluation unit before order? State lead time. | Do you provide India warranty with onsite support in Bengaluru and Hyderabad? State warranty period, backlight life cover and response time. | Can you deliver to Bengaluru and Hyderabad within 21 days of the purchase order, and before 14 December 2026? | Are you registered for GST in India? State your GSTIN. | Do you offer e-waste take-back for replaced equipment? | Name an escalation contact for this account. | Provide two references from hospital, radiology or diagnostics customers.

</details>


## 3. Non-IT: corrugated boxes

**Priya:** We need corrugated boxes for shipping sample collection kits from our collection centres to the labs. Around 5,000 a month.

**Co-pilot:** I've set the title and category (Packaging), and I'm treating the quantity as about 5,000 boxes a month. I have two questions before I draft the lines:
> 
> 1. Should boxes be delivered to all three hubs (Bengaluru, Chennai and Hyderabad) or only some? And what is the first-delivery need-by date?
> 2. For warranty, quote validity and GST basis, should I use Meridian's standard terms, or something else?

*Tools:* set_rfx_header. *Missing essentials after this turn:* quantity, delivery locations, need-by date, warranty, quote validity, GST basis. *6 s, $0.007*

**Priya:** All three hubs, roughly equal. First delivery by 10 November, then monthly for a year. Standard terms, but for warranty just say damaged or substandard boxes are replaced free.

**Co-pilot:** I've drafted the RFx with one line, the terms and a questionnaire adapted for packaging.
> 
> - **Header and terms:** Need-by is 2026-11-10, delivered to Bengaluru, Chennai and Hyderabad. I used Meridian's standard terms: 30-day quote validity, ex-GST with the rate stated per line, delivered to hub with freight included, 21 days from PO, and payment 45 days from invoice. Warranty is "damaged or substandard boxes are replaced free of charge".
> - **Line 1:** 60,000 pieces, which is 5,000 a month for 12 months. The spec says the supply is split roughly equally across the hubs.
> - **Questionnaire:** I kept the general questions (ISO 9001, GST, delivery, escalation contact, references). I replaced the IT-only ones with test reports, BIS or ISO compliance, samples, replacement turnaround and monthly capacity.
> 
> Please check these values, which I chose because you didn't give them:
> - **Size:** 300 x 200 x 150 mm internal. Please confirm this against your kit.
> - **Board:** 5-ply, B or C flute, 150 GSM virgin kraft liners.
> - **Strength:** minimum bursting strength 12 kg/cm² and box compression 300 kgf.
> - **Print:** single-colour Meridian logo plus a "handle with care" marking.

*Tools:* get_meridian_standards, set_rfx_header, set_terms, upsert_lines, set_questionnaire. *Missing essentials after this turn:* none. *19 s, $0.035*

<details><summary>Draft: Corrugated boxes for sample collection kit shipping (Packaging), 1 lines, need by 2026-11-10, hubs Bengaluru, Chennai, Hyderabad</summary>

- 1. Corrugated shipping box for sample collection kits: 60000 piece. Internal dimensions (L x W x H): 300 x 200 x 150 mm, tolerance +/- 3 mm; Construction: 5-ply corrugated fibreboard, die-cut regular slotted or tuck-top style; Flute: B or C flute; Board grade: Virgin kraft liner, minimum 150 GSM outer and inner liners; Bursting strength: Minimum 12 kg/cm2 (IS 7028 / ISO 2759 test method); Box compression strength: Minimum 300 kgf (ISO 12048 or equivalent); Moisture content: 8 to 12 percent; Print: Single colour on two sides: Meridian logo and 'Diagnostic samples, handle with care, this side up' marking; Finish: Water-resistant outer coating; stitched or glued manufacturer's joint, no metal staples; Supply schedule: About 5,000 boxes per month for 12 months, split roughly equally across Bengaluru, Chennai and Hyderabad hubs; first delivery by 2026-11-10

Terms: validity 30 days; GST Quote prices ex-GST, with the GST rate stated per line; delivery Delivered to hub, freight included, 21 days; warranty Damaged or substandard boxes are replaced free of charge; payment 45 days from invoice

Questionnaire: Do you hold a valid ISO 9001 certificate? Attach it. | Attach recent test reports for bursting strength, box compression strength and GSM for the board quoted. | Confirm the boxes comply with the relevant BIS (IS 2771 / IS 7028) or equivalent ISO standards. | Can you supply pre-production samples before the first order? State lead time. | Do you replace damaged or substandard boxes free of charge? State your replacement turnaround. | Can you supply about 5,000 boxes a month for 12 months, split across the three hubs? | Can you deliver to Bengaluru, Chennai and Hyderabad hubs within 21 days of the purchase order, and by 10 November 2026 for the first delivery? | Are you registered for GST in India? State your GSTIN. | Name an escalation contact for this account. | Provide two references from healthcare, diagnostics or similar customers.

</details>


## 4. Non-IT with a brand reference: office chairs

**Priya:** About 60 office chairs for the new Hyderabad office, something like the Featherlite ones we have in Bengaluru. Needed by end of November.

**Co-pilot:** I've set the RFx header: office chairs for the new Hyderabad office, delivered to Hyderabad by 2026-11-30, with a quantity of about 60.
> 
> Do you want Meridian's standard terms for warranty, quote validity and GST basis, or something different?
> 
> Once you confirm, I'll draft the chair line. I'll write it as a vendor-neutral spec, not as "Featherlite". That widens competition and makes quotes comparable. If you want to keep the brand, tell me why and I'll record your reason.

*Tools:* set_rfx_header. *Missing essentials after this turn:* quantity, warranty, quote validity, GST basis. *6 s, $0.008*

**Priya:** Standard terms are fine, but chairs need at least a 5-year warranty on the mechanism and gas lift. Neutral spec is fine.

**Co-pilot:** I've drafted the RFx with one chair line for 60 pieces, delivered to Hyderabad by 2026-11-30.
> 
> - **Terms:** These are Meridian's standard terms. Quotes are ex-GST with the rate stated per line. They stay valid for 30 days, delivery is within 21 days with freight included, and payment is 45 days from invoice. Warranty is at least 5 years on the mechanism and gas lift, plus onsite support in Hyderabad.
> - **Spec:** I chose the values below because you didn't give any, so please check them against the Bengaluru chairs.
>   - Mid-back mesh chair with synchro tilt.
>   - Height-adjustable armrests.
>   - Gas lift to EN 1335 Class 3 or 4.
>   - 110 kg load rating.
>   - 5-star nylon base.
>   - Seat fabric rated for 50,000 Martindale cycles.
>   - BIS or EN 1335 / BIFMA test report.
> - **Questionnaire:** I dropped the OEM authorisation and e-waste questions. I added questions on test reports, the 5-year warranty, samples and Hyderabad service. The ISO 9001, GST, escalation and references questions are kept.
> 
> Please check the BIS standard number (IS 17631) before this goes out.

*Tools:* get_meridian_standards, set_terms, upsert_lines (refused: Invalid input: ✖ Invalid input: expected array, received string
  → at lines), set_questionnaire, upsert_lines. *Missing essentials after this turn:* none. *20 s, $0.044*

<details><summary>Draft: Office chairs for new Hyderabad office (Furniture), 1 lines, need by 2026-11-30, hubs Hyderabad</summary>

- 1. Ergonomic office chair, mid-back, with synchro tilt mechanism: 60 piece. Back type: Mid-back, breathable mesh; Seat: Width 450-500 mm, depth 430-480 mm, moulded foam at least 50 mm thick; Seat height adjustment: Pneumatic gas lift, Class 3 or 4 per EN 1335 / BIFMA, range approx 420-520 mm; Mechanism: Synchro tilt with tilt lock; Armrests: Height adjustable; Lumbar support: Integrated, fixed or adjustable; Base: 5-star nylon or glass-filled nylon base, 650 mm diameter minimum; Castors: Dual-wheel, 50 mm, suitable for hard flooring; Load rating: At least 110 kg; Upholstery: Seat in fabric, abrasion resistance at least 50,000 Martindale cycles; Certification: BIS IS 17631 or equivalent EN 1335 / ANSI BIFMA X5.1 test report; Warranty: Minimum 5 years on mechanism and gas lift

Terms: validity 30 days; GST Quote prices ex-GST, with the GST rate stated per line; delivery Delivered to hub, freight included, 21 days; warranty Minimum 5 years on chair mechanism and gas lift; India warranty with onsite support in Hyderabad; payment 45 days from invoice

Questionnaire: Do you hold a valid ISO 9001 certificate? Attach it. | Attach test reports showing compliance with EN 1335 or ANSI/BIFMA X5.1 (or the relevant BIS standard) for the chair quoted. | Do you confirm a minimum 5-year warranty on the mechanism and gas lift? State what it covers and excludes. | Can you supply a sample chair before order, and in what time? | Do you provide after-sales service and parts support in Hyderabad? | Can you deliver to Hyderabad within 21 days of the purchase order, and before 30 November 2026? | Are you registered for GST in India? State your GSTIN. | Name an escalation contact for this account. | Provide two references from healthcare or diagnostics customers, or other corporate customers.

</details>


## 5. Complete request: nothing to ask

**Priya:** Annual top-up for the new collection centres: 40 business laptops and 40 24-inch monitors, half to Bengaluru and half to Chennai, needed by 15 November. 3-year onsite warranty, quotes valid for 30 days, prices ex-GST.

**Co-pilot:** I've drafted the RFx with two lines (40 laptops and 40 monitors, 20 of each to Bengaluru and Chennai), the header, terms and questionnaire. It needs them by 15 November 2026, with a 3-year onsite warranty, 30-day quote validity and prices ex-GST.
> 
> **Values I chose for you:**
> - **Laptop:** I used last cycle's business laptop spec as the base: Core i5 or Ryzen 5 equivalent (14th gen or newer), 16 GB RAM, 512 GB SSD and a 14 inch display. I added a 1920x1080 minimum, which wasn't in last cycle's spec.
> - **Monitor:** 24 inch FHD, IPS or equivalent panel, HDMI plus one other digital input, and a height and tilt adjustable stand. The panel, input and stand details are my additions.
> - **Spec wording:** I kept the specs vendor-neutral. That widens competition and makes quotes comparable.
> - **Terms from Meridian's standards:** delivery to hub with freight included, 21 days from PO, payment 45 days from invoice, and GST rate stated per line.
> - **Questionnaire:** I limited it to Bengaluru and Chennai and tied the delivery question to your dates.
> 
> **Please check:**
> - **Delivery date:** 21 days from PO only meets 15 November if you issue the PO by about 25 October. Allow for the 10-day approval window.
> - **Laptop specs:** I didn't add a weight, battery or port requirement. Tell me if the centres need any.

*Tools:* get_purchase_history, get_meridian_standards, set_rfx_header, set_terms, upsert_lines, set_terms, set_questionnaire. *Missing essentials after this turn:* none. *18 s, $0.046*

<details><summary>Draft: Annual top-up: business laptops and 24-inch monitors for new collection centres (IT hardware), 2 lines, need by 2026-11-15, hubs Bengaluru, Chennai</summary>

- 1. Business laptop, 14 inch (20 to Bengaluru, 20 to Chennai): 40 piece. Processor: Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer; RAM: 16 GB or more; Storage: 512 GB SSD or more; Display: 14 inch, 1920x1080 or better; Form factor: Laptop; Warranty: 3 years onsite
- 2. 24 inch FHD monitor (20 to Bengaluru, 20 to Chennai): 40 piece. Screen size: 24 inch; Resolution: 1920x1080 (FHD); Panel type: IPS or equivalent wide-viewing-angle; Inputs: HDMI and at least one other digital input; Stand: Height and tilt adjustable; Warranty: 3 years onsite

Terms: validity 30 days; GST Quote prices ex-GST, with the GST rate stated per line; delivery Delivered to hub, freight included, 21 days; warranty 3-year onsite warranty; payment 45 days from invoice

Questionnaire: Do you hold a valid ISO 9001 certificate? Attach it. | Are you authorised by the OEM for the models quoted? Attach the authorisation letter. | Do you provide 3-year India warranty with onsite support in Bengaluru and Chennai? | Can you deliver 20 laptops and 20 monitors to each of Bengaluru and Chennai by 15 November 2026? | Are you registered for GST in India? State your GSTIN. | Do you offer e-waste take-back for replaced equipment? | Name an escalation contact for this account. | Provide two references from healthcare or diagnostics customers.

</details>

## 2b. Re-run of prompt 2 after tightening the two-question rule

**Priya:** Get quotes for some good monitors for the radiology reporting rooms.

**Co-pilot:** I've set the title to "Radiology reporting monitors" and the category to IT hardware. I need two things before I draft the lines:
> 
> 1. How many monitors do you need, delivered to which hubs (Bengaluru, Chennai, Hyderabad) and by when?
> 2. For warranty, quote validity and GST basis, should I use Meridian's standard terms, or something else?
> 
> "Good monitors" is too vague for suppliers to quote against. I'll turn it into measurable specs for diagnostic reporting, such as resolution, panel size, brightness and calibration. I'll list the values I choose so you can change them. I'll write the specs without brand names so more suppliers can bid and the quotes are easier to compare.
