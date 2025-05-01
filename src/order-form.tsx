import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import saveAs from 'file-saver';

interface Product {
  style: string;
  name: string;
  size: string;
  width: string;
  colours: string;
  wholesale?: string;
  rrp?: string;
}

const SHEET_URL = "https://opensheet.elk.sh/1yRWT1Ta1S21tN1dmuKzWNbhdlLwj2Sdtobgy1Rj8IM0/Sheet1";

export default function OrderForm() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    fetch(SHEET_URL)
      .then((res) => res.json())
      .then((data: Product[]) => {
        const validRows = data.filter(row => row.style);
        setProducts(validRows);
      });
  }, []);

  const simplifyStyle = (style: string) => {
    return style.replace(/^S0*|^G0*|^A0*|^F0*|^EL0*|^BH0*|^B0*/, '').replace(/W|C|U|T$/, '');
  };

  const generateSizes = (size: string, isShoes: boolean, isChild: boolean) => {
    const sizeSet = new Set<string>();
    const parts = size.split(',');
    for (let part of parts) {
      part = part.trim();
      if (/\d+\s*-\s*\d+(\.\d+)?/.test(part)) {
        let [start, end] = part.split('-').map(s => parseFloat(s.trim()));
        let step = 0.5;
        for (let val = start; val <= end; val += step) {
          sizeSet.add((Math.round(val * 10) / 10).toString());
        }
      } else {
        sizeSet.add(part);
      }
    }
    return Array.from(sizeSet);
  };

  const formatSize = (raw: string, isShoe: boolean) => {
    if (raw.toUpperCase() === 'OS') return 'ONE';
    if (isShoe) {
      const num = parseFloat(raw);
      return num ? String(num * 10).padStart(3, '0') : raw;
    }
    return raw;
  };

  const generateSKU = (style: string, width: string, color: string, size: string): string => {
    const isShoe = style.startsWith("S");
    const isChild = style.endsWith("C");
    const paddedSize = formatSize(size, isShoe);
    if (isShoe && style.endsWith("W") || style.endsWith("C")) {
      return `${style}${color}${paddedSize}`;
    } else if (style.startsWith("S")) {
      return `${style}${width}${color}${paddedSize}`;
    } else {
      return `${style}${color}${paddedSize}`;
    }
  };

  const handleChange = (sku: string, value: string) => {
    const qty = parseInt(value);
    setQuantities({ ...quantities, [sku]: isNaN(qty) ? 0 : qty });
  };

  const handleDownload = () => {
    if (!customerId) return alert("Please enter Customer ID");
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => `${sku},${qty}`);
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    saveAs(blob, `${customerId}.csv`);
  };

  const renderProductCard = (product: Product) => {
    const isShoe = product.style.startsWith("S");
    const isChild = product.style.endsWith("C");
    const sizes = generateSizes(product.size, isShoe, isChild);
    const widths = product.width ? product.width.split(',').map(w => w.trim()) : [""];
    const colors = product.colours ? product.colours.split(',').map(c => c.trim()) : [];

    return (
      <div key={product.style + product.colours} className="border rounded-xl p-4 mb-4">
        <h2 className="font-bold text-lg mb-1">
          {simplifyStyle(product.style)} - {product.name} (${product.wholesale} / ${product.rrp})
        </h2>
        {colors.map((color) => (
          <div key={color} className="mb-2">
            <div className="font-semibold">Color: {color}</div>
            {widths.map((width) => (
              <div key={width} className="pl-2">
                <div className="font-medium">Width: {width || "-"}</div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((size) => {
                    const sku = generateSKU(product.style, width, color, size);
                    return (
                      <div key={sku} className="flex flex-col items-center w-20">
                        <div className="text-sm">{size}</div>
                        <Input
                          value={quantities[sku] || ""}
                          onChange={(e) => handleChange(sku, e.target.value)}
                          className="w-16"
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
    );
  };

  const renderProducts = () => {
    let collectionIndex = 1;
    let currentCollection = '';
    let productsInCollection: Product[] = [];
    const result: JSX.Element[] = [];

    const pushCollection = () => {
      if (productsInCollection.length > 0) {
        result.push(
          <Collapsible key={currentCollection} defaultOpen={false}>
            <CollapsibleTrigger className="w-full text-left font-bold text-xl py-2 border-b">
              {collectionIndex}. {currentCollection}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-2">
              {productsInCollection.map(renderProductCard)}
            </CollapsibleContent>
          </Collapsible>
        );
        collectionIndex++;
        productsInCollection = [];
      }
    };

    for (const product of products) {
      if (product.name === "" && product.style && product.style.trim() !== "") {
        pushCollection();
        currentCollection = product.style.trim();
      } else if (product.style && product.name) {
        productsInCollection.push(product);
      }
    }
    pushCollection();
    return result;
  };

  return (
    <div className="p-4 max-w-screen-xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <Input
          placeholder="Enter Customer ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-64"
        />
        <Button onClick={handleDownload}>Download CSV</Button>
      </div>
      {renderProducts()}
    </div>
  );
}
