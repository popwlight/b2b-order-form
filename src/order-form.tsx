
import React, { useState } from 'react';
import { saveAs } from "file-saver";
import Papa from "papaparse";

function padSize(size, type) {
  if (size === "OS") return "ONE";
  if (type === "shoe") {
    const numeric = parseFloat(size);
    return String(Math.round(numeric * 10)).padStart(3, "0");
  }
  return size.padStart(3, "0");
}

function generateSKU(style, width, color, size) {
  const paddedSize = padSize(size, style.startsWith("S") ? "shoe" : "other");
  if (style.startsWith("S")) {
    return `${style}${width}${color}${paddedSize}`;
  } else {
    return `${style}${color}${paddedSize}`;
  }
}

export default function B2BOrderForm() {
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [customerId, setCustomerId] = useState("");

  const handleChange = (sku, qty) => {
    setQuantities({ ...quantities, [sku]: qty });
  };

  const exportCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const fileName = customerId.trim() || "order";
    saveAs(blob, `${fileName}.csv`);
  };

  const total = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const item = products.find(p => sku.startsWith(p.style));
    const price = item?.wholesale || 0;
    return sum + price * parseInt(qty || 0);
  }, 0);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (result) => {
        const rows = result.data;
        const map = {};
        for (const row of rows) {
          const [style, name, size, width, color, wholesale, rrp] = row;
          if (!style || !name || !size || !color || !wholesale || !rrp || wholesale === "") continue;
          const key = style;
          if (!map[key]) {
            map[key] = {
              style,
              name,
              wholesale: parseFloat(wholesale),
              rrp,
              type: style.startsWith("S") ? "shoe" : "accessory",
              colors: [],
              sizes: [],
              widths: [],
            };
          }
          if (!map[key].colors.includes(color)) map[key].colors.push(color);
          if (!map[key].sizes.includes(size)) map[key].sizes.push(size);
          if (width && !map[key].widths.includes(width)) map[key].widths.push(width);
        }
        setProducts(Object.values(map));
      }
    });
  };

  return (
    <div className="p-4 space-y-4">
      <input type="file" accept=".csv" onChange={handleUpload} className="mb-4" />
      <input
        placeholder="输入客户 ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="border p-2 mb-4 w-full"
      />
      {products.map((product) => (
        <div key={product.style} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
          <h2><strong>{product.style} - {product.name} (${product.rrp})</strong></h2>
          {product.colors.map((color) => (
            <div key={color}>
              <div><strong>Color: {color}</strong></div>
              {(product.widths.length ? product.widths : [""]).map((width) => (
                <div key={width}>
                  <div>Width: {width || "-"}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {product.sizes.map((size) => {
                      const sku = generateSKU(product.style, width, color, size);
                      return (
                        <div key={sku}>
                          <div>{size}</div>
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
      {products.length > 0 && (
        <div style={{ fontWeight: "bold", fontSize: "1.2rem" }}>
          总计: ${total.toFixed(2)}
        </div>
      )}
      {products.length > 0 && (
        <button onClick={exportCSV} style={{ padding: "0.5rem 1rem", backgroundColor: "#4caf50", color: "#fff" }}>
          导出订单 CSV
        </button>
      )}
    </div>
  );
}
