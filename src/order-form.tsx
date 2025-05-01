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

const parseSizeRange = (sizeStr: string): string[] => {
  if (!sizeStr) return [];
  if (sizeStr.includes(",")) return sizeStr.split(",").map(s => s.trim());
  if (sizeStr.includes("-")) {
    const [start, end] = sizeStr.split("-").map(s => s.trim());
    const result: string[] = [];
    const isHalf = start.includes(".") || end.includes(".");
    let current = parseFloat(start);
    const stop = parseFloat(end);
    while (current <= stop) {
      result.push(current % 1 === 0 ? `${current}` : `${current}`);
      current = parseFloat((current + 0.5).toFixed(1));
    }
    return result;
  }
  return [sizeStr.trim()];
};

const isFootwear = (style: string) => /\dC$|\dW$|\dF$/.test(style);
const formatSize = (size: string) => isNaN(+size) ? size : String(size * 10).padStart(3, "0");
const formatWidth = (width: string) => width.padStart(2, "0");

export default function OrderForm() {
  const [data, setData] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [quantities, setQuantities] = useState<{ [sku: string]: number }>({});
  const [collections, setCollections] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<{ [col: string]: boolean }>({});

  useEffect(() => {
    axios.get("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then(res => {
        const rows: Product[] = res.data.filter(r => r.Style || r.Collection);
        const grouped: Product[] = [];
        let currentCollection = "";
        rows.forEach(row => {
          if (!row.Style && row.Collection) {
            currentCollection = row.Collection.trim();
            setCollapsed(prev => ({ ...prev, [currentCollection]: true }));
          } else {
            row.Collection = currentCollection;
            grouped.push(row);
          }
        });
        setData(grouped);
        setCollections([...new Set(grouped.map(r => r.Collection))]);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const qty = parseInt(value);
    setQuantities(q => ({ ...q, [sku]: isNaN(qty) ? 0 : qty }));
  };

  const getSkus = (product: Product): { sku: string, color: string, size: string, width: string }[] => {
    const sizes = parseSizeRange(product.Size);
    const widths = product.Width ? product.Width.split(",").map(w => w.trim()) : [""];
    const colours = product.Colours ? product.Colours.split(",").map(c => c.trim()) : [""];
    const isShoe = isFootwear(product.Style);
    const baseStyle = product.Style.replace(/[^A-Z0-9]/gi, "");
    return colours.flatMap(color =>
      sizes.flatMap(size =>
        widths.map(width => {
          const widthPart = isShoe ? formatWidth(width) : "";
          const sizePart = isShoe ? formatSize(size) : size;
          const sku = isShoe
            ? `${baseStyle}${color}${widthPart}${sizePart}`
            : `${baseStyle}${color}${size}`;
          return { sku, color, size, width };
        })
      )
    );
  };

  const handleExport = () => {
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob(["SKU,Qty\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId || "order"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalQty = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);
  const totalValue = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    if (qty > 0) {
      const style = sku.slice(0, 10);
      const product = data.find(p => p.Style.replace(/[^A-Z0-9]/g, "").startsWith(style));
      if (product && product.Wholesale) sum += parseFloat(product.Wholesale) * qty;
    }
    return sum;
  }, 0);

  return (
    <div className="p-4 text-sm">
      {!customerId ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="border px-2 py-1"
            placeholder="Enter Customer ID"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") e.currentTarget.nextElementSibling?.dispatchEvent(new MouseEvent("click", { bubbles: true })); }}
          />
          <button
            className="bg-black text-white px-3 py-1"
            onClick={() => setCustomerId(customerId.trim())}
          >Next</button>
        </div>
      ) : (
        <>
          <div className="text-xs mb-2">Customer ID: {customerId} <button className="underline ml-2" onClick={() => setCustomerId("")}>Change</button></div>
          <div className="mb-2 text-xs">Total Qty: {totalQty} | Total Value: ${totalValue.toFixed(2)}</div>
          <button className="mb-4 bg-green-600 text-white px-3 py-1" onClick={handleExport}>Download CSV</button>
          {collections.map((col, i) => (
            <div key={col} className="mb-6">
              <h2 className="text-md font-bold mb-1 cursor-pointer" onClick={() => setCollapsed(prev => ({ ...prev, [col]: !prev[col] }))}>{i + 1}. {col}</h2>
              {!collapsed[col] && (
                <div className="space-y-6">
                  {data.filter(d => d.Collection === col).map(product => {
                    const skus = getSkus(product);
                    const rows = skus.reduce((acc, cur) => {
                      const key = `${cur.color}-${cur.width}`;
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(cur);
                      return acc;
                    }, {} as { [key: string]: typeof skus });

                    return (
                      <div key={product.Style} className="border p-2">
                        <div className="font-bold mb-1">{product.Collection} - {product.Desc} (${product.RRP} / ${product.Wholesale})</div>
                        {Object.entries(rows).map(([group, items]) => (
                          <div key={group} className="mb-2">
                            <div className="text-xs mb-1">{group}</div>
                            <div className="grid grid-cols-12 gap-1 text-center">
                              {items.map(({ sku, size }) => (
                                <div key={sku}>
                                  <div className="text-[10px]">{size}</div>
                                  <input
                                    type="number"
                                    className="w-14 border text-center"
                                    value={quantities[sku] || ""}
                                    onChange={e => handleChange(sku, e.target.value)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
