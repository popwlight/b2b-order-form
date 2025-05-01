import React, { useEffect, useState } from "react";
import axios from "axios";
import { saveAs } from "file-saver";

type Product = {
  style: string;
  shortStyle: string;
  name: string;
  sizes: string[];
  widths: string[];
  colors: string[];
  wholesale: number;
  rrp: number;
};

type Collection = {
  name: string;
  products: Product[];
};

const GOOGLE_SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

const parseSizeRange = (range: string): string[] => {
  if (range === "OS" || range === "ONE") return ["ONE"];
  if (range.includes(",")) return range.split(",").map((s) => s.trim());

  const match = range.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (!match) return [range];

  const start = parseFloat(match[1]);
  const end = parseFloat(match[2]);
  const result: string[] = [];

  for (let i = start; i <= end + 0.01; i += 0.5) {
    result.push(i % 1 === 0 ? `${i}` : `${i}`);
  }

  return result;
};

const generateSKU = (
  style: string,
  width: string,
  color: string,
  size: string
) => {
  let sizeCode = size;
  if (size === "ONE" || size === "OS") {
    sizeCode = "ONE";
  } else if (!isNaN(Number(size))) {
    const sizeNum = Math.round(parseFloat(size) * 10);
    sizeCode = sizeNum.toString().padStart(3, "0");
  }
  return `${style}-${color}-${width || "M"}-${sizeCode}`;
};

const OrderForm = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [quantities, setQuantities] = useState<{ [sku: string]: string }>({});
  const [customerId, setCustomerId] = useState("");
  const [collapsed, setCollapsed] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const fetchData = async () => {
      const res = await axios.get(GOOGLE_SHEET_URL);
      const raw = res.data;

      const result: Collection[] = [];
      let currentCollection: Collection | null = null;

      for (const row of raw) {
        if (row.Collection && !row.Style) {
          if (currentCollection) result.push(currentCollection);
          currentCollection = { name: row.Collection, products: [] };
        } else if (row.Style && currentCollection) {
          const style = row.Style.trim();
          currentCollection.products.push({
            style,
            shortStyle: row.Collection?.trim() || style,
            name: row.Desc,
            sizes: parseSizeRange(row.Size),
            widths: row.Width?.split(",").map((w) => w.trim()) || [""],
            colors: row.Colours?.split(",").map((c) => c.trim()) || [],
            wholesale: parseFloat(row.Wholesale || "0"),
            rrp: parseFloat(row.RRP || "0"),
          });
        }
      }
      if (currentCollection) result.push(currentCollection);
      setCollections(result);
    };
    fetchData();
  }, []);

  const handleChange = (sku: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [sku]: value }));
  };

  const handleExport = () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`)
      .join("\n");

    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `${customerId || "order"}.csv`);
  };

  const calculateTotal = () =>
    Object.entries(quantities).reduce((total, [sku, qty]) => {
      const match = collections
        .flatMap((c) => c.products)
        .find((p) => sku.startsWith(p.style));
      if (!match) return total;
      const price = match.wholesale || 0;
      return total + parseInt(qty) * price;
    }, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">B2B Order Form</h1>

      <input
        className="border p-2 mb-4"
        placeholder="Enter Customer ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      />

      {collections.map((col, idx) => (
        <div key={idx} className="mb-6">
          <div
            className="cursor-pointer font-bold text-lg mb-2 flex items-center"
            onClick={() =>
              setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }))
            }
          >
            <span className="mr-2">{idx + 1}.</span>
            <span>{col.name}</span>
            <span className="ml-2 text-sm">
              ({collapsed[idx] ? "Expand" : "Collapse"})
            </span>
          </div>

          {!collapsed[idx] &&
            col.products.map((product, pi) => (
              <div
                key={pi}
                className="border p-4 mb-4 rounded bg-white shadow-sm"
              >
                <h2 className="font-semibold mb-2">
                  {product.shortStyle} - {product.name} (${product.rrp} / $
                  {product.wholesale})
                </h2>

                {product.colors.map((color) => (
                  <div key={color} className="mb-2">
                    <div className="font-medium mb-1">Color: {color}</div>
                    {product.widths.map((width) => (
                      <div key={width}>
                        <div className="text-sm mb-1">
                          Width: {width || "-"}
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
                              <div key={sku} className="text-sm">
                                <label className="block text-xs mb-1">
                                  {size}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={quantities[sku] || ""}
                                  onChange={(e) =>
                                    handleChange(sku, e.target.value)
                                  }
                                  className="w-16 border px-1 py-0.5 text-sm"
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
        </div>
      ))}

      <div className="mt-6 flex items-center justify-between">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded font-semibold"
          onClick={handleExport}
        >
          Export CSV
        </button>
        <div className="text-lg font-bold">
          Total: ${calculateTotal().toFixed(2)}
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
