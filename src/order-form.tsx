// src/order-form.tsx

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

const SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

const parseSizes = (sizeStr: string): string[] => {
  if (!sizeStr) return [];
  if (sizeStr.includes(",")) return sizeStr.split(",").map((s) => s.trim());
  if (sizeStr.includes(" - ")) {
    const [start, end] = sizeStr.split(" - ").map((s) => s.trim());
    const result: string[] = [];
    let current = parseFloat(start);
    const stop = parseFloat(end);
    while (current <= stop) {
      result.push(current % 1 === 0 ? `${current}` : `${current}`);
      current = Math.round((current + 0.5) * 10) / 10;
    }
    return result;
  }
  return [sizeStr];
};

const pad = (input: string | number, length: number) =>
  input.toString().padStart(length, "0");

const generateSKU = (
  fullStyle: string,
  color: string,
  width: string,
  size: string,
  isShoe: boolean
): string => {
  const sizeCode = pad(Math.round(parseFloat(size) * 10), 3);
  if (isShoe) {
    return `${fullStyle}${pad(width, 2)}${color}${sizeCode}`;
  } else {
    return `${fullStyle}${color}${pad(size, 3)}`;
  }
};

const isCollectionHeader = (row: Product) =>
  !row.Style && !row.Desc && !row.Size && row.Collection;

export default function OrderForm() {
  const [data, setData] = useState<Product[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customerId, setCustomerId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(SHEET_URL).then((res) => {
      const rows = res.data as Product[];
      const groups: Record<string, Product[]> = {};
      let currentGroup = "";
      for (const row of rows) {
        if (isCollectionHeader(row)) {
          currentGroup = row.Collection;
          groups[currentGroup] = [];
        } else if (currentGroup && row.Style) {
          groups[currentGroup].push(row);
        }
      }
      setData(rows);
      setGrouped(groups);
      setCollapsed(
        Object.fromEntries(Object.keys(groups).map((key) => [key, true]))
      );
    });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const qty = parseInt(value);
    setQuantities({ ...quantities, [sku]: isNaN(qty) ? 0 : qty });
  };

  const downloadCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([`SKU,Quantity\n${rows.join("\n")}`], {
      type: "text/csv",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${customerId}.csv`;
    a.click();
  };

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const product = Object.values(grouped)
      .flat()
      .find((p) => sku.startsWith(p.Style));
    return sum + (product && qty > 0 ? qty * parseFloat(product.Wholesale) : 0);
  }, 0);

  if (!submitted) {
    return (
      <div className="p-4 max-w-xl mx-auto">
        <h1 className="text-xl font-bold mb-4">Enter Customer ID</h1>
        <input
          className="border px-2 py-1 mr-2"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSubmitted(true)}
        />
        <button
          className="bg-blue-500 text-white px-4 py-1 rounded"
          onClick={() => setSubmitted(true)}
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Order Form</h1>
      <div className="mb-2 text-right">
        <span className="mr-4">Total Qty: {totalQty}</span>
        <span>Total $: ${totalAmount.toFixed(2)}</span>
      </div>
      {Object.entries(grouped).map(([collection, items], index) => (
        <div key={collection} className="mb-6">
          <h2
            className="font-bold text-lg cursor-pointer"
            onClick={() =>
              setCollapsed({
                ...collapsed,
                [collection]: !collapsed[collection],
              })
            }
          >
            {index + 1}. {collection}
          </h2>
          {!collapsed[collection] && (
            <div className="space-y-6">
              {items.map((item, idx) => (
                <div key={`${item.Style}-${idx}`}>
                  <div className="font-semibold mb-1">
                    {item.Style} - {item.Desc} (${item.Wholesale} / ${
                      item.RRP
                    })
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-sm">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1">Colour</th>
                          {parseSizes(item.Size).map((size) => (
                            <th key={size} className="border px-2 py-1">
                              {size}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {item.Colours.split(",").map((color) => (
                          <tr key={color}>
                            <td className="border px-2 py-1">{color}</td>
                            {parseSizes(item.Size).map((size) => {
                              const isShoe = item.Width?.trim() !== "";
                              const width = item.Width.includes(",")
                                ? item.Width.split(",")[0].trim()
                                : item.Width;
                              const sku = generateSKU(
                                item.Style,
                                color.trim(),
                                width.trim(),
                                size,
                                isShoe
                              );
                              return (
                                <td key={sku} className="border px-1 py-1">
                                  <input
                                    type="number"
                                    value={quantities[sku] || ""}
                                    onChange={(e) =>
                                      handleChange(sku, e.target.value)
                                    }
                                    className="w-16 border px-1 text-sm"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="mt-6">
        <button
          onClick={downloadCSV}
          className="bg-green-600 text-white px-6 py-2 rounded"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
