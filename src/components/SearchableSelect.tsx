import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  id: string;
  name: string;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
};

export function SearchableSelect({
  id,
  name,
  options,
  placeholder,
  searchPlaceholder = "Search...",
  emptyMessage = "No matches found.",
  disabled = false,
  value: controlledValue,
  onValueChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState("");
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const value = controlledValue ?? internalValue;
  const selected = options.find((option) => option.value === value);

  const selectValue = useCallback(
    (nextValue: string) => {
      if (controlledValue === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [controlledValue, onValueChange],
  );

  useEffect(() => {
    const form = hiddenInputRef.current?.form;
    if (!form) return;
    const reset = () => {
      selectValue("");
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [selectValue]);

  return (
    <>
      <input ref={hiddenInputRef} type="hidden" id={id} name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-options`}
            disabled={disabled}
            className="mt-1 h-auto min-h-10 w-full justify-between gap-2 px-3 py-2 text-left font-normal"
          >
            <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList id={`${id}-options`} className="max-h-64">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.searchText ?? ""}`}
                    onSelect={() => {
                      selectValue(option.value);
                      setOpen(false);
                    }}
                    className="py-2.5"
                  >
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="min-w-0 whitespace-normal leading-snug">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
