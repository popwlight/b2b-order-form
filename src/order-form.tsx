import React, { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';

function padSize(size: string, type: string) {
  if (size === "OS") return "ONE";
  if (type === "shoe") {
    const numeric = parseFloat(size);
    return String(Math.round(numeric * 10)).padStart(3, "0");
  }
  return size.padStart(3, "0");
}

function generateSKU(style: string, width: string, color: string, size: string) {
  const paddedSize = padSize(size, style.startsWith("S") ? "shoe" : "other");
  if (style.startsWith("S")) {
    return `${style}${width}${color}${paddedSize}`;
  } else {
    return `${style}${color}${paddedSize}`;
  }
}

export default function B2BOrderForm() {
  const [products, setProducts] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<{ [sku: string]: string }>({});
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    fetch("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then(res => res.json())
      .then((rows) => {
        const map: { [style: string]: any } = {};
        for (const row of rows) {
          const {
  Style,
  Desc: Name,
  Size,
  Width,
  Colours: Color,
  Wholesale: wholesale,
  RRP
} = row;

          if (!Style || !Name || !Size || !Color || !wholesale || !RRP) continue;
          if (!map[Style]) {
            map[Style] = {
              style: Style,
              name: Name,
              wholesale: parseFloat(wholesale),
              rrp: RRP,
              type: Style.startsWith("S") ? "shoe" : "other",
              colors: [],
              sizes: [],
              widths: [],
            };
          }
          if (!map[Style].colors.includes(Color)) map[Style].colors.push(Color);
          if (!map[Style].sizes.includes(Size)) map[Style].sizes.push(Size);
          if (Width && !map[Style].widths.includes(Width)) map[Style].widths.push(Width);
        }
        setProducts(Object.values(map));
      });
  }, []);

  const handleChange = (sku: string, qty: string) => {
    setQuantities({ ...quantities, [sku]: qty });
  };

  const exportCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const fileName = customerId.trim() || "order";
    saveAs(blob, `${fileName}.csv`);
  };

  const total = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const item = products.find(p => sku.startsWith(p.style));
    const price = item?.wholesale || 0;
    return sum + price * parseInt(qty || "0");
  }, 0);

  return (
    <div className="p-4 space-y-4">
      <input
        placeholder="输入客户 ID"
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="border p-2 mb-4 w-full"
      />
      {products.map((product) => (
        <div key={product.style} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
          <h2><strong>{product.style} - {product.name} (${product.rrp})</strong></h2>
          {product.colors.map((color: string) => (
            <div key={color}>
              <div><strong>Color: {color}</strong></div>
              {(product.widths.length ? product.widths : [""]).map((width: string) => (
                <div key={width}>
                  <div>Width: {width || "-"}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {product.sizes.map((size: string) => {
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
