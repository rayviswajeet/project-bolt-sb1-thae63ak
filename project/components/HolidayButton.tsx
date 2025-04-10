'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { HolidayModal } from '@/components/HolidayModal';

export default function HolidayButton() {
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => setHolidayModalOpen(true)}
      >
        <Calendar className="h-4 w-4" />
        Holiday Exclusion List
      </Button>
      
      <HolidayModal open={holidayModalOpen} onClose={() => setHolidayModalOpen(false)} />
    </>
  );
} 