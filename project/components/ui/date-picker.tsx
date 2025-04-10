'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DatePickerProps {
  date?: Date | null;
  onSelect: (date: Date | null) => void;
  className?: string;
}

export function DatePicker({ date, onSelect, className }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[130px] justify-start text-left font-normal text-xs',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3 w-3" />
          {date ? format(date, 'dd/MM/yyyy') : <span>Pick date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date || undefined}
          onSelect={onSelect}
          initialFocus
          required
          className="rounded-md border shadow-sm"
        />
      </PopoverContent>
    </Popover>
  );
}