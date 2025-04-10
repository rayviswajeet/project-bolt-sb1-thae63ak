"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ResizableTable({ children, className }: ResizableTableProps) {
  return (
    <table className={cn("w-full border-collapse table-fixed", className)}>
      {children}
    </table>
  );
}

interface ResizableHeaderProps {
  children: React.ReactNode;
  className?: string;
  width?: string;
  minWidth?: string;
}

export function ResizableHeader({ 
  children, 
  className,
  width = "auto",
  minWidth = "50px"
}: ResizableHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const headerRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current) return;
    
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = headerRef.current.offsetWidth;
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !headerRef.current) return;
    
    const width = startWidthRef.current + (e.clientX - startXRef.current);
    headerRef.current.style.width = `${width}px`;
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <th 
      ref={headerRef}
      className={cn(
        "relative px-4 py-2 text-left text-xs font-medium text-gray-500 border border-gray-200 bg-gray-50",
        isResizing && "select-none",
        className
      )}
      style={{ 
        width, 
        minWidth,
        userSelect: isResizing ? "none" : "auto"
      }}
    >
      <div className="flex items-center justify-between">
        <div>{children}</div>
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-1 cursor-col-resize",
            isResizing ? "bg-blue-500" : "hover:bg-blue-300"
          )}
          onMouseDown={handleMouseDown}
        />
      </div>
    </th>
  );
}

interface ResizableCellProps {
  children: React.ReactNode;
  className?: string;
}

export function ResizableCell({ children, className }: ResizableCellProps) {
  return (
    <td className={cn("px-4 py-2 border border-gray-200 text-sm", className)}>
      {children}
    </td>
  );
}