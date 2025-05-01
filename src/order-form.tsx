import React, { useEffect, useState } from "react";

type Product = {
  style: string;
  name: string;
  sizes: string[];
  widths: string[];
  colors: string[];
  wholesale: number;
  rrp: number;
};

type GroupedProduct = {
  collection: string;
  shortCode: string;
  products: Product[];
};

const parseSizes = (sizeStr: string): string[] => {
  if (!sizeStr) return [];
  const parts = sizeStr.split(",");
  if (parts.length > 1) return parts.map(s => s.trim());
  if (sizeStr.includes("-")) {
    const [start, end] = sizeStr.split("-").map(s => s.trim());
    const isChild = /C$/.test(start);
    const startNum = parseFloat(start);
    const endNum = parseFloat(end);
    if (isNaN(startNum) || isNaN(endNum)) return [sizeStr];
    const sizes: string[] = [];
    for (let s = startNum; s <= endNum + 0.001; s += 0.5) {
      sizes.push((Math.round(s * 2) / 2).toString());
    }
    return sizes;
  }
  return [sizeStr.trim()];
};

const parseWidths = (widthStr: string): string[] =>
  widthStr ? widthStr.split(",").map(w => w.trim()) : [""];

const parseColors = (colorStr: string): string[] =>
  colorStr ? colorStr.split(",").map(c => c.trim()) : [];

const generateSKU = (
  style: string,
  width: string,
  color: string,
  size: string
): string => {
  let sku = style;
  const isShoe = /^[ASG]\d{3}/.test(style);
  const isChild = /C$/.test(style);
  let sizeCode = size.toUpperCase();

  if (sizeCode === "OS") sizeCode = "ONE";
  else if (isShoe && !isNaN(parseFloat(size))) {
    const num = parseFloat(size) * 10;
    sizeCode = num.toFixed(0).padStart(3, "0");
  }

  if (/^S/.test(style)) {
    sku += width.padEnd(2, " ");
  }

  return sku + color + sizeCode;
};

export default function OrderForm() {
  const [data, setData] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [grouped, setGrouped] = useState<GroupedProduct[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(
      "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1"
    )
      .then(res => res.json())
      .then(json => {
        const result: GroupedProduct[] = [];
        let currentGroup = "";
        let currentShort = "";
        let buffer: Product[] = [];

        json.forEach(row => {
          if (row["Collection"] && !row["Style"]) {
            if (buffer.length) {
              result.push({
                collection: currentGroup,
                shortCode: currentShort,
                products: buffer
              });
              buffer = [];
            }
            currentGroup = row["Collection"];
          } else if (row["Style"]) {
            const product: Product = {
              style: row["Style"],
              name: row["Desc"] || "",
              sizes: parseSizes(row["Size"]),
              widths: parseWidths(row["Width"]),
              colors: parseColors(row["Colours"]),
              wholesale: parseFloat(row["Wholesale"] || "0"),
              rrp: parseFloat(row["RRP"] || "0")
            };
            currentShort = row["Collection"] || currentShort;
            buffer.push(product);
          }
        });
        if (buffer.length) {
          result.push({
            collection: currentGroup,
            shortCode: currentShort,
            products: buffer
          });
        }

        setGrouped(result);
        setData(json);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    setQuantities(prev => ({ ...prev, [sku]: value }));
  };

  const handleDownload = () => {
    const lines = Object.entries(quantities)
      .filter(([_, qty]) => parseInt(qty))
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientId || "order"}.csv`;
    a.click();
  };

  const totalPrice = Object.entries(quantities)
    .filter(([_, qty]) => parseFloat(qty))
    .reduce((acc, [sku, qty]) => {
      const product = grouped
        .flatMap(g => g.products)
        .find(p =>
          sku.startsWith(p.style)
        );
      return acc + (product?.wholesale || 0) * parseFloat(qty);
    }, 0);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">B2B Order Form</h1>
      <div className="mb-4">
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter Customer ID"
          className="border px-2 py-1 rounded"
        />
      </div>
      <div className="text-right font-bold mb-2">
        Total: ${totalPrice.toFixed(2)}
      </div>
      {grouped.map((group, index) => (
        <div key={index} className="mb-4 border rounded shadow-sm">
          <button
            className="w-full text-left p-2 bg-gray-100 font-bold"
            onClick={() =>
              setCollapsed(prev => ({
                ...prev,
                [group.collection]: !prev[group.collection]
              }))
            }
          >
            {index + 1}. {group.collection}
          </button>
          {!collapsed[group.collection] && (
            <div className="p-2 space-y-4">
              {group.products.map(product => (
                <div
                  key={product.style}
                  className="border p-3 rounded shadow-sm"
                >
                  <h2 className="font-semibold mb-1">
                    {group.shortCode} - {product.name} (${product.wholesale.toFixed(2)} / ${product.rrp.toFixed(2)})
                  </h2>
                  {product.colors.map(color =>
                    product.widths.map(width => (
                      <div key={`${color}-${width}`} className="mb-2">
                        <div className="text-sm mb-1">
                          Colour: {color} | Width: {width || "-"}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.sizes.map(size => {
                            const sku = generateSKU(
                              product.style,
                              width,
                              color,
                              size
                            );
                            return (
                              <div key={sku} className="text-center">
                                <div className="text-xs">{size}</div>
                                <input
                                  type="number"
                                  min="0"
                                  value={quantities[sku] || ""}
                                  onChange={e =>
                                    handleChange(sku, e.target.value)
                                  }
                                  className="w-16 border px-1 py-0.5 rounded text-sm"
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
      <div className="mt-6">
        <button
          onClick={handleDownload}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Download Order
        </button>
      </div>
    </div>
  );
}
