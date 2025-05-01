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

interface GroupedProduct {
  fullStyle: string;
  style: string;
  desc: string;
  wholesale: number;
  rrp: number;
  sizes: string[];
  widths: string[];
  colours: string[];
}

const SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

export default function OrderForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [grouped, setGrouped] = useState<Record<string, GroupedProduct[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    axios.get(SHEET_URL).then((res) => {
      const rows = res.data.filter((row: Product) => row.Style || row.Collection);
      const parsed: Product[] = [];
      let currentCollection = "";
      for (const row of rows) {
        if (row.Collection && !row.Style) {
          currentCollection = row.Collection;
        } else {
          parsed.push({ ...row, Collection: currentCollection });
        }
      }
      setProducts(parsed);
    });
  }, []);

  useEffect(() => {
    const groupedData: Record<string, GroupedProduct[]> = {};
    const map = new Map<string, GroupedProduct>();

    products.forEach((item) => {
      if (!item.Wholesale || isNaN(Number(item.Wholesale))) return;
      const key = `${item.Style}-${item.Colours}-${item.Size}-${item.Width}`;
      const fullStyle = item.Style.trim();
      const style = item.Collection.trim();
      const desc = item.Desc;
      const wholesale = parseFloat(item.Wholesale);
      const rrp = parseFloat(item.RRP || "0");
      const sizes = item.Size.split(",").map((s) => s.trim());
      const widths = item.Width.split(",").map((w) => w.trim());
      const colours = item.Colours.split(",").map((c) => c.trim());

      colours.forEach((color) => {
        const gkey = `${fullStyle}-${color}`;
        if (!map.has(gkey)) {
          const group: GroupedProduct = {
            fullStyle,
            style,
            desc,
            wholesale,
            rrp,
            sizes: [],
            widths: [],
            colours: [],
          };
          map.set(gkey, group);
        }
        const g = map.get(gkey)!;
        sizes.forEach((s) => {
          if (!g.sizes.includes(s)) g.sizes.push(s);
        });
        widths.forEach((w) => {
          if (!g.widths.includes(w)) g.widths.push(w);
        });
        if (!g.colours.includes(color)) g.colours.push(color);
      });
    });

    map.forEach((item) => {
      if (!groupedData[item.style]) groupedData[item.style] = [];
      groupedData[item.style].push(item);
    });

    setGrouped(groupedData);
  }, [products]);

  const handleChange = (sku: string, value: string) => {
    const qty = parseInt(value);
    if (!isNaN(qty)) {
      setQuantities((prev) => ({ ...prev, [sku]: qty }));
    }
  };

  const isShoe = (style: string) => /[CW]$/.test(style);

  const formatSize = (size: string, shoe: boolean) => {
    if (shoe) {
      const num = parseFloat(size);
      if (isNaN(num)) return size;
      return String(Math.round(num * 10)).padStart(3, "0");
    } else {
      return size.trim().padStart(3, "0");
    }
  };

  const buildSKU = (p: GroupedProduct, width: string, color: string, size: string) => {
    const sizeFormatted = formatSize(size, isShoe(p.fullStyle));
    if (isShoe(p.fullStyle)) {
      return `${p.fullStyle}${width.padStart(2, "0")}${color}${sizeFormatted}`;
    } else {
      return `${p.fullStyle}${color}${sizeFormatted}`;
    }
  };

  const handleDownload = () => {
    const lines = ["SKU,Qty"];
    Object.entries(quantities).forEach(([sku, qty]) => {
      if (qty > 0) lines.push(`${sku},${qty}`);
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customerId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!submitted) {
    return (
      <div className="p-4">
        <label className="text-lg font-bold mr-2">Enter Customer ID:</label>
        <input
          className="border p-2"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSubmitted(true);
          }}
        />
        <button
          className="ml-2 px-4 py-2 bg-blue-600 text-white"
          onClick={() => setSubmitted(true)}
        >
          Next
        </button>
      </div>
    );
  }

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalValue = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    for (const groups of Object.values(grouped)) {
      for (const p of groups) {
        for (const color of p.colours) {
          for (const width of p.widths) {
            for (const size of p.sizes) {
              const s = buildSKU(p, width, color, size);
              if (s === sku) return sum + p.wholesale * qty;
            }
          }
        }
      }
    }
    return sum;
  }, 0);

  return (
    <div className="p-4">
      <div className="mb-4 flex justify-between">
        <div>
          <span className="font-bold">Customer ID:</span> {customerId}
        </div>
        <div>
          <button
            className="bg-green-600 text-white px-4 py-2"
            onClick={handleDownload}
          >
            Download CSV
          </button>
        </div>
      </div>
      <div className="mb-4">
        <span className="font-bold">Total Qty:</span> {totalQty} &nbsp;|&nbsp;
        <span className="font-bold">Total Value:</span> ${totalValue.toFixed(2)}
      </div>
      {Object.entries(grouped).map(([collection, items]) => (
        <div key={collection} className="mb-6">
          <h2
            className="text-xl font-bold cursor-pointer bg-gray-200 p-2"
            onClick={() =>
              setCollapsed((prev) => ({
                ...prev,
                [collection]: !prev[collection],
              }))
            }
          >
            {collection} ({collapsed[collection] ? "Show" : "Hide"})
          </h2>
          {!collapsed[collection] &&
            items.map((p) => (
              <div key={p.fullStyle + p.colours.join(",")} className="my-4">
                <h3 className="font-semibold text-lg">
                  {p.fullStyle} - {p.desc} (${p.rrp.toFixed(2)} / ${
                    p.wholesale
                  })
                </h3>
                <div className="overflow-x-auto">
                  <table className="table-auto border mt-2 text-sm">
                    <thead>
                      <tr>
                        <th className="border px-1 py-1">Colour</th>
                        <th className="border px-1 py-1">Width</th>
                        {p.sizes.map((size) => (
                          <th key={size} className="border px-1 py-1">
                            {size}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {p.colours.map((color) =>
                        p.widths.map((width) => (
                          <tr key={color + width}>
                            <td className="border px-1 py-1">{color}</td>
                            <td className="border px-1 py-1">{width}</td>
                            {p.sizes.map((size) => {
                              const sku = buildSKU(p, width, color, size);
                              return (
                                <td key={sku} className="border px-1 py-1">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-12 border px-1"
                                    value={quantities[sku] || ""}
                                    onChange={(e) =>
                                      handleChange(sku, e.target.value)
                                    }
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
