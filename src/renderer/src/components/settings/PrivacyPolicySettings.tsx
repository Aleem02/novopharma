import React from 'react'

export const PrivacyPolicySettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Privacy Policy</h2>
            <p className="text-xs text-slate-500">Effective Date: January 1, 2026 • NovoPharma V1</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">1. Local Storage & Data Control</h3>
            <p>
              NovoPharma operates as a local desktop software. All pharmacy catalogs, inventory batches, sales records, customer details, and financial transactions are stored locally on your computer in a secure SQLite database.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">2. Network Usage & Services</h3>
            <p>
              Internet connectivity is used solely for hardware-locked license activation, automated application updates, and optional user-configured cloud backup destinations.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">3. Data Sharing & Third Parties</h3>
            <p>
              We do not track, collect, monetize, or share your transaction data, customer medical records, or prescription details with third parties. Your business data belongs strictly to your pharmacy.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">4. Data Security & Backups</h3>
            <p>
              You maintain complete ownership and control over your local backup files. You can configure backup locations or export database archives at any time via Settings.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
