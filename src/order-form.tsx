
import React, { useState } from 'react';
import { saveAs } from "file-saver";

const sampleProducts = [
  {
    style: "S000V720C",
    sizes: ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5", "12", "12.5", "13", "13.5", "1", "1.5", "2", "2.5"],
    widths: ["M", "W"],
    colors: ["BLK", "CAR"],
    type: "shoe"
  },
  {
    style: "S0002050W",
    sizes: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
    widths: ["M", "W"],
    colors: ["LPK"],
    type: "shoe"
  },
  {
    style: "S0MOT100W",
    sizes: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
    widths: ["M", "W"],
    colors: ["BLK", "LPK"],
    type: "shoe"
  },
  {
    style: "A000B325U",
    sizes: ["OS"],
    colors: ["CCG", "OAT"],
    type: "accessory"
  }
];

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

  return (
    <div className="p-4 space-y-4">
      <input
        placeholder="输入客户 ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="border p-2 mb-4 w-full"
      />
      {sampleProducts.map((product) => (
        <div key={product.style} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
          <h2><strong>{product.style}</strong></h2>
          {product.colors.map((color) => (
            <div key={color}>
              <div><strong>Color: {color}</strong></div>
              {(product.widths || [""]).map((width) => (
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
      <button onClick={exportCSV} style={{ padding: "0.5rem 1rem", backgroundColor: "#4caf50", color: "#fff" }}>
        导出订单 CSV
      </button>
    </div>
  );
}
