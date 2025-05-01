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

interface OrderItem {
  sku: string;
  quantity: number;
}

const expandSizes = (sizeRange: string, isShoe: boolean) => {
  const result: string[] = [];
  const sizeMap: Record<string, number> = {
    XXS: 0,
    XS: 1,
    S: 2,
    M: 3,
    L: 4,
    XL: 5,
    XXL: 6,
    ONE: 7,
    OS: 7,
  };

  if (sizeRange.includes(",")) {
    return sizeRange.split(",").map((s) => s.trim());
  }

  const [start, end] = sizeRange.split("-").map((s) => s.trim());

  const toNum = (val: string) => {
    if (!isNaN(parseFloat(val))) return parseFloat(val);
    return sizeMap[val] ?? val;
  };

  if (!isNaN(Number(start)) && !isNaN(Number(end))) {
    let current = parseFloat(start);
    while (current <= parseFloat(end)) {
      result.push(current % 1 === 0 ? `${current}` : `${current}`);
      current += 0.5;
    }
    return result;
  }

  return sizeRange.split(",").map((s) => s.trim());
};

const isShoeProduct = (style: string) => {
  return /C$|W$|F$/.test(style);
};

const pad = (val: string | number, len: number) => {
  return String(val).padStart(len, "0");
};

const generateSKU = (product: Product, color: string, width: string, size: string) => {
  const style = product.Style.replace(/^S0*|^A0*|^G0*/i, "");
  const colorCode = color.trim();
  const widthCode = pad(width.trim(), 2);
  const sizeNum = parseFloat(size);
  const sizeCode = isNaN(sizeNum)
    ? pad(size.trim(), 3)
    : pad(Math.round(sizeNum * 10), 3);

  if (isShoeProduct(product.Style)) {
    return `${style}${widthCode}${colorCode}${sizeCode}`;
  } else {
    return `${style}${colorCode}${sizeCode}`;
  }
};

const OrderForm: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    axios
      .get(
        "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1"
      )
      .then((res) => {
        const rows = res.data as Product[];
        const parsed: Record<string, Product[]> = {};
        let currentCollection = "";
        for (const row of rows) {
          if (!row.Style && row.Collection) {
            currentCollection = row.Collection;
            parsed[currentCollection] = [];
          } else if (row.Style) {
            if (!parsed[currentCollection]) parsed[currentCollection] = [];
            parsed[currentCollection].push(row);
          }
        }
        setGrouped(parsed);
        setProducts(rows.filter((r) => r.Style));
      });
  }, []);

  useEffect(() => {
    let sum = 0;
    for (const sku in quantities) {
      const qty = quantities[sku];
      const found = products.find((p) => sku.startsWith(p.Style.replace(/^S0*|^A0*|^G0*/i, "")));
      if (qty && found) {
        sum += qty * parseFloat(found.Wholesale || "0");
      }
    }
    setTotal(sum);
  }, [quantities]);

  const handleQuantityChange = (sku: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [sku]: qty }));
  };

  const handleExport = () => {
    const rows: string[] = ["SKU,Quantity"];
    for (const sku in quantities) {
      const qty = quantities[sku];
      if (qty > 0) {
        rows.push(`${sku},${qty}`);
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId || "order"}.csv`;
    a.click();
  };

  if (!customerId) {
    return (
      <div className="p-4">
        <h2 className="text-xl mb-2">Enter Customer ID</h2>
        <input
          className="border p-2"
          onKeyDown={(e) => {
            if (e.key === "Enter") setCustomerId((e.target as HTMLInputElement).value);
          }}
        />
        <button
          className="ml-2 px-3 py-1 bg-blue-500 text-white"
          onClick={() => {
            const input = document.querySelector("input");
            if (input) setCustomerId(input.value);
          }}
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Total: ${total.toFixed(2)}</h2>
      <button
        onClick={handleExport}
        className="mb-4 px-4 py-2 bg-green-600 text-white"
      >
        Export CSV
      </button>
      {Object.entries(grouped).map(([collection, items], idx) => (
        <div key={collection} className="mb-6">
          <h3
            className="text-lg font-semibold cursor-pointer"
            onClick={() => setExpanded((prev) => ({
              ...prev,
              [collection]: !prev[collection],
            }))}
          >
            {idx + 1}. {collection} {expanded[collection] ? "▲" : "▼"}
          </h3>
          {expanded[collection] && items.map((product, i) => (
            <div key={`${product.Style}-${i}`} className="my-4">
              <h4 className="font-bold">
                {product.Collection?.replace(/ .*/, "")}: {product.Desc} (${product.Wholesale} / ${product.RRP})
              </h4>
              {product.Colours && product.Size && (
                <table className="table-auto border mt-2 text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2">Colour</th>
                      {expandSizes(product.Size, isShoeProduct(product.Style)).map((size) => (
                        <th key={size} className="border px-1">{size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {product.Colours.split(",").map((color) => (
                      <tr key={color}>
                        <td className="border px-2">{color}</td>
                        {expandSizes(product.Size, isShoeProduct(product.Style)).map((size) => {
                          const widths = product.Width ? product.Width.split(",") : [""];
                          const width = widths[0];
                          const sku = generateSKU(product, color, width, size);
                          return (
                            <td key={sku} className="border p-1">
                              <input
                                className="w-12 text-center border"
                                type="number"
                                min="0"
                                max="999"
                                value={quantities[sku] || ""}
                                onChange={(e) => handleQuantityChange(sku, parseInt(e.target.value) || 0)}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default OrderForm;
