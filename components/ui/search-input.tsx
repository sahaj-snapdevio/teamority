"use client";

import * as React from "react";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  onClear?: () => void;
}

export function SearchInput({ className, value, onChange, onClear, ...props }: SearchInputProps) {
  const hasValue = Boolean(value);

  function handleClear() {
    if (onClear) {
      onClear();
    } else if (onChange) {
      const syntheticEvent = { target: { value: "" } } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
  }

  return (
    <div className="relative">
      <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 size-3.5 text-base-content/60 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={cn(
          "input h-8 w-full rounded-lg border border-base-300 pl-8 text-xs text-base-content placeholder:text-base-content/60 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all",
          hasValue ? "pr-7" : "pr-3",
          className,
        )}
        {...props}
      />
      {hasValue && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleClear(); }}
          className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 flex size-5 items-center justify-center rounded text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors"
          tabIndex={-1}
          aria-label="Clear search"
        >
          <XIcon className="size-3" weight="bold" />
        </button>
      )}
    </div>
  );
}
