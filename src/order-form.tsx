import React, { useEffect, useState } from "react";
import axios from "axios";

const SHEET_URL =
  "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

function isShoeProduct(style: string) {
  return /[0-9]{3}[CW]$/.test(style);
}

function expandSizes(sizeStr: string, style: string) {
  if (!sizeStr) return [];
  if (sizeStr.includes(",")) return sizeStr.split(",").map((s) => s.trim());
  if (sizeStr.includes("-")) {
    const [start, end] = sizeStr.split("-").map((s) => s.trim());
    const isChild = /C$/.test(style);
    const from = parseFloat(start);
    const to = parseFloat(end);
    const result = [];
    for (let i = from; i <= to; i += 0.5) {
      result.push(i % 1 === 0 ? `${i}` : `${i}`);
    }
    return result;
  }
  return [sizeStr];
}

function generateSKU(item: any, width: string, colour: string, size: string) {
  const style = item.Style.replace("S000", "").replace("S0", "").replace("G0", "").replace("A0", "").replace("G00", "").replace("A00", "");
  const cleanColour = colour.replace(/\(.*?\)/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const padSize = (size: string) => {
    if (!isNaN(Number(size))) {
      const num = Number(size);
      return num < 10 ? `00${num}` : num < 100 ? `0${num}` : `${num}`;
    }
    return size.padStart(3, "0");
  };
  const sizePart = padSize((parseFloat(size) * 10).toString());
  if (isShoeProduct(item.Style)) {
    return `${style}${width.padStart(2, "0")}${cleanColour}${sizePart}`;
  } else {
    return `${style}${cleanColour}${padSize(size)}`;
  }
}

export default function OrderForm() {
  const [data, setData] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<{ [key: string]: any[] }>({});
  const [customerID, setCustomerID] = useState("");
  const [quantities, setQuantities] = useState<{ [sku: string]: number }>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(SHEET_URL).then((res) => {
      const rows = res.data;
      const groupedData: { [key: string]: any[] } = {};
      let currentGroup = "";
      rows.forEach((row: any) => {
        if (row.Collection && !row.Style) {
          currentGroup = row.Collection;
          groupedData[currentGroup] = [];
        } else if (row.Style) {
          groupedData[currentGroup] = groupedData[currentGroup] || [];
          groupedData[currentGroup].push(row);
        }
      });
      setGrouped(groupedData);
      setData(rows);
    });
  }, []);

  const handleChange = (sku: string, value: string) => {
    const intVal = parseInt(value);
    setQuantities({ ...quantities, [sku]: isNaN(intVal) ? 0 : intVal });
  };

  const downloadCSV = () => {
    const entries = Object.entries(quantities).filter(([, qty]) => qty > 0);
    const csv = ["SKU,Qty", ...entries.map(([sku, qty]) => `${sku},${qty}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${customerID}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalQty = Object.values(quantities).reduce((a, b) => a + (b || 0), 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const item = data.find((i) => generateSKU(i, "", "", "").startsWith(sku.slice(0, 8)));
    return sum + ((item?.Wholesale || 0) * (qty || 0));
  }, 0);

  if (!submitted) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Enter Customer ID</h2>
        <input
          type="text"
          value={customerID}
          onChange={(e) => setCustomerID(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSubmitted(true);
          }}
        />
        <button onClick={() => setSubmitted(true)}>Next</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Order Form - Customer: {customerID}</h2>
      <p>Total Qty: {totalQty} | Total $: ${totalAmount.toFixed(2)}</p>
      <button onClick={downloadCSV}>Download CSV</button>
      {Object.entries(grouped).map(([collection, items]) => (
        <div key={collection} style={{ marginTop: 30 }}>
          <h3>{collection}</h3>
          {items.map((item, idx) => {
            const sizes = expandSizes(item.Size, item.Style);
            const widths = item.Width?.split(",").map((w: string) => w.trim()) || [" "];
            const colours = item.Colours?.split(",").map((c: string) => c.trim()) || [];
            const skus = widths.flatMap((w: string) =>
              colours.flatMap((c: string) =>
                sizes.map((s: string) => generateSKU(item, w, c, s))
              )
            );
            if (!sizes.length || !colours.length) return null;
            return (
              <div key={idx} style={{ marginBottom: 20 }}>
                <strong>
                  {item.Collection} - {item.Desc} (${item.RRP} / ${item.Wholesale})
                </strong>
                <table border={1} cellPadding={5} style={{ marginTop: 10, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Width</th>
                      <th>Colour</th>
                      {sizes.map((size) => (
                        <th key={size}>{size}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {widths.map((w) =>
                      colours.map((c) => (
                        <tr key={`${w}-${c}`}>
                          <td>{w}</td>
                          <td>{c}</td>
                          {sizes.map((s) => {
                            const sku = generateSKU(item, w, c, s);
                            return (
                              <td key={sku}>
                                <input
                                  type="number"
                                  min={0}
                                  style={{ width: 40 }}
                                  value={quantities[sku] || ""}
                                  onChange={(e) => handleChange(sku, e.target.value)}
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
            );
          })}
        </div>
      ))}
    </div>
  );
}
