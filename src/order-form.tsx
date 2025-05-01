import React, { useEffect, useState } from "react";
import { Input } from "../components/ui/input";

const SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

function parseSizes(sizeStr: string): string[] {
  if (!sizeStr) return [];
  const sizes = sizeStr.split(",");
  const output: string[] = [];
  for (const sizeRange of sizes) {
    if (sizeRange.includes("-")) {
      const [startStr, endStr] = sizeRange.trim().split("-").map(s => s.trim());
      const start = parseFloat(startStr);
      const end = parseFloat(endStr);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i += 0.5) {
          output.push((Math.round(i * 10) / 10).toString());
        }
      } else {
        output.push(sizeRange.trim());
      }
    } else {
      output.push(sizeRange.trim());
    }
  }
  return output;
}

function generateSKU(style: string, width: string, color: string, size: string) {
  let shortSize = size;
  if (size.toUpperCase() === "OS") shortSize = "ONE";
  else if (/^[0-9.]+$/.test(size)) {
    const num = parseFloat(size);
    shortSize = (num * 10).toFixed(0).padStart(3, "0");
  }
  let sku = style + color + shortSize;
  if (style.startsWith("S")) sku = style + width + color + shortSize;
  return sku;
}

export default function B2BOrderForm() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    fetch(SHEET_URL)
      .then((res) => res.json())
      .then((data) => setRawData(data.filter(row => row.Style || row.Collection)));
  }, []);

  function handleChange(sku: string, qty: string) {
    setQuantities((prev) => ({ ...prev, [sku]: qty }));
  }

  function downloadCSV() {
    if (!customerId) {
      alert("Please enter Customer ID.");
      return;
    }
    const lines = ["SKU,Quantity"];
    for (const sku in quantities) {
      const qty = quantities[sku];
      if (qty && parseInt(qty) > 0) {
        lines.push(`${sku},${qty}`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const structured: Record<string, any[]> = {};
  let currentCollection = "Uncategorized";
  for (const row of rawData) {
    if (row.Collection) {
      currentCollection = row.Collection;
      if (!structured[currentCollection]) structured[currentCollection] = [];
    } else if (row.Style) {
      structured[currentCollection] = structured[currentCollection] || [];
      structured[currentCollection].push(row);
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <label className="mr-2 font-bold">Customer ID:</label>
        <Input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-64 inline-block"
        />
        <button
          onClick={downloadCSV}
          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Download CSV
        </button>
      </div>
      {Object.entries(structured).map(([collection, products], index) => (
        <details key={collection} className="mb-6" open={false}>
          <summary className="text-xl font-bold mb-2">
            {index + 1}. {collection}
          </summary>
          {products.map((p) => {
            const style = p.Style;
            const short = p[""].trim();
            const sizes = parseSizes(p.Size || "");
            const widths = (p.Width || "").split(",").map((w: string) => w.trim() || "");
            const colors = (p.Colours || "").split(",").map((c: string) => c.trim());
            return (
              <div
                key={`${style}-${p.Desc}`}
                className="border p-4 mb-4 bg-white shadow"
              >
                <h2 className="font-semibold text-lg mb-2">
                  {short} - {p.Desc} (${p.Wholesale} / ${p.RRP})
                </h2>
                {colors.map((color: string) => (
                  <div key={color} className="mb-2">
                    <div className="font-medium">Color: {color}</div>
                    {widths.map((width: string) => (
                      <div key={width} className="ml-4 mb-1">
                        <div className="text-sm">Width: {width || "-"}</div>
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((size: string) => {
                            const sku = generateSKU(style, width, color, size);
                            return (
                              <div key={sku} className="text-center">
                                <div className="text-xs">{size}</div>
                                <Input
                                  value={quantities[sku] || ""}
                                  onChange={(e) => handleChange(sku, e.target.value)}
                                  className="w-16 text-center"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </details>
      ))}
    </div>
  );
}
