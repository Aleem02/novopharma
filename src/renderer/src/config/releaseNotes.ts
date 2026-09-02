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
