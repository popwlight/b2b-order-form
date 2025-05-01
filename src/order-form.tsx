import React, { useEffect, useState } from "react";

type ProductRow = {
  Style: string;
  Desc: string;
  Size: string;
  Width?: string;
  Colours: string;
  Wholesale: string;
  RRP: string;
};

const parseSizes = (sizeStr: string): string[] => {
  if (!sizeStr) return [];
  return sizeStr.split(",").map((s) => s.trim());
};

const parseWidths = (widthStr: string): string[] =>
  widthStr ? widthStr.split(",").map((w) => w.trim()) : [""];

const parseColours = (colourStr: string): string[] =>
  colourStr ? colourStr.split(",").map((c) => c.trim()) : [];

const convertSizeToSkuFormat = (style: string, size: string): string => {
  if (size === "OS" || size === "ONE") return "ONE";
  const isShoe = style.startsWith("S");
  const sizeNum = parseFloat(size);
  if (isShoe && !isNaN(sizeNum)) {
    return (Math.round(sizeNum * 10)).toString().padStart(3, "0");
  }
  return size.padStart(3, "0");
};

const generateSKU = (
  style: string,
  width: string,
  color: string,
  size: string
) => {
  const sizePart = convertSizeToSkuFormat(style, size);
  if (style.startsWith("S")) {
    return `${style}${width || "--"}${color}${sizePart}`;
  } else {
    return `${style}${color}${sizePart}`;
  }
};

export default function B2BOrderForm() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    fetch(
      "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1"
    )
      .then((res) => res.json())
      .then((rows: ProductRow[]) => {
        const cleaned = rows.filter(
          (row) =>
            row.Style &&
            row.Desc &&
            row.Size &&
            row.Colours &&
            row.Wholesale &&
            row.RRP
        );
        setProducts(cleaned);
      });
  }, []);

  const handleChange = (sku: string, value: string) => {
    setQuantities({
      ...quantities,
      [sku]: parseInt(value) || 0,
    });
  };

  const handleDownload = () => {
    if (!customerId) {
      alert("Please enter Customer ID.");
      return;
    }

    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${customerId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPrice = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const product = products.find((p) => {
      const colors = parseColours(p.Colours);
      const widths = parseWidths(p.Width || "");
      const sizes = parseSizes(p.Size);
      return colors.some((c) =>
        widths.some((w) =>
          sizes.some((s) => generateSKU(p.Style, w, c, s) === sku)
        )
      );
    });
    const price = product ? parseFloat(product.Wholesale) || 0 : 0;
    return sum + qty * price;
  }, 0);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>B2B Order Form</h1>
      <div style={{ marginBottom: "1rem" }}>
        Customer ID:{" "}
        <input
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
      </div>
      {products.map((product) => (
        <div
          key={`${product.Style}-${product.Desc}`}
          style={{
            border: "1px solid #ccc",
            padding: "1rem",
            marginBottom: "2rem",
            borderRadius: "0.5rem",
            background: "#fafafa",
          }}
        >
          <h2>
            <strong>
              {product.Style} - {product.Desc} (${product.RRP})
            </strong>
          </h2>
          {parseColours(product.Colours).map((color) => (
            <div key={color} style={{ marginBottom: "1rem" }}>
              <div>
                <strong>Color: {color}</strong>
              </div>
              {parseWidths(product.Width || "").map((width) => (
                <div key={width || "-"} style={{ marginLeft: "1rem" }}>
                  <div>
                    Width: <strong>{width || "-"}</strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {parseSizes(product.Size).map((size) => {
                      const sku = generateSKU(
                        product.Style,
                        width,
                        color,
                        size
                      );
                      return (
                        <div key={sku} style={{ textAlign: "center" }}>
                          <div>{size}</div>
                          <input
                            type="number"
                            value={quantities[sku] || ""}
                            onChange={(e) =>
                              handleChange(sku, e.target.value)
                            }
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
      <div style={{ marginTop: "2rem", fontSize: "1.2rem" }}>
        <strong>Total: ${totalPrice.toFixed(2)}</strong>
      </div>
      <button
        onClick={handleDownload}
        style={{
          marginTop: "1rem",
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Download CSV
      </button>
    </div>
  );
}
