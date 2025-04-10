import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AutoplantHoliday = {
  id: number;
  date: string; // ISO date string
  day: string;
  name: string;
  optional?: boolean;
};

export interface HolidayState {
  excludeSundays: boolean;
  excludeAllSaturdays: boolean;
  excludeEvenSaturdays: boolean;
  excludeAutoplantHolidays: boolean;
  excludeOptionalHolidays: boolean;
  autoplantHolidays: AutoplantHoliday[];
  
  // Actions
  toggleSundays: () => void;
  toggleAllSaturdays: () => void;
  toggleEvenSaturdays: () => void;
  toggleAutoplantHolidays: () => void;
  toggleOptionalHolidays: () => void;
  addHoliday: (holiday: AutoplantHoliday) => void;
  updateHoliday: (holiday: AutoplantHoliday) => void;
  deleteHoliday: (id: number) => void;
  setHolidays: (holidays: AutoplantHoliday[]) => void;
}

export const useHolidayStore = create<HolidayState>()(
  persist(
    (set) => ({
      excludeSundays: true,
      excludeAllSaturdays: false,
      excludeEvenSaturdays: false,
      excludeAutoplantHolidays: true,
      excludeOptionalHolidays: true,
      autoplantHolidays: [
        { id: 1, date: '2025-01-01', day: 'Wed', name: 'New Year' },
        { id: 2, date: '2025-02-26', day: 'Wed', name: 'Maha Shivaratri' },
        { id: 3, date: '2025-03-14', day: 'Fri', name: 'Holi' },
        { id: 4, date: '2025-04-18', day: 'Fri', name: 'Good Friday' },
        { id: 5, date: '2025-05-01', day: 'Thu', name: 'Maharashtra Day' },
        { id: 6, date: '2025-08-15', day: 'Fri', name: 'Independence Day' },
        { id: 7, date: '2025-08-27', day: 'Wed', name: 'Ganesh Chaturthi' },
        { id: 8, date: '2025-10-02', day: 'Thu', name: 'Vijaya Dashami/Gandhi Jayanti' },
        { id: 9, date: '2025-10-21', day: 'Tue', name: 'Diwali' },
        { id: 10, date: '2025-10-22', day: 'Wed', name: 'Deepavali Holiday' },
        { id: 11, date: '2025-12-25', day: 'Thu', name: 'Christmas Day' },
        { id: 12, date: '2025-03-31', day: 'Mon', name: 'Idul Fitr', optional: true },
        { id: 13, date: '2025-11-05', day: 'Wed', name: 'Guru Nank Jayanti' },
      ],
      
      toggleSundays: () => set(state => ({ excludeSundays: !state.excludeSundays })),
      toggleAllSaturdays: () => set(state => ({ 
        excludeAllSaturdays: !state.excludeAllSaturdays,
        // Disable even saturdays if all saturdays is enabled
        excludeEvenSaturdays: !state.excludeAllSaturdays ? false : state.excludeEvenSaturdays 
      })),
      toggleEvenSaturdays: () => set(state => ({ 
        excludeEvenSaturdays: !state.excludeEvenSaturdays,
        // Disable all saturdays if even saturdays is enabled
        excludeAllSaturdays: !state.excludeEvenSaturdays ? false : state.excludeAllSaturdays
      })),
      toggleAutoplantHolidays: () => set(state => ({ 
        excludeAutoplantHolidays: !state.excludeAutoplantHolidays,
        // Disable optional holidays toggle if autoplant holidays are not excluded
        excludeOptionalHolidays: !state.excludeAutoplantHolidays ? false : state.excludeOptionalHolidays
      })),
      toggleOptionalHolidays: () => set(state => ({ excludeOptionalHolidays: !state.excludeOptionalHolidays })),
      
      addHoliday: (holiday) => set(state => {
        const maxId = Math.max(0, ...state.autoplantHolidays.map(h => h.id));
        return { 
          autoplantHolidays: [...state.autoplantHolidays, { ...holiday, id: maxId + 1 }]
        };
      }),
      
      updateHoliday: (holiday) => set(state => ({
        autoplantHolidays: state.autoplantHolidays.map(h => 
          h.id === holiday.id ? holiday : h
        )
      })),
      
      deleteHoliday: (id) => set(state => ({
        autoplantHolidays: state.autoplantHolidays.filter(h => h.id !== id)
      })),
      
      setHolidays: (holidays) => set({ autoplantHolidays: holidays }),
    }),
    {
      name: 'holiday-storage',
    }
  )
);

// Helper function to check if a date is a holiday
export function isHoliday(date: Date): boolean {
  const { 
    excludeSundays, 
    excludeAllSaturdays, 
    excludeEvenSaturdays, 
    excludeAutoplantHolidays,
    excludeOptionalHolidays,
    autoplantHolidays 
  } = useHolidayStore.getState();
  
  // Format the date as ISO string (YYYY-MM-DD) for comparison
  const dateStr = date.toISOString().split('T')[0];
  
  // Check if it's Sunday (day 0)
  if (excludeSundays && date.getDay() === 0) {
    return true;
  }
  
  // Check if it's Saturday (day 6)
  if (excludeAllSaturdays && date.getDay() === 6) {
    return true;
  }
  
  // Check if it's Even Saturday - get the date (1-31) and check if it's even
  if (excludeEvenSaturdays && date.getDay() === 6 && date.getDate() % 2 === 0) {
    return true;
  }
  
  // Check if it's an Autoplant holiday
  if (excludeAutoplantHolidays) {
    const holiday = autoplantHolidays.find(h => h.date === dateStr);
    if (holiday) {
      // If it's an optional holiday, only exclude if optionals are included in exclusion
      if (holiday.optional) {
        return excludeOptionalHolidays;
      }
      return true; // Mandatory holiday
    }
  }
  
  return false;
} 