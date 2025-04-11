import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoplantHoliday, useHolidayStore } from "@/store/holidayStore";
import { Trash2, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface HolidayModalProps {
  open: boolean;
  onClose: () => void;
}

export function HolidayModal({ open, onClose }: HolidayModalProps) {
  const {
    excludeSundays,
    excludeAllSaturdays,
    excludeEvenSaturdays,
    excludeAutoplantHolidays,
    excludeOptionalHolidays,
    autoplantHolidays,
    toggleSundays,
    toggleAllSaturdays,
    toggleEvenSaturdays,
    toggleAutoplantHolidays,
    toggleOptionalHolidays,
    addHoliday,
    updateHoliday,
    deleteHoliday,
  } = useHolidayStore();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "range">("single");
  
  // Single date selection
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Date range selection
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: undefined,
  });
  
  const [holidayName, setHolidayName] = useState("");
  const [isOptional, setIsOptional] = useState(false);

  const handleAddHoliday = () => {
    if (addMode === "single") {
      if (!selectedDate || !holidayName.trim()) return;
      
      const dateStr = selectedDate.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      const newHoliday: Omit<AutoplantHoliday, 'id'> = {
        date: dateStr,
        day: dayNames[selectedDate.getDay()],
        name: holidayName.trim(),
        optional: isOptional,
      };
      
      addHoliday(newHoliday as AutoplantHoliday);
    } else {
      // Range mode
      if (!dateRange.from || !dateRange.to || !holidayName.trim()) return;
      
      // Get all dates in the range
      const dates = eachDayOfInterval({
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Add each date as a separate holiday with the same name
      dates.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        const newHoliday: Omit<AutoplantHoliday, 'id'> = {
          date: dateStr,
          day: dayNames[date.getDay()],
          name: `${holidayName.trim()} (${format(date, "dd MMM")})`,
          optional: isOptional,
        };
        
        addHoliday(newHoliday as AutoplantHoliday);
      });
    }
    
    // Reset form
    setShowAddForm(false);
    setSelectedDate(new Date());
    setDateRange({ from: new Date(), to: undefined });
    setHolidayName("");
    setIsOptional(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Holiday Exclusion Settings</DialogTitle>
          <DialogDescription>
            Configure which days should be excluded from task duration calculations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-medium text-lg">Default Exclusions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sundays"
                  checked={excludeSundays}
                  onCheckedChange={toggleSundays}
                />
                <label htmlFor="sundays" className="text-sm font-medium">
                  All Sundays
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="saturdays"
                  checked={excludeAllSaturdays}
                  onCheckedChange={toggleAllSaturdays}
                />
                <label htmlFor="saturdays" className="text-sm font-medium">
                  All Saturdays
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="evenSaturdays"
                  checked={excludeEvenSaturdays}
                  onCheckedChange={toggleEvenSaturdays}
                  disabled={excludeAllSaturdays}
                />
                <label htmlFor="evenSaturdays" className="text-sm font-medium">
                  Even Saturdays
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoplantHolidays"
                  checked={excludeAutoplantHolidays}
                  onCheckedChange={toggleAutoplantHolidays}
                />
                <label htmlFor="autoplantHolidays" className="text-sm font-medium">
                  Autoplant Holidays
                </label>
              </div>
              <div className="flex items-center space-x-2 col-span-2">
                <Checkbox
                  id="optionalHolidays"
                  checked={excludeOptionalHolidays}
                  onCheckedChange={toggleOptionalHolidays}
                  disabled={!excludeAutoplantHolidays}
                />
                <label htmlFor="optionalHolidays" className="text-sm font-medium">
                  Include Optional Holidays in Exclusion
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-lg">Autoplant Holiday List</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Holiday
              </Button>
            </div>

            {showAddForm && (
              <div className="border rounded-md p-4 space-y-4">
                <RadioGroup 
                  defaultValue="single" 
                  className="flex space-x-4 mb-4" 
                  onValueChange={(value: string) => setAddMode(value as "single" | "range")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">Single Date</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="range" id="range" />
                    <Label htmlFor="range">Date Range</Label>
                  </div>
                </RadioGroup>
                
                <div className="flex gap-6">
                  <div className="w-fit">
                    <Label htmlFor="date" className="block mb-2">{addMode === "single" ? "Date" : "Date Range"}</Label>
                    <div className="border rounded-md p-2">
                      {addMode === "single" ? (
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          numberOfMonths={1}
                          className="rounded-md"
                        />
                      ) : (
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={(range: DateRange | undefined) => 
                            setDateRange(range || { from: new Date(), to: undefined })
                          }
                          numberOfMonths={1}
                          className="rounded-md"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="holidayName">Holiday Name</Label>
                      <Input
                        id="holidayName"
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        placeholder="Enter holiday name"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="optional"
                        checked={isOptional}
                        onCheckedChange={setIsOptional}
                      />
                      <Label htmlFor="optional">Optional Holiday</Label>
                    </div>
                    <div className="flex space-x-2 pt-4">
                      <Button onClick={handleAddHoliday}>
                        {addMode === "single" ? "Add Holiday" : "Add Date Range"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => setShowAddForm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoplantHolidays
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell className="font-medium">
                          {format(new Date(holiday.date), "dd-MMM-yyyy")}
                        </TableCell>
                        <TableCell>{holiday.day}</TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          {holiday.optional ? "Optional" : "Mandatory"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteHoliday(holiday.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="mt-4">
            Close and Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 