import React from 'react'

export const TermsSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-slate-100">
          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Terms & Conditions</h2>
            <p className="text-xs text-slate-500">Last Updated: January 1, 2026 • NovoPharma V1</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">1. Software Licensing</h3>
            <p>
              NovoPharma is granted under a non-exclusive, non-transferable single-pharmacy license tied to the activated hardware device. Unauthorized distribution or reverse engineering is prohibited.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">2. Regulatory & Tax Compliance</h3>
            <p>
              The licensee is solely responsible for verifying medicine prices, batch expiry dates, prescription verification rules, and GST tax invoicing compliance according to applicable local laws.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">3. Limitation of Liability</h3>
            <p>
              NovoPharma is provided "as is". The developers shall not be liable for business interruptions, operational losses, or data loss caused by system hardware failure or unbacked database corruption.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-slate-800 mb-1 text-xs uppercase tracking-wider">4. Software Updates & Maintenance</h3>
            <p>
              Software updates, feature enhancements, and maintenance patches are provided periodically in accordance with your active subscription plan.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
