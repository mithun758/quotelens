import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, brandIn, missingEssentials, withBrandRule, type DraftLine } from "@/lib/rfx/draft";

const line = (description: string, spec: DraftLine["spec"] = []): DraftLine => ({ line_no: 1, description, category: "IT", spec, quantity: 25, uom: "piece", memory_exposed: true });

describe("vendor-neutral lines", () => {
  it("finds brands and models, but not processor tiers, horsepower or cable lengths", () => {
    expect(brandIn(line("HP EliteBook 840 G10"))).toBe("HP");
    expect(brandIn(line("Laptop", [{ attribute: "Model", value: "Dell Latitude 5440" }]))).toBe("Dell");
    expect(brandIn(line("Ergonomic chair", [{ attribute: "Reference", value: "like Featherlite Optima" }]))).toBe("Featherlite");
    expect(brandIn(line("Laptop", [{ attribute: "Processor", value: "Intel Core i5 or AMD Ryzen 5 equivalent, 14th generation or newer" }]))).toBeNull();
    expect(brandIn(line("Submersible pump, 1.5 HP"))).toBeNull();
    expect(brandIn(line("Cat6 patch cable, 3m"))).toBeNull();
    expect(brandIn(line("Corrugated box, 5 ply, 300 x 200 x 150 mm"))).toBeNull();
  });

  it("refuses a branded line without Priya's reason", () => {
    expect(() => withBrandRule(line("HP EliteBook 840"))).toThrow(/vendor-neutral/);
  });

  it("records the brand and Priya's reason in the spec when she keeps it", () => {
    const l = withBrandRule(line("HP EliteBook 840", [{ attribute: "RAM", value: "16 GB" }]), { brand: "HP", reason: "Device management and spares are standardised on HP" });
    expect(l.spec).toEqual([
      { attribute: "RAM", value: "16 GB" },
      { attribute: "Brand required", value: "HP" },
      { attribute: "Reason for brand", value: "Device management and spares are standardised on HP" },
    ]);
    // Re-saving a line that already carries its recorded reason keeps it.
    expect(withBrandRule(l).spec).toHaveLength(3);
  });
});

describe("essentials", () => {
  it("lists what the draft still lacks", () => {
    expect(missingEssentials(EMPTY_DRAFT)).toEqual(["quantity", "delivery locations", "need-by date", "warranty", "quote validity", "GST basis"]);
    const d = { ...EMPTY_DRAFT, lines: [line("Laptop")], delivery_hubs: ["Chennai"], need_by_date: "2026-11-15", terms: { ...EMPTY_DRAFT.terms, warranty: "3 years onsite", validity_days_required: 30, gst_basis: "Ex-GST" } };
    expect(missingEssentials(d)).toEqual([]);
  });
});
