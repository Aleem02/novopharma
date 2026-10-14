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
    version: '1.6.2',
    date: 'October 14, 2026',
    title: 'Inventory Batch Search Combobox & Settings Update Checker',
    highlights: [
      'Searchable inventory batch combobox in Stock Adjustments replacing the 25-item static dropdown limit.',
      'Real-time batch search by medicine name, generic name, batch number, and barcode.',
      'Safe manual "Check for Updates" button in Settings with live progress and zero database interruption.',
      'Direct batch loading when navigating from Inventory Dashboard or Batch Details.'
    ],
    sections: [
      {
        category: 'New Features',
        items: [
          'Settings Manual Update Check: Trigger on-demand version checks with live feedback banners (Checking, Up-to-date, Download progress, and Error notices).',
          'Inventory Batch Search Combobox: Replaced the static HTML select with a live, debounced search combobox featuring rich card layout, batch pills, and dosage details.'
        ]
      },
      {
        category: 'Bug Fixes',
        items: [
          'Batch Truncation Fix: Removed the default 25-item pagination cap on stock adjustments, allowing pharmacists to search and adjust any batch across the entire database.',
          'Deep-Link Adjustment Fix: Selecting "Adjust Stock" on any batch in Inventory Dashboard or Batch Details now directly retrieves that specific batch via direct ID lookup.',
          'Strength Null Formatting: Resolved an issue where products without a dosage strength displayed the literal string "null".'
        ]
      },
      {
        category: 'Improvements',
        items: [
          'Enriched Inventory Repository queries to automatically left-join complete product packaging metadata (unit, pack type, units per pack, strength).'
        ]
      }
    ]
  },
  {
    version: '1.6.1',
    date: 'September 29, 2026',
    title: 'Startup Reliability & Network Resilience Hotfix',
    highlights: [
      '8-second finite timeout for desktop API network requests.',
      'Prevented activation status synchronization from stalling application launch on slow/unreachable networks.',
      'Preserved local activation state and offline launch capabilities.',
      'Updated production backend domain fallback.'
    ],
    sections: [
      {
        category: 'Bug Fixes',
        items: [
          'Startup Deadlock Fix: Added 8-second AbortController timeout to API requests to prevent infinite loading on splash screen.',
          'Non-Blocking Activation Sync: Network activation status checks now log warnings on failure/timeout without blocking app startup.',
          'Offline Mode Continuity: Existing authenticated and activated installations launch smoothly into POS even when backend is temporarily unreachable.'
        ]
      }
    ]
  },
  {
    version: '1.6.0',
    date: 'September 29, 2026',
    title: 'Automated Cloud Backup, Diagnostic Engine & Schema Refactoring',
    highlights: [
      'Automated background cloud database backup to Firebase Storage.',
      'Built-in System Diagnostics engine for local DB, network, and storage rules.',
      'Schema Migration 0017 removing legacy SQLite medicine directory table for faster startup and smaller database size.',
      'Tenant-isolated Firebase Storage security rules.'
    ],
    sections: [
      {
        category: 'New Features',
        items: [
          'Automated Cloud Backup: Background synchronization of pharmacy database snapshots to Firebase Cloud Storage.',
          'On-Demand Cloud Sync: Trigger manual cloud backups directly from Settings with real-time status and download options.',
          'Diagnostic Test Engine: Diagnostic suite verifying local database integrity, cloud connectivity, storage permissions, and migration status.'
        ]
      },
      {
        category: 'Improvements',
        items: [
          'Schema Optimization (Migration 0017): Removed legacy global medicine directory SQLite table, switching to fast in-memory dataset.',
          'Tenant Isolation Rules: Enforced strict per-tenant cloud storage path scoping (tenants/{tenantId}/backups/{fileName}).',
          'IPC Handler Safeguards: Main process handlers enhanced with error boundaries and automatic resource cleanup.'
        ]
      }
    ]
  },
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
