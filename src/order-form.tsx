import React, { useEffect, useState } from "react";

type ProductRow = {
  Style: string;
  Desc?: string;
  Size?: string;
  Width?: string;
  Colours?: string;
  Wholesale?: string;
  RRP?: string;
  Collection?: string;
};

function expandRange(range: string): string[] {
  if (!range || range.includes(",") || range.includes("/")) return range.split(",").map(s => s.trim());
  if (range.includes(" - ")) {
    const [startStr, endStr] = range.split(" - ").map(s => s.trim());
    const start = parseFloat(startStr);
    const end = parseFloat(endStr);
    if (isNaN(start) || isNaN(end)) return [range];
    const result: string[] = [];
    for (let n = start; n <= end; n += 0.5) {
      result.push(n % 1 === 0 ? `${n}` : `${Math.floor(n)}.5`);
    }
    return result;
  }
  return [range];
}

function generateSKU(style: string, width: string, color: string, size: string): string {
  if (size === "OS" || size === "ONE") size = "ONE";
  else if (!isNaN(Number(size))) size = Number(size).toFixed(1).replace(/\.0$/, "");
  let sizeFormatted = size;
  if (!isNaN(Number(size))) {
    const num = parseFloat(size);
    const scaled = Math.round(num * 10);
    sizeFormatted = scaled.toString().padStart(3, "0");
  }
  return [style, width, color, sizeFormatted].filter(Boolean).join("-");
}

export default function OrderForm() {
  const [products, setProducts] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<{ [sku: string]: string }>({});
  const [customerId, setCustomerId] = useState("");
  const [collections, setCollections] = useState<{ name: string; products: any[] }[]>([]);

  useEffect(() => {
    fetch("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then(res => res.json())
      .then((rows: ProductRow[]) => {
        const grouped: { name: string; products: any[] }[] = [];
        let currentGroup: { name: string; products: any[] } = { name: "", products: [] };
        rows.forEach(row => {
          if (row.Collection && !row.Style) {
            if (currentGroup.products.length > 0) grouped.push(currentGroup);
            currentGroup = { name: row.Collection, products: [] };
          } else if (row.Style) {
            const sizes = expandRange(row.Size || "");
            const widths = (row.Width || "").split(",").map(w => w.trim()).filter(Boolean);
            const colors = (row.Colours || "").split(",").map(c => c.trim()).filter(Boolean);
            currentGroup.products.push({
              style: row.Style,
              shortStyle: row.Collection,
              name: row.Desc || "",
              sizes,
              widths,
              colors,
              wholesale: row.Wholesale || "",
              rrp: row.RRP || "",
            });
          }
        });
        if (currentGroup.products.length > 0) grouped.push(currentGroup);
        setCollections(grouped);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    setQuantities(prev => ({ ...prev, [sku]: value }));
  };

  const handleDownload = () => {
    const lines = Object.entries(quantities)
      .filter(([_, qty]) => parseInt(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([["SKU,Quantity", ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customerId || "order"}.csv`;
    link.click();
  };

  return (
    <div className="p-4 max-w-7xl mx-auto font-sans text-sm">
      <div className="mb-4">
        <label className="block font-bold mb-1">Customer ID:</label>
        <input
          className="border p-2 rounded w-full max-w-xs"
          type="text"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
      </div>

      {collections.map((collection, idx) => (
        <details key={collection.name} className="mb-6" open={false}>
          <summary className="font-bold text-lg cursor-pointer mb-2">
            {`${idx + 1}. ${collection.name}`}
          </summary>
          {collection.products.map((product) => (
            <div key={product.style} className="border p-4 mb-4 rounded">
              <h2 className="font-bold mb-2">
                {product.shortStyle} - {product.name} (${product.wholesale} / ${product.rrp})
              </h2>
              {product.colors.map((color) => (
                <div key={color} className="mb-3">
                  <div className="font-semibold mb-1">Color: {color}</div>
                  {product.widths.map((width) => (
                    <div key={width} className="mb-2">
                      <div className="mb-1">Width: {width || "-"}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {product.sizes.map((size) => {
                          const sku = generateSKU(product.style, width, color, size);
                          return (
                            <div key={sku} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <label>{size}</label>
                              <input
                                type="number"
                                min="0"
                                value={quantities[sku] || ""}
                                onChange={(e) => handleChange(sku, e.target.value)}
                                style={{ width: "60px" }}
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
          ))}
        </details>
      ))}

      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        onClick={handleDownload}
        disabled={!customerId || Object.values(quantities).every(q => !parseInt(q))}
      >
        Download CSV
      </button>
    </div>
  );
}
