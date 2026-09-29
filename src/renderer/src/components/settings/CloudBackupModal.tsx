import React, { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { CloudBackupItem } from '../../../../shared/types'

interface CloudBackupModalProps {
  isOpen: boolean
  onClose: () => void
  onRestoreTriggered?: () => void
}

export const CloudBackupModal: React.FC<CloudBackupModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<CloudBackupItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)
  const [downloadStatus, setDownloadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchCloudBackups()
    }
  }, [isOpen])

  const fetchCloudBackups = async () => {
    setLoading(true)
    setError(null)
    setDownloadStatus(null)
    try {
      const list = await window.api.cloudBackup.list()
      setItems(list || [])
    } catch (err: any) {
      setError(mapCloudError(err.message || 'Failed to list cloud backups'))
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (item: CloudBackupItem) => {
    setDownloadingFile(item.name)
    setDownloadStatus(null)
    try {
      const res = await window.api.cloudBackup.download(item.name)
      if (res && res.success) {
        setDownloadStatus({
          type: 'success',
          message: `Backup '${item.name}' downloaded and verified successfully (${res.filePath}).`
        })
      } else {
        setDownloadStatus({
          type: 'error',
          message: 'Failed to verify downloaded cloud backup file.'
        })
      }
    } catch (err: any) {
      setDownloadStatus({
        type: 'error',
        message: mapCloudError(err.message || 'Download failed')
      })
    } finally {
      setDownloadingFile(null)
    }
  }

  const mapCloudError = (msg: string): string => {
    if (msg.includes('UNAUTHENTICATED') || msg.includes('sign in')) {
      return 'Cloud backup needs you to sign in again.'
    }
    if (msg.includes('MISSING_TENANT_ID') || msg.includes('tenant')) {
      return 'Cloud backup is not configured for this account.'
    }
    if (msg.includes('NETWORK_UNAVAILABLE') || msg.includes('network') || msg.includes('Storage')) {
      return 'Cloud backup is temporarily unavailable. Your local backup is safe.'
    }
    if (msg.includes('CHECKSUM_MISMATCH')) {
      return 'Downloaded file checksum mismatch. Your local backup is safe.'
    }
    if (msg.includes('INTEGRITY_FAILED')) {
      return 'Downloaded backup failed SQLite validation. Your local backup is safe.'
    }
    return msg || 'Cloud backup operation could not be completed.'
  }

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (isoStr: string): string => {
    if (!isoStr) return 'Unknown Date'
    try {
      return new Date(isoStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return isoStr
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">NovoPharma Cloud Backups</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified backups stored securely in NovoPharma Cloud. Backups are retained for 7 days.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-sm focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Status Alerts */}
        {downloadStatus && (
          <div
            className={`p-3 rounded-lg border text-sm flex items-start gap-2 ${
              downloadStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <svg
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                downloadStatus.type === 'success' ? 'text-emerald-600' : 'text-amber-600'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {downloadStatus.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              )}
            </svg>
            <div className="flex-1 text-xs">{downloadStatus.message}</div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs">
            {error}
          </div>
        )}

        {/* Table / Content */}
        {loading ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <svg className="animate-spin h-6 w-6 text-teal-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs">Checking cloud backups...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-slate-500 border border-dashed border-slate-200 rounded-lg">
            <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 15a4 4 0 004 4h9a5 5 0 001-9.999 5.002 5.002 0 00-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p className="text-sm font-medium text-slate-700">No Cloud Backups Found</p>
            <p className="text-xs text-slate-500 mt-1">When cloud backup is enabled, your verified backups will appear here.</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider text-[11px] font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">File Size</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item) => (
                  <tr key={item.fullPath || item.name} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatBytes(item.size)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="success">✓ Verified</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={downloadingFile === item.name}
                        onClick={() => handleDownload(item)}
                        className="text-xs border-slate-300 text-slate-700"
                      >
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div>
            Older cloud backups are removed automatically. Your pharmacy data is not deleted.
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
