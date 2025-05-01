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
  Collection?: string;
}

interface GroupedProduct {
  collection: string;
  items: Product[];
}

const parseRange = (range: string): string[] => {
  if (!range) return [];
  const sizes: string[] = [];
  const parts = range.split(",").map((p) => p.trim());
  parts.forEach((part) => {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((x) => x.trim());
      const startNum = parseFloat(start);
      const endNum = parseFloat(end);
      if (!isNaN(startNum) && !isNaN(endNum)) {
        for (let i = startNum; i <= endNum; i += 0.5) {
          sizes.push(i % 1 === 0 ? `${i}` : `${i}`);
        }
      } else {
        sizes.push(part);
      }
    } else {
      sizes.push(part);
    }
  });
  return sizes;
};

const parseColours = (colours: string): string[] => {
  return colours?.split(",").map((c) => c.trim()) || [];
};

export default function OrderForm() {
  const [data, setData] = useState<Product[]>([]);
  const [grouped, setGrouped] = useState<GroupedProduct[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    axios
      .get(
        "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1"
      )
      .then((res) => {
        const raw: Product[] = res.data;
        const result: GroupedProduct[] = [];
        let currentCollection = "";
        let currentItems: Product[] = [];

        raw.forEach((row) => {
          const isCollectionRow = Object.values(row).filter(Boolean).length === 1 && row.Collection;
          if (isCollectionRow) {
            if (currentItems.length > 0) {
              result.push({ collection: currentCollection, items: currentItems });
            }
            currentCollection = row.Collection;
            currentItems = [];
          } else if (row.Style) {
            currentItems.push({ ...row, Collection: currentCollection });
          }
        });

        if (currentItems.length > 0) {
          result.push({ collection: currentCollection, items: currentItems });
        }

        setData(raw);
        setGrouped(result);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setQuantities((prev) => ({ ...prev, [sku]: num }));
    } else {
      const copy = { ...quantities };
      delete copy[sku];
      setQuantities(copy);
    }
  };

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const product = data.find((p) => `${p.Style}-${p.Width}-${p.Colours}-${p.Size}`.includes(sku));
    const price = parseFloat(product?.Wholesale || "0");
    return sum + price * qty;
  }, 0);

  return (
    <div className="p-4 text-sm font-sans">
      {!customerId ? (
        <div className="max-w-md mx-auto my-10">
          <label className="block mb-2 font-bold">Please enter your Customer ID:</label>
          <input
            className="border px-4 py-2 w-full border-gray-300 rounded"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-4">B2B Order Form</h1>
          <p className="mb-2">Customer ID: {customerId}</p>
          <p className="mb-4 font-medium">Total Qty: {totalQty} | Total $: {totalAmount.toFixed(2)}</p>
          {grouped.map(({ collection, items }) => (
            <details key={collection} className="mb-6" open={false}>
              <summary className="text-xl font-bold cursor-pointer bg-gray-100 p-2 mb-2">{collection}</summary>
              {items.map((product, index) => {
                const sizes = parseRange(product.Size);
                const widths = parseColours(product.Width);
                const colours = parseColours(product.Colours);

                if (!sizes.length || !colours.length) return null;

                return (
                  <div key={index} className="border border-gray-300 rounded mb-4 p-3">
                    <h2 className="font-bold mb-1">
                      {product.Style.replace(/^[A-Z0]+/, "")} - {product.Desc} (${product.RRP})
                      <span className="ml-2 text-sm text-gray-500">Wholesale ${product.Wholesale}</span>
                    </h2>
                    {widths.map((width) => (
                      <div key={width} className="mb-2">
                        <div className="font-semibold">Width: {width || "-"}</div>
                        <div className="overflow-x-auto">
                          <table className="border-collapse border w-full text-center text-xs">
                            <thead>
                              <tr>
                                {sizes.map((size) => (
                                  <th key={size} className="border px-2 py-1">{size}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {colours.map((color) => (
                                <tr key={color}>
                                  {sizes.map((size) => {
                                    const sku = `${product.Style}-${width}-${color}-${size}`;
                                    return (
                                      <td key={sku} className="border px-1 py-1">
                                        <input
                                          className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                          type="number"
                                          min={0}
                                          max={99}
                                          value={quantities[sku] || ""}
                                          onChange={(e) => handleChange(sku, e.target.value)}
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
                );
              })}
            </details>
          ))}
        </>
      )}
    </div>
  );
}
