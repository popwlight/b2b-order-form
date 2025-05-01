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

const fetchSheetData = async (): Promise<Product[]> => {
  const url =
    "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";
  const res = await axios.get(url);
  return res.data.filter(
    (row: any) => row.Style || row.Desc || row.Size || row.Width || row.Colours
  );
};

const parseSizes = (sizeStr: string): string[] => {
  if (!sizeStr) return [];
  if (sizeStr.includes(",")) return sizeStr.split(",").map((s) => s.trim());
  if (sizeStr.includes("-")) {
    const [start, end] = sizeStr.split("-").map((s) => s.trim());
    const toFloat = (s: string) => parseFloat(s);
    const result: string[] = [];
    let curr = toFloat(start);
    const stop = toFloat(end);
    while (curr <= stop) {
      result.push(curr % 1 === 0 ? curr.toFixed(0) : curr.toFixed(1));
      curr += 0.5;
    }
    return result;
  }
  return [sizeStr];
};

const parseWidths = (widthStr: string): string[] => {
  return widthStr ? widthStr.split(",").map((w) => w.trim()) : [""];
};

const parseColours = (colourStr: string): string[] => {
  return colourStr ? colourStr.split(",").map((c) => c.trim()) : [];
};

const OrderForm = () => {
  const [customerId, setCustomerId] = useState<string>("");
  const [confirmedId, setConfirmedId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [groupedProducts, setGroupedProducts] = useState<Record<string, Product[]>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchSheetData().then((data) => {
      const groups: Record<string, Product[]> = {};
      let currentGroup = "";
      for (const item of data) {
        if (!item.Style && item.Collection) {
          currentGroup = item.Collection.trim();
          groups[currentGroup] = [];
        } else if (item.Style) {
          if (!groups[currentGroup]) groups[currentGroup] = [];
          groups[currentGroup].push(item);
        }
      }
      setProducts(data);
      setGroupedProducts(groups);
    });
  }, []);

  const handleQuantityChange = (sku: string, qty: number) => {
    setQuantities((prev) => ({ ...prev, [sku]: qty }));
  };

  const handleDownload = () => {
    const rows = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob(["SKU,Qty\n" + rows.join("\n")], {
      type: "text/csv",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${confirmedId}.csv`;
    link.click();
  };

  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [sku, qty]) => {
    const match = sku.match(/^(.+?)-(.+?)-(.+?)-(.+)$/);
    if (match) {
      const [_, style, width, color, size] = match;
      const product = products.find((p) => p.Style === style);
      if (product) return sum + parseFloat(product.Wholesale || "0") * qty;
    }
    return sum;
  }, 0);

  if (!confirmedId) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-2">Enter Customer ID:</h2>
        <input
          type="text"
          className="border p-2 mr-2"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setConfirmedId(customerId);
          }}
        />
        <button
          onClick={() => setConfirmedId(customerId)}
          className="bg-blue-500 text-white px-4 py-2"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <strong>Total Qty:</strong> {totalQty} &nbsp;
          <strong>Total $:</strong> {totalAmount.toFixed(2)}
        </div>
        <button
          onClick={handleDownload}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Download CSV
        </button>
      </div>

      {Object.entries(groupedProducts).map(([collection, items], index) => (
        <div key={collection} className="mb-6">
          <h2 className="text-lg font-bold mb-2">
            {index + 1}. {collection}
          </h2>
          {items.map((product) => (
            <div key={product.Style} className="mb-4">
              <div className="font-semibold">
                {product.Style.replace(/^S0*|^A0*|^G0*/, "")}: {product.Desc} 
                {product.RRP && product.Wholesale
                  ? `($${product.RRP} / $${product.Wholesale})`
                  : ""}
              </div>
              {parseColours(product.Colours).length > 0 && (
                <div className="space-y-2">
                  {parseColours(product.Colours).map((color) => (
                    <div key={color}>
                      <div className="font-medium">Colour: {color}</div>
                      {parseWidths(product.Width).map((width) => (
                        <table
                          key={width}
                          className="border mt-1 text-sm table-auto border-collapse"
                        >
                          <thead>
                            <tr>
                              {parseSizes(product.Size).map((size) => (
                                <th
                                  key={size}
                                  className="border px-2 py-1 bg-gray-100"
                                >
                                  {size}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {parseSizes(product.Size).map((size) => {
                                const sku = `${product.Style}-${width}-${color}-${size}`;
                                return (
                                  <td key={sku} className="border px-1 py-1">
                                    <input
                                      type="number"
                                      value={quantities[sku] || ""}
                                      min={0}
                                      max={100}
                                      onChange={(e) =>
                                        handleQuantityChange(
                                          sku,
                                          parseInt(e.target.value || "0")
                                        )
                                      }
                                      className="w-14 border px-1 py-0.5 text-sm"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default OrderForm;
