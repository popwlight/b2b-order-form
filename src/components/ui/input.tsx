// src/components/ui/input.tsx
import React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={`border rounded px-2 py-1 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
