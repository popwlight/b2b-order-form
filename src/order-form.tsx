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

const expandSizes = (sizeStr: string): string[] => {
  if (sizeStr.includes(",")) return sizeStr.split(",").map((s) => s.trim());
  if (sizeStr.includes(" - ")) {
    const [start, end] = sizeStr.split(" - ").map((s) => s.trim());
    const isChild = /[a-zA-Z]/.test(start);
    const list: string[] = [];

    const parse = (v: string) => (isNaN(Number(v)) ? v : parseFloat(v));
    const from = parse(start);
    const to = parse(end);
    const current = parseFloat(from);

    if (typeof current === "number") {
      let val = current;
      while (val <= to) {
        list.push(val % 1 === 0 ? val.toFixed(0) : val.toFixed(1));
        val += 0.5;
      }
      return list.map((s) => {
        const num = parseFloat(s);
        if (num < 10) return `0${(num * 10).toFixed(0)}`;
        return `${(num * 10).toFixed(0)}`;
      });
    }
    return [sizeStr];
  }
  return [sizeStr];
};

export default function OrderForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState<string>("");

  useEffect(() => {
    axios
      .get("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then((res) => {
        const data = res.data as Product[];
        const cleaned = data.filter((d) => d.Style || d.Collection);
        const grouped: Record<string, Product[]> = {};
        let currentGroup = "";
        cleaned.forEach((row) => {
          if (row.Collection && !row.Style) {
            currentGroup = row.Collection.trim();
            grouped[currentGroup] = [];
          } else if (row.Style) {
            grouped[currentGroup] = grouped[currentGroup] || [];
            grouped[currentGroup].push(row);
          }
        });
        setGrouped(grouped);
        setProducts(cleaned);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const qty = parseInt(value);
    if (!isNaN(qty)) {
      setQuantities({ ...quantities, [sku]: qty });
    }
  };

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);

  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const product = products.find((p) => sku.startsWith(p.Style));
    if (!product || !product.Wholesale) return sum;
    const price = parseFloat(product.Wholesale);
    return sum + price * qty;
  }, 0);

  const generateSKU = (style: string, width: string, color: string, size: string) => {
    if (size.toLowerCase() === "os" || size.toLowerCase() === "one") return `${style}-${color}-ONE`;
    if (/^[0-9]+(\.[0-9])?$/.test(size)) return `${style}-${color}-${size.padStart(3, "0")}`;
    return `${style}-${color}-${size}`;
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-2">B2B Order Form</h1>
      {!customerId ? (
        <div>
          <label className="font-semibold">Enter Customer ID:</label>
          <input
            type="text"
            className="border ml-2 p-1"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
        </div>
      ) : (
        <>
          {Object.entries(grouped).map(([collection, items], index) => (
            <details key={collection} className="mb-4" open={false}>
              <summary className="text-lg font-bold cursor-pointer">
                {index + 1}. {collection}
              </summary>
              {items.map((product) => {
                const shortStyle = product.Style.replace(/^S0+|^A0+|^G0+|^F0+|^B0+/i, "");
                const widths = product.Width?.split(",").map((w) => w.trim()) || [""];
                const colors = product.Colours?.split(",").map((c) => c.trim()) || [];
                const sizes = expandSizes(product.Size);

                return (
                  <div key={product.Style} className="border p-2 my-2">
                    <h2 className="font-semibold mb-1">
                      {shortStyle} - {product.Desc} (${product.Wholesale} / ${product.RRP})
                    </h2>
                    {colors.map((color) => (
                      <div key={color} className="mb-2">
                        <div className="font-semibold">Color: {color}</div>
                        {widths.map((width) => (
                          <div key={width}>
                            <div>Width: {width || "-"}</div>
                            <div className="overflow-x-auto">
                              <table className="table-auto border mt-1">
                                <thead>
                                  <tr>
                                    {sizes.map((size) => (
                                      <th key={size} className="px-2 border text-sm">
                                        {size}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {sizes.map((size) => {
                                      const sku = generateSKU(product.Style, width, color, size);
                                      return (
                                        <td key={sku} className="border">
                                          <input
                                            type="number"
                                            className="w-16 p-1 text-sm border"
                                            value={quantities[sku] || ""}
                                            onChange={(e) => handleChange(sku, e.target.value)}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tbody>
                              </table>
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
          <div className="mt-4 font-bold">
            Total Quantity: {totalQty} | Total Wholesale Amount: ${totalAmount.toFixed(2)}
          </div>
        </>
      )}
    </div>
  );
}
