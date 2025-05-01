import React, { useEffect, useState } from "react";
import axios from "axios";

const SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

const parseSizes = (sizeRange: string) => {
  if (!sizeRange) return [];
  if (sizeRange.includes(",")) return sizeRange.split(",").map((s) => s.trim());
  if (!sizeRange.includes("-")) return [sizeRange.trim()];
  const result: string[] = [];
  const [start, end] = sizeRange.split("-").map((s) => s.trim());
  const numStart = parseFloat(start);
  const numEnd = parseFloat(end);
  if (!isNaN(numStart) && !isNaN(numEnd)) {
    for (let i = numStart; i <= numEnd; i += 0.5) {
      result.push(i % 1 === 0 ? `${i}` : `${Math.floor(i)}.5`);
    }
  } else {
    result.push(sizeRange);
  }
  return result;
};

const App = () => {
  const [data, setData] = useState<any[]>([]);
  const [groupedData, setGroupedData] = useState<Record<string, any[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    axios.get(SHEET_URL).then((res) => {
      const raw = res.data;
      const grouped: Record<string, any[]> = {};
      let currentCollection = "";
      raw.forEach((row: any) => {
        const hasCollection = row.Collection && !row.Style;
        if (hasCollection) {
          currentCollection = row.Collection.trim();
          grouped[currentCollection] = [];
        } else if (row.Style && currentCollection) {
          if (!grouped[currentCollection]) grouped[currentCollection] = [];
          grouped[currentCollection].push(row);
        }
      });
      setData(raw);
      setGroupedData(grouped);
    });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const intValue = parseInt(value);
    if (!isNaN(intValue)) {
      setQuantities({ ...quantities, [sku]: intValue });
    } else {
      const updated = { ...quantities };
      delete updated[sku];
      setQuantities(updated);
    }
  };

  const generateSKU = (item: any, size: string, width: string, color: string) => {
    const base = item.Style.replace(/[^A-Z0-9]/g, "");
    const isShoe = /\d/.test(item.Size);
    const shortSize = isShoe
      ? String(size.includes(".") ? parseFloat(size) * 10 : parseInt(size) * 10).padStart(3, "0")
      : size.toUpperCase() === "ONE" || size === "OS"
      ? "ONE"
      : size;
    const widthFixed = width ? width.padStart(2, "0") : "";
    return isShoe ? `${base}${shortSize}${widthFixed}${color}` : `${base}${shortSize}${color}`;
  };

  const exportCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const csv = `SKU,Qty\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId || "order"}.csv`;
    a.click();
  };

  const totalQty = Object.values(quantities).reduce((sum, val) => sum + val, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const item = data.find((row) => {
      const sizes = parseSizes(row.Size);
      const widths = row.Width ? row.Width.split(",").map((w: string) => w.trim()) : [""];
      const colours = row.Colours ? row.Colours.split(",").map((c: string) => c.trim()) : [""];
      return sizes.some((s) => widths.some((w) => colours.some((col) => {
        return generateSKU(row, s, w, col) === sku;
      })));
    });
    return item && item.Wholesale ? sum + qty * parseFloat(item.Wholesale) : sum;
  }, 0);

  if (!showForm) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Enter Customer ID</h2>
        <input
          type="text"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          placeholder="Customer ID"
        />
        <button onClick={() => setShowForm(true)}>Next</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Order Form - {customerId}</h2>
      <p>Total Quantity: {totalQty}</p>
      <p>Total Amount: ${totalAmount.toFixed(2)}</p>
      <button onClick={exportCSV}>Download CSV</button>
      {Object.entries(groupedData).map(([collection, group], idx) => {
        const hasWholesale = group.some((item) => item.Wholesale);
        if (!hasWholesale) return null;

        return (
          <details key={collection} open={false} style={{ marginBottom: 20 }}>
            <summary>
              {idx + 1}. {collection} ({group[0]?.Collection})
            </summary>
            {group.map((item, i) => {
              if (!item.Wholesale || !item.Size || !item.Colours) return null;
              const sizes = parseSizes(item.Size);
              const widths = item.Width ? item.Width.split(",").map((w: string) => w.trim()) : [""];
              const colours = item.Colours.split(",").map((c: string) => c.trim());
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <b>
                    {item.Collection} - {item.Desc} (${item.RRP} / ${item.Wholesale})
                  </b>
                  <table style={{ borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <thead>
                      <tr>
                        <th>Colour</th>
                        {sizes.map((size) => (
                          <th key={size}>{size}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {colours.map((color) => (
                        widths.map((width) => (
                          <tr key={`${color}-${width}`}>
                            <td>{color} {width}</td>
                            {sizes.map((size) => {
                              const sku = generateSKU(item, size, width, color);
                              return (
                                <td key={sku}>
                                  <input
                                    type="number"
                                    value={quantities[sku] || ""}
                                    onChange={(e) => handleChange(sku, e.target.value)}
                                    style={{ width: "45px" }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </details>
        );
      })}
    </div>
  );
};

export default App;
