export interface ReleaseNoteSection {
  category: 'New Features' | 'Improvements' | 'Bug Fixes'
  items: string[]
}

export interface ReleaseNote {
  version: string
  date: string
  title: string
  highlights: string[]
  sections: ReleaseNoteSection[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.4.0',
    date: 'September 12, 2026',
    title: 'Global Date Selection Standard, Pharmacy Expiry MM/YYYY UX & Reports Center',
    highlights: [
      'Reusable NovoPharma DatePicker standard with DD-MM-YYYY format and 8-digit fast keyboard entry.',
      'Specialized Month/Year (MM/YYYY) picker for medicine batch expiry with 6-digit fast typing and month-grid selector.',
      'Canonical end-of-month expiry validity (MM/YYYY valid through last day of month) with backward-compatible timestamp preservation.',
      'High-risk Expired Batches alert section on Dashboard and accurate usable stock calculation.',
      'UI popover stacking fixes allowing date pickers and dropdowns to float smoothly outside card boundaries.'
    ],
    sections: [
      {
        category: 'New Features',
        items: [
          'Global DatePicker Standard (DD-MM-YYYY): Reused across Purchase Form, Reports Custom Date Ranges, Sales History Filters, and Customer DOB with fast 8-digit keyboard input (12092026 -> 12-09-2026), calendar popover, and Today shortcut.',
          'Pharmacy Expiry Month/Year UX (MM/YYYY): Replaced day-based expiry selection with dedicated MonthYearPicker for batch entry in Purchases and Inventory Batch editing.',
          '6-Digit Expiry Keyboard Workflow: Fast typing support (112027 -> 11/2027) with seamless Tab key navigation to Qty and Price fields.',
          '3x4 Month Selector Popover: Dedicated month grid with year navigation stepper (Jan-Dec grid) eliminating day selection for medicine expiry.'
        ]
      },
      {
        category: 'Improvements',
        items: [
          'Canonical Month-End Expiry Boundary: Newly entered MM/YYYY expiry dates normalize to the last millisecond of the month (e.g. 11/2027 -> Nov 30, 2027 23:59:59.999), remaining valid through the end of the month.',
          'Backward-Compatible Batch Editing: Editing unrelated fields (e.g. MRP or Selling Price) preserves exact existing batch expiry timestamps without silent modification.',
          'Dashboard High-Risk Expired Batches Alert: Immediate visibility for expired inventory in Attention Required section.',
          'Usable Stock Calculation: Low Stock calculations explicitly filter out expired inventory to prevent artificial stock inflation.',
          'Reports & Analytics Redesign: Polished visual center with category metrics, KPI summaries, and document preview modals.'
        ]
      },
      {
        category: 'Bug Fixes',
        items: [
          'Card Popover Clipping: Removed overflow-hidden constraints from Card components so date pickers and dropdown menus float cleanly over card borders.',
          'Popover Stacking Order: Applied dynamic z-40 stacking order to active date and month/year pickers so popovers render on top of adjacent form controls.'
        ]
      }
    ]
  },
  {
    version: '1.3.0',
    date: 'September 2, 2026',
    title: 'FEFO Prescription Auto-Batch & Universal Search State Persistence',
    highlights: [
      'Prescription medicines now automatically resolve nearest-expiry inventory batches (FEFO rule).',
      'Universal search query and pagination persistence across all main list modules.',
      'Held sale protection engine so intermediate sales never delete held carts.',
      'Application build version and legal policies in Settings.'
    ],
    sections: [
      {
        category: 'New Features',
        items: [
          'Prescription Auto-Batch Selection: Prescribed items automatically pick active batches ordered by FEFO (First Expired, First Out) with populated MRP and selling rates.',
          'Settings Legal Pages: Dedicated Privacy Policy and Terms & Conditions views available in Pharmacy Settings.',
          'Software Build Version Display: Live application version tag and build environment badge in Settings.'
        ]
      },
      {
        category: 'Improvements',
        items: [
          'Universal Search State Retention: Navigation across Stock, Medicine Master, Customers, Suppliers, Purchases, and Sales History preserves search queries and page numbers upon returning.',
          'Back Navigation Integration: Back-to-List actions now use native router history, restoring active search queries.',
          'POS Customer Search: Dropdown menu opens on-demand only when focusing or clicking the search bar.'
        ]
      },
      {
        category: 'Bug Fixes',
        items: [
          'Held Sale Recovery: Completing a separate sale while a held sale is in memory no longer deletes the held cart.',
          'Held Cart Sync: Modifying or deleting items from a restored held cart updates storage immediately so deleted items do not reappear.',
          'POS Terminal Focus: Eliminated synthetic blur handles that caused unresponsiveness after stock transactions.'
        ]
      }
    ]
  },
  {
    version: '1.2.2',
    date: 'August 31, 2026',
    title: 'POS Billing Enhancements & Database Backup Upgrades',
    highlights: [
      'Enhanced thermal & A4 invoice printing templates.',
      'Automated SQLite database backup management.',
      'Medicine master active/inactive status management.'
    ],
    sections: [
      {
        category: 'New Features',
        items: [
          'Dual Receipt Printing: Thermal 80mm and A4 invoice layouts configurable in Settings.',
          'Manual & Auto Backups: Export and restore SQLite database snapshots.'
        ]
      },
      {
        category: 'Improvements',
        items: [
          'Medicine Master Status: Activate or deactivate catalog medicines safely without losing transaction history.'
        ]
      }
    ]
  }
]
