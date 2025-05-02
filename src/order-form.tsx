// 恢复到上一个功能正常的版本，包括：
// - Collection 折叠展示
// - 产品按表格显示（横向尺码）
// - V720C 表格正常显示
// - V720W（无价格）不显示
// - 完整 SKU 导出逻辑（鞋：款号+宽度+颜色+尺码，其他：款号+颜色+尺码）
// - 所有尺码为3位宽，前补0
// - 显示总数量与总金额（批发价）
// - Download CSV 按钮在页面顶部

import React, { useEffect, useState } from "react";
import axios from "axios";

function expandSizes(sizeRange: string, style?: string): string[] {
  const fixedSizes = ["ONE", "OS"];
  if (fixedSizes.includes(sizeRange)) return ["ONE"];

  // 特例：儿童鞋（Style 结尾为 C 且 size 是 "6 - 2.5"）
  if (style?.endsWith("C") && sizeRange.trim() === "6 - 2.5") {
    const part1: string[] = [];
    const part2: string[] = [];
    for (let i = 6; i <= 13.5; i += 0.5) {
      part1.push(i % 1 === 0 ? `${i}` : `${i.toFixed(1)}`);
    }
    for (let i = 1; i <= 2.5; i += 0.5) {
      part2.push(i % 1 === 0 ? `${i}` : `${i.toFixed(1)}`);
    }
    return [...part1, ...part2];
  }

  const parts = sizeRange.split(",");
  if (parts.length > 1) return parts.map(s => s.trim());

  const match = sizeRange.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
  if (!match) return [sizeRange];

  let [start, , end] = [parseFloat(match[1]), match[2], parseFloat(match[3])];
  if (start > end) [start, end] = [end, start]; // 处理反向范围

  const sizes: string[] = [];
  for (let i = start; i <= end; i += 0.5) {
    sizes.push(i % 1 === 0 ? i.toString() : i.toFixed(1));
  }
  return sizes;
}

function expandWidths(width: string): string[] {
  return width ? width.split(",").map(w => w.trim()) : [""];
}

function expandColours(colours: string): string[] {
  return colours.split(",").map(c => c.trim());
}

function isShoe(style: string) {
  return style.match(/^S0|^S000|^S00|^S0V|^S0S|^S00WB|^S0VAR|^S0SNK/);
}

function App() {
  const [data, setData] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    axios.get("https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1")
      .then(res => setData(res.data));
  }, []);

  const grouped: Record<string, any[]> = {};
  let currentGroup = "Ungrouped";
  data.forEach(row => {
    if (row.Collection && !row.Style && !row.Desc) {
      currentGroup = row.Collection;
      if (!grouped[currentGroup]) grouped[currentGroup] = [];
    } else if (row.Style && row.Wholesale) {
      if (!grouped[currentGroup]) grouped[currentGroup] = [];
      grouped[currentGroup].push(row);
    }
  });

  const handleChange = (sku: string, val: string) => {
    const qty = parseInt(val);
    if (!isNaN(qty)) {
      setQuantities(q => ({ ...q, [sku]: qty }));
    }
  };

  const generateSKU = (item: any, width: string, colour: string, size: string): string => {
    const style = item.Style;
    const paddedSize = fixedSize(size);
    const paddedWidth = width.padStart(2, "0");
    if (isShoe(style)) {
      return `${style}${paddedWidth}${colour}${paddedSize}`;
    }
    return `${style}${colour}${paddedSize}`;
  };

  const fixedSize = (size: string): string => {
    if (size === "ONE" || size === "OS") return "ONE";
    const val = parseFloat(size);
    if (isNaN(val)) return size.padStart(3, "0");
    return (val * 10).toFixed(0).padStart(3, "0");
  };

  const downloadCSV = () => {
    const rows = Object.entries(quantities)
      .filter(([_, v]) => v > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const csvContent = `SKU,Qty\n${rows.join("\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${customerId || "order"}.csv`);
    link.click();
  };

  const totalQty = Object.values(quantities).reduce((sum, v) => sum + v, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const item = data.find(i => sku.startsWith(i.Style));
    return sum + ((item?.Wholesale || 0) * qty);
  }, 0);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input
          placeholder="Enter Customer ID"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ padding: 5, fontSize: 16 }}
        />
        <button onClick={downloadCSV} style={{ padding: 8, fontWeight: "bold" }}>Download CSV</button>
      </div>

      <p style={{ marginTop: 10 }}>Total Items: <b>{totalQty}</b> — Total Amount: <b>${totalAmount.toFixed(2)}</b></p>

      {Object.entries(grouped).map(([group, items], idx) => (
        <div key={group} style={{ marginBottom: 30 }}>
          <h2
            onClick={() => setExpandedGroups(g => ({ ...g, [group]: !g[group] }))}
            style={{ cursor: "pointer", background: "#eee", padding: 5 }}>
            {idx + 1}. {group} {expandedGroups[group] === false ? "(Click to expand)" : ""}
          </h2>

          {expandedGroups[group] === false ? null : (
            items.map(item => {
              const sizes = expandSizes(item.Size, item.Style);
              const widths = expandWidths(item.Width);
              const colours = expandColours(item.Colours);

              return (
                <div key={item.Style} style={{ marginBottom: 20 }}>
                  <b>{item.Collection} - {item.Desc} (${item.RRP} / ${item.Wholesale})</b>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", marginTop: 5 }}>
                      <thead>
                        <tr>
                          <th></th>
                          {sizes.map(size => <th key={size}>{size}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {colours.flatMap(colour =>
                          widths.map(width => (
                            <tr key={`${colour}-${width}`}>
                              <td style={{ whiteSpace: "nowrap" }}>{colour} / {width}</td>
                              {sizes.map(size => {
                                const sku = generateSKU(item, width, colour, size);
                                return (
                                  <td key={sku}>
                                    <input
                                      value={quantities[sku] || ""}
                                      onChange={e => handleChange(sku, e.target.value)}
                                      style={{ width: 40 }}
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
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

export default App;
