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
  shortStyle?: string;
}

const parseSizes = (size: string) => {
  if (!size || size === "OS" || size.includes(",")) return size.split(/\s*,\s*/);
  const match = size.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
  if (!match) return [size];
  const start = parseFloat(match[1]);
  const end = parseFloat(match[3]);
  const sizes: string[] = [];
  for (let i = start; i <= end; i += 0.5) {
    sizes.push(i % 1 === 0 ? `${i}` : `${i}`);
  }
  return sizes.map((s) => (s.endsWith(".0") ? s.replace(".0", "") : s));
};

const parseColours = (col: string) => col.split(/\s*,\s*/);
const parseWidths = (width: string) => (width ? width.split(/\s*,\s*/) : [""]);

export default function OrderForm() {
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    axios
      .get("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then((res) => {
        const data = res.data;
        const result: Product[] = [];
        let currentCollection = "Uncategorized";
        data.forEach((row: any) => {
          if (!row.Style && row.Collection) {
            currentCollection = row.Collection;
            return;
          }
          if (!row.Style) return;
          result.push({ ...row, Collection: currentCollection, shortStyle: row.Collection });
        });
        setRawProducts(result);
        const grouped: Record<string, Product[]> = {};
        result.forEach((item) => {
          if (!grouped[item.Collection!]) grouped[item.Collection!] = [];
          grouped[item.Collection!].push(item);
        });
        setGroupedProducts(grouped);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    if (!/^(\d+)?$/.test(value)) return;
    setQuantities((prev) => ({ ...prev, [sku]: value }));
  };

  const generateSKU = (style: string, width: string, color: string, size: string) => {
    const suffix = size === "OS" ? "ONE" : /^(\d+(\.\d+)?)$/.test(size) ? ("000" + (parseFloat(size) * 10).toFixed(0)).slice(-3) : size;
    return `${style}-${width}${color}-${suffix}`;
  };

  const downloadCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob(["SKU,Qty\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId || "order"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 text-sm">
      <div className="mb-4">
        <label className="mr-2 font-bold">Customer ID:</label>
        <input
          className="border p-1 text-sm"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Enter Customer ID"
        />
        <button
          onClick={downloadCSV}
          className="ml-4 px-3 py-1 bg-blue-500 text-white rounded"
        >
          Download CSV
        </button>
      </div>

      {Object.entries(groupedProducts).map(([collection, products], index) => (
        <details key={collection} className="mb-6" open={false}>
          <summary className="font-bold text-lg mb-2 cursor-pointer">
            {index + 1}. {collection}
          </summary>
          {products.map((product, idx) => {
            const sizes = parseSizes(product.Size);
            const widths = parseWidths(product.Width);
            const colours = parseColours(product.Colours);
            const style = product.Style;
            const displayStyle = product.shortStyle || style;
            const showGrid = sizes.length > 0 && colours.length > 0;
            return (
              <div key={style + idx} className="mb-4">
                <h3 className="font-bold mb-2">
                  {displayStyle} - {product.Desc} (${product.Wholesale} / ${product.RRP})
                </h3>
                {showGrid ? (
                  <table className="border border-gray-400 text-center text-xs">
                    <thead>
                      <tr>
                        <th className="border px-1 py-1">Width</th>
                        <th className="border px-1 py-1">Color</th>
                        {sizes.map((sz) => (
                          <th key={sz} className="border px-1 py-1">{sz}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {widths.map((width) =>
                        colours.map((color) => (
                          <tr key={`${style}-${width}-${color}`}>
                            <td className="border px-1 py-1">{width}</td>
                            <td className="border px-1 py-1">{color}</td>
                            {sizes.map((size) => {
                              const sku = generateSKU(style, width, color, size);
                              return (
                                <td key={sku} className="border px-1 py-1">
                                  <input
                                    type="text"
                                    value={quantities[sku] || ""}
                                    onChange={(e) => handleChange(sku, e.target.value)}
                                    style={{ width: "40px", height: "30px", fontSize: "12px" }}
                                    className="text-center border"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-red-500">Missing size or color info</div>
                )}
              </div>
            );
          })}
        </details>
      ))}
    </div>
  );
}
