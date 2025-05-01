import React, { useEffect, useState } from "react";
import { saveAs } from "file-saver";

type RawProduct = {
  Style?: string;
  Desc?: string;
  Size?: string;
  Width?: string;
  Colours?: string;
  Wholesale?: string;
  RRP?: string;
  Collection?: string;
};

type Product = {
  style: string;
  name: string;
  sizes: string[];
  widths: string[];
  colors: string[];
  wholesale: number;
  rrp: number;
  collection: string;
  shortCode: string;
};

const parseSizes = (sizeString: string): string[] => {
  if (!sizeString) return [];
  if (sizeString.includes(",")) {
    return sizeString.split(",").map((s) => s.trim());
  }
  if (sizeString === "OS" || sizeString === "ONE") return ["ONE"];
  if (sizeString.includes("-")) {
    const [start, end] = sizeString.split("-").map((s) => s.trim());
    const toNumber = (s: string) => (s.includes(".") ? parseFloat(s) : parseInt(s));
    const range: string[] = [];
    let current = toNumber(start);
    const stop = toNumber(end);
    while (current <= stop) {
      range.push(current % 1 === 0 ? `${current}` : `${current}`);
      current = parseFloat((current + 0.5).toFixed(1));
    }
    return range;
  }
  return [sizeString];
};

const generateSKU = (style: string, width: string, color: string, size: string): string => {
  if (size === "ONE") return `${style}-${color}-ONE`;
  const isShoe = /^\d/.test(size);
  const num = isShoe ? Math.round(parseFloat(size) * 10)
    .toString()
    .padStart(3, "0") : size;
  return `${style}-${color}-${width}${num}`;
};

export default function B2BOrderForm() {
  const [rawData, setRawData] = useState<RawProduct[]>([]);
  const [productsByCollection, setProductsByCollection] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then((res) => res.json())
      .then((data: RawProduct[]) => {
        const byCollection: Record<string, Product[]> = {};
        let currentCollection = "";
        for (const row of data) {
          if (row.Collection && !row.Style) {
            currentCollection = row.Collection.trim();
            byCollection[currentCollection] = [];
          } else if (row.Style && currentCollection) {
            const product: Product = {
              style: row.Style.trim(),
              shortCode: row.Collection?.trim() || row.Style.trim(),
              name: row.Desc || "",
              sizes: parseSizes(row.Size || ""),
              widths: row.Width?.split(",").map((s) => s.trim()) || [""],
              colors: row.Colours?.split(",").map((s) => s.trim()) || [],
              wholesale: parseFloat(row.Wholesale || "0"),
              rrp: parseFloat(row.RRP || "0"),
              collection: currentCollection,
            };
            byCollection[currentCollection].push(product);
          }
        }
        setProductsByCollection(byCollection);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [sku]: value }));
  };

  const total = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const style = sku.split("-")[0];
    for (const group of Object.values(productsByCollection)) {
      const product = group.find((p) => p.style === style);
      if (product && !isNaN(parseInt(qty))) {
        return sum + parseInt(qty) * product.wholesale;
      }
    }
    return sum;
  }, 0);

  const downloadCSV = () => {
    if (!customerId) {
      alert("Please enter Customer ID.");
      return;
    }
    const rows = Object.entries(quantities)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([["SKU,Quantity", ...rows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    saveAs(blob, `${customerId}.csv`);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">B2B Order Form</h1>
      <input
        type="text"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        placeholder="Enter Customer ID"
        className="border p-2 mb-4 w-full max-w-sm"
      />
      <p className="mb-4 font-semibold">Total Order Value: ${total.toFixed(2)}</p>
      <button
        onClick={downloadCSV}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-6"
      >
        Download CSV
      </button>

      {Object.entries(productsByCollection).map(([collection, items], idx) => (
        <div key={collection} className="mb-8">
          <button
            className="text-left w-full bg-gray-200 px-4 py-2 font-bold rounded"
            onClick={() =>
              setExpanded((prev) => ({
                ...prev,
                [collection]: !prev[collection],
              }))
            }
          >
            {idx + 1}. {collection}
          </button>

          {expanded[collection] && (
            <div className="mt-4 space-y-4">
              {items.map((product) => (
                <div key={product.style} className="border rounded p-4">
                  <h2 className="font-semibold text-lg mb-1">
                    {product.shortCode} - {product.name} (${product.rrp} / ${product.wholesale})
                  </h2>

                  {product.colors.map((color) =>
                    product.widths.map((width) => (
                      <div key={`${color}-${width}`} className="mb-2">
                        <div className="font-semibold mb-1">
                          Colour: {color} {width && `| Width: ${width}`}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.sizes.map((size) => {
                            const sku = generateSKU(
                              product.style,
                              width,
                              color,
                              size
                            );
                            return (
                              <div key={sku} className="flex flex-col items-center">
                                <label className="text-xs font-medium">{size}</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={quantities[sku] || ""}
                                  onChange={(e) =>
                                    handleChange(sku, e.target.value)
                                  }
                                  className="border px-2 py-1 w-16 text-sm text-center rounded"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
