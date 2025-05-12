// 恢复到上一个功能正常的版本，包括：
// - Collection 折叠展示
// - 产品按表格显示（横向尺码）
// - V720C 表格正常显示
// - V720W（无价格）不显示
// - 完整 SKU 导出逻辑（鞋：款号+宽度+颜色+尺码，其他：款号+颜色+尺码）
// - 所有尺码为3位宽，前补0
// - 显示总数量与总金额（批发价）
// - Download CSV 按钮在页面顶部

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useSearchParams } from 'react-router-dom'; 

function expandSizes(sizeRange: string, style?: string): string[] {
  const fixedSizes = ["ONE", "OS"];
  if (fixedSizes.includes(sizeRange)) return ["ONE"];

  // ✅ 处理特殊尺码注释如 "Tween: I, M, L"
  const specialMatch = sizeRange.match(/^([^:]+):\s*(.+)$/);
  if (specialMatch) {
    const prefix = specialMatch[1].trim();
    const sizes = specialMatch[2].split(",").map(s => s.trim());
    return sizes.map(s => `${prefix} ${s}`);
  }

  // ✅ C结尾的款式 + 环形尺码，如 "10 - 3"
  if (style?.endsWith("C")) {
    const match = sizeRange.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
    if (match) {
      const start = parseFloat(match[1]);
      const end = parseFloat(match[3]);
      const part1: string[] = [];
      const part2: string[] = [];

      for (let i = start; i <= 13.5; i += 0.5) {
        part1.push(i % 1 === 0 ? `${i}` : `${i.toFixed(1)}`);
      }
      for (let i = 1; i <= end; i += 0.5) {
        part2.push(i % 1 === 0 ? `${i}` : `${i.toFixed(1)}`);
      }
      return [...part1, ...part2];
    }
  }

  // ✅ 普通逗号分隔格式
  const parts = sizeRange.split(",");
  if (parts.length > 1) return parts.map(s => s.trim());

  // ✅ 普通范围格式，如 "4 - 12"
  const match = sizeRange.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
  if (match) {
    let start = parseFloat(match[1]);
    let end = parseFloat(match[3]);
    if (start > end) [start, end] = [end, start];

    const onlyWholeSizes = sizeRange.toLowerCase().includes("whole sizes only");
    const sizes: string[] = [];

    for (let i = start; i <= end; i += 0.5) {
      const isWhole = i % 1 === 0;
      if (onlyWholeSizes && !isWhole) continue;
      sizes.push(isWhole ? `${i}` : i.toFixed(1));
    }

    return sizes;
  }

  // 默认返回原值
  return [sizeRange];
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
  

const searchParams = new URLSearchParams(window.location.search);
const initialSheet = searchParams.get("sheet") || "Limited Fashion";
const [sheetName, setSheetName] = useState(initialSheet);

const sheetOptions = ["Summer 2026", "Limited Fashion"]; // 替换为你实际的 sheet 名字列表

  const [data, setData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customerId, setCustomerId] = useState("");
  const [email, setEmail] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [styleMap, setStyleMap] = useState<Record<string, any>>({});

useEffect(() => {
  axios.get(`https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/${sheetName}`)
    .then(res => {
      setData(res.data);

      const map: Record<string, any> = {};
      res.data.forEach(i => {
        if (i.Style) map[i.Style] = i;
      });
      setStyleMap(map);

      const expanded: Record<string, boolean> = {};
      let currentGroup: string | null = null;
      for (const row of res.data) {
        if (row.Collection && !row.Style && !row.Desc) {
          if (currentGroup === null) {
            currentGroup = row.Collection;
            expanded[row.Collection] = true;
          } else {
            expanded[row.Collection] = false;
          }
        }
      }
      setExpandedGroups(expanded);
    });
}, [sheetName]);

const sendEmail = async () => {
  const hasOrder = Object.values(quantities).some(qty => qty > 0);
  if (!hasOrder) {
    alert("❌ No items ordered. Please enter quantities before sending.");
    return;
  }
  if (!email) {
    alert("Please enter an email address.");
    return;
  }

  // 生成 CSV 内容
  const rows = Object.entries(quantities)
    .filter(([_, v]) => v > 0)
    .map(([sku, qty]) => `${sku},${qty}`);
  const csvContent = `SKU,Qty\r\n${rows.join("\r\n")}`;

  // 生成 HTML 表格
  let htmlTable = "<table border='1' cellpadding='6' cellspacing='0'><tr><th>SKU</th><th>Qty</th></tr>";
  Object.entries(quantities).forEach(([sku, qty]) => {
    if (qty > 0) {
      htmlTable += `<tr><td>${sku}</td><td>${qty}</td></tr>`;
    }
  });
  htmlTable += "</table>";

  // ✅ 加入下单时间、数量、金额
  const now = new Date();
  const orderTime = `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")} ${now
    .getHours()
    .toString()
    .padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const summaryHtml = `
    <p><b>Customer ID:</b> ${customerId || "Unnamed Customer"}</p>
    <p><b>Order Time:</b> ${orderTime}</p>
    <p><b>Total Quantity:</b> ${totalQty}</p>
    <p><b>Total Amount:</b> $${totalAmount.toFixed(2)}</p>
  `;

  const htmlContent = `
  <div style="display: flex; align-items: center; margin-bottom: 20px;">
    <img src="https://www.capezio.au/static/version1745830218/frontend/Aws/capezio/en_AU/images/logo.svg" alt="Logo" style="height: 20.64px; margin-right: 20px;" />
    <h3 style="margin: 0;">Order Summary</h3>
  </div>
  ${summaryHtml}
  ${htmlTable}
`;

  const encodeToBase64 = (str: string) => {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    utf8Bytes.forEach(b => (binary += String.fromCharCode(b)));
    return btoa(binary);
  };

  const res = await fetch("https://bmaswingemail.capezioaustralia.workers.dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject: `B2B Order from ${customerId || "Unnamed Customer"}`,
      htmlContent,
      csvContent: encodeToBase64(csvContent),
    }),
  });

  const result = await res.json();
  if (res.ok) {
    alert("✅ Email sent successfully.");
  } else {
    alert("❌ Failed to send: " + result.error);
  }
};

  
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

  // 去除注释前缀（如 "Tween I" -> "I"）
  const parts = size.trim().split(" ");
  const rawSize = parts.length > 1 ? parts.slice(-1)[0] : size;

  // 去掉斜杠（如 S/M → SM）并补足3位
  const clean = rawSize.replace("/", "").toUpperCase();
  const num = parseFloat(clean);

  if (!isNaN(num)) {
    return (num * 10).toFixed(0).padStart(3, "0"); // 数值类型，如 10.5 → 105
  }

  return clean.padStart(3, "0"); // 非数字，如 SM → 0SM, I → 00I
};

  const downloadCSV = () => {
   const hasOrder = Object.values(quantities).some(qty => qty > 0);
  if (!hasOrder) {
    alert("❌ No items ordered. Please enter quantities before downloading.");
    return;
  }
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
    const styleCode = sku.substring(0, 9);
    const item = styleMap[styleCode];
    return sum + ((parseFloat(item?.Wholesale) || 0) * qty);
  }, 0);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.trim().split("\n");

      const header = lines[0].trim();
      if (header !== "SKU,Qty") {
        alert("Invalid file format. Please import a file exported from this system.");
        return;
      }

      const imported: Record<string, number> = {};
      lines.slice(1).forEach(line => {
        const [sku, qtyStr] = line.trim().split(",");
        const qty = parseInt(qtyStr);
        if (sku && !isNaN(qty)) {
          imported[sku] = qty;
        }
      });

      setQuantities(imported);
      e.target.value = "";

setTimeout(() => {
  setExpandedGroups(prev => {
    const updated = { ...prev };
    Object.keys(imported).forEach(sku => {
      const item = data.find(i => {
        const sizes = expandSizes(i.Size, i.Style);
        const widths = expandWidths(i.Width);
        const colours = expandColours(i.Colours);
        return colours.some(colour =>
          widths.some(width =>
            sizes.some(size =>
              generateSKU(i, width, colour, size) === sku
            )
          )
        );
      });
      if (item?.Collection) {
        updated[item.Collection] = true;
      }
    });
    return updated;
  });
}, 0);

    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
      <img
        src="https://www.capezio.au/static/version1745830218/frontend/Aws/capezio/en_AU/images/logo.svg"
        alt="Logo"
        style={{ height: 30.645, marginRight: 10 }}
      />
      <h1 style={{ fontSize: 20 }}>Capezio Summer 2026 Order Form</h1>
    </div>
      <div style={{ marginBottom: 10 }}>
  <label><b>Choose Secion:</b> </label>
  <select
    value={sheetName}
    onChange={(e) => {
      const newSheet = e.target.value;
      setSheetName(newSheet);
      const params = new URLSearchParams(window.location.search);
      params.set("sheet", newSheet);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }}
    style={{ fontSize: 16, padding: 4 }}
  >
    {sheetOptions.map(name => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>
</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <input
          placeholder="Enter Customer ID"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ padding: 5, fontSize: 16 }}
        />
        <div>
          <input
  type="email"
  placeholder="Enter email to send"
  value={email}
  onChange={e => setEmail(e.target.value)}
  style={{ padding: 5, fontSize: 16, marginLeft: 10 }}
/>
<button onClick={sendEmail} style={{ padding: 8, fontWeight: "bold", marginLeft: 10 }}>
  Send to Email
</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: 8, fontWeight: "bold", marginRight: 10 }}
          >
            Import CSV
          </button>
          <button onClick={downloadCSV} style={{ padding: 8, fontWeight: "bold" }}>
            Download CSV
          </button>
        </div>
      </div>

      <p style={{ marginTop: 10 }}>Total Items: <b>{totalQty}</b> — Total Amount: <b>${totalAmount.toFixed(2)}</b></p>

      {Object.entries(grouped).map(([group, items], idx) => (
        <div key={group} style={{ marginBottom: 30 }}>
         <h2
  onClick={() => setExpandedGroups(g => ({ ...g, [group]: !g[group] }))}
  style={{ cursor: "pointer", background: "#eee", padding: 5 }}
>
  {idx + 1}. {group}
  {" "}
  {(() => {
    let qty = 0;
    let amount = 0;
    items.forEach((item: any) => {
      const sizes = expandSizes(item.Size, item.Style);
      const widths = expandWidths(item.Width);
      const colours = expandColours(item.Colours);
      colours.forEach(colour => {
        widths.forEach(width => {
          sizes.forEach(size => {
            const sku = generateSKU(item, width, colour, size);
            const count = quantities[sku] || 0;
            qty += count;
            amount += count * parseFloat(item.Wholesale || "0");
          });
        });
      });
    });
    return `(Ordered: ${qty}, $${amount.toFixed(2)})`;
  })()}
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
