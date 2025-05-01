// order-form.tsx

import React, { useEffect, useState } from "react";
import axios from "axios";

interface Product {
  Style: string;
  Desc: string;
  Size: string;
  Width: string;
  Colours: string;
  Wholesale: string;
  RRP: string;
  Collection: string;
}

const expandSizes = (sizeRange: string, isShoe: boolean) => {
  if (sizeRange.includes(",")) return sizeRange.split(",").map(s => s.trim());
  if (sizeRange.includes("/")) return [sizeRange.trim()];
  if (!sizeRange.includes("-")) return [sizeRange.trim()];

  const [startRaw, endRaw] = sizeRange.split("-").map((s) => s.trim());
  const isNumber = (val: string) => /^\d+(\.5)?$/.test(val);

  if (!isNumber(startRaw) || !isNumber(endRaw)) return [sizeRange];

  let start = parseFloat(startRaw);
  let end = parseFloat(endRaw);
  const sizes: string[] = [];

  for (let s = start; s <= end; s += 0.5) {
    sizes.push(isShoe ? s.toFixed(1).replace(/\.0$/, "") : s.toString());
  }
  return sizes;
};

const expandWidths = (widths: string) => {
  return widths ? widths.split(",").map((w) => w.trim()) : [""];
};

const expandColours = (colours: string) => {
  return colours ? colours.split(",").map((c) => c.trim()) : [""];
};

const isShoeProduct = (style: string) => /[0-9]C$|[0-9]W$|F$/.test(style);

const pad = (str: string, len: number) => str.padStart(len, "0");

const getSKU = (style: string, colour: string, size: string, width: string, isShoe: boolean) => {
  const base = style.replace(/[^A-Z0-9]/gi, "").substring(0, 9).padEnd(9, "0");
  const col = colour.padEnd(3, "0").toUpperCase();
  const w = isShoe ? pad(width, 2) : "";
  let s = size;
  if (isShoe) {
    const num = Math.round(parseFloat(size) * 10);
    s = pad(num.toString(), 3);
  }
  const sku = `${base}${col}${w}${s}`;
  return isShoe ? sku.padEnd(17, "0") : sku.padEnd(15, "0");
};

export default function OrderForm() {
  const [data, setData] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    axios
      .get("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then((res) => {
        const rows = res.data.filter((r: Product) => r.Style || r.Collection);
        setData(rows);
      });
  }, []);

  useEffect(() => {
    let totalAmount = 0;
    Object.entries(quantities).forEach(([sku, qty]) => {
      const match = data.find((d) => sku.startsWith(d.Style.replace(/[^A-Z0-9]/gi, "")));
      if (match && match.Wholesale) {
        totalAmount += qty * parseFloat(match.Wholesale);
      }
    });
    setTotal(totalAmount);
  }, [quantities]);

  const handleChange = (sku: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [sku]: qty }));
  };

  const groupByCollection = (): Record<string, Product[]> => {
    const result: Record<string, Product[]> = {};
    let current = "";
    for (const row of data) {
      if (!row.Style && row.Collection) {
        current = row.Collection;
        result[current] = [];
      } else if (row.Style) {
        if (!result[current]) result[current] = [];
        result[current].push(row);
      }
    }
    return result;
  };

  const exportCSV = () => {
    const lines = ["SKU,Quantity"];
    Object.entries(quantities).forEach(([sku, qty]) => {
      if (qty > 0) lines.push(`${sku},${qty}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${customerId}.csv`;
    a.click();
  };

  if (!confirmed) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Enter Customer ID:</h2>
        <input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setConfirmed(true);
          }}
          style={{ fontSize: 20, padding: 5 }}
        />
        <button onClick={() => setConfirmed(true)} style={{ marginLeft: 10 }}>
          Next
        </button>
      </div>
    );
  }

  const grouped = groupByCollection();

  return (
    <div style={{ padding: 10 }}>
      <h2>Customer: {customerId}</h2>
      <button onClick={exportCSV}>Export CSV</button>
      <h3>Total: ${total.toFixed(2)}</h3>
      {Object.entries(grouped).map(([collection, items], index) => (
        <details key={collection} style={{ marginBottom: 20 }} open={false}>
          <summary>
            <b>{index + 1}. {collection}</b>
          </summary>
          {items.map((p) => {
            const sizes = expandSizes(p.Size, isShoeProduct(p.Style));
            const widths = expandWidths(p.Width);
            const colours = expandColours(p.Colours);
            const isShoe = isShoeProduct(p.Style);
            const uniqueSKUs: string[] = [];
            return (
              <div key={p.Style} style={{ marginBottom: 10 }}>
                <h4>
                  {p.Collection} - {p.Desc} (${p.Wholesale} / ${p.RRP})
                </h4>
                <table style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ border: "1px solid #ccc", padding: 4 }}>Colour</th>
                      {sizes.map((sz) => (
                        <th key={sz} style={{ border: "1px solid #ccc", padding: 4 }}>{sz}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {colours.map((col) => (
                      widths.map((w) => (
                        <tr key={`${col}-${w}`}>
                          <td style={{ border: "1px solid #ccc", padding: 4 }}>{col} {w}</td>
                          {sizes.map((sz) => {
                            const sku = getSKU(p.Style, col, sz, w, isShoe);
                            uniqueSKUs.push(sku);
                            return (
                              <td key={sku} style={{ border: "1px solid #ccc", padding: 2 }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={999}
                                  value={quantities[sku] || ""}
                                  onChange={(e) => handleChange(sku, Number(e.target.value))}
                                  style={{ width: 50 }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </details>
      ))}
    </div>
  );
}
