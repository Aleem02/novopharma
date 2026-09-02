import React, { useState } from 'react'
import { RELEASE_NOTES, ReleaseNote } from '../../config/releaseNotes'
import { Sparkles, CheckCircle2, X, ChevronRight, Tag } from 'lucide-react'

interface ReleaseNotesModalProps {
  isOpen: boolean
  onClose: () => void
  initialVersion?: string
}

export const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({
  isOpen,
  onClose,
  initialVersion = '1.3.0'
}) => {
  const [selectedVersion, setSelectedVersion] = useState<string>(initialVersion)

  if (!isOpen) return null

  const activeNote: ReleaseNote =
    RELEASE_NOTES.find(note => note.version === selectedVersion) || RELEASE_NOTES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all transform scale-100">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-slate-800 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2 text-teal-200 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4 text-teal-300" />
            <span>What's New in NovoPharma</span>
          </div>

          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Version {activeNote.version}</h2>
            <span className="text-xs text-teal-100 font-medium">{activeNote.date}</span>
          </div>
          <p className="text-sm text-teal-50 mt-1 font-medium">{activeNote.title}</p>

          {/* Version Selector Tabs */}
          <div className="flex space-x-2 mt-4 pt-3 border-t border-white/15">
            {RELEASE_NOTES.map(note => (
              <button
                key={note.version}
                onClick={() => setSelectedVersion(note.version)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center space-x-1 ${
                  selectedVersion === note.version
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'bg-white/10 text-teal-100 hover:bg-white/20'
                }`}
              >
                <Tag className="w-3 h-3" />
                <span>v{note.version}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* Highlights Box */}
          <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 mb-3 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Release Highlights</span>
            </h3>
            <ul className="space-y-2 text-sm text-slate-700">
              {activeNote.highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Detailed Sections */}
          {activeNote.sections.map((sec, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                    sec.category === 'New Features'
                      ? 'bg-teal-100 text-teal-800'
                      : sec.category === 'Improvements'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {sec.category}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 pl-1">
                {sec.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start space-x-2">
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  )
}
