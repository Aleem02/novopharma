import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { CloudBackupModal } from './CloudBackupModal'

interface DatabaseSettingsProps {
  settings: Record<string, string>
  handleChange: (key: string, value: string) => void
  setError: (msg: string) => void
  setSuccess: (msg: string) => void
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({
  settings,
  handleChange,
  setError,
  setSuccess
}) => {
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isCloudUploading, setIsCloudUploading] = useState(false)
  const [cloudUploadStep, setCloudUploadStep] = useState('')
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false)

  const isCloudEnabled = settings.backup_cloud_enabled === 'true'
  const lastCloudError = settings.backup_last_cloud_error

  const handleSelectLocation = async () => {
    try {
      const location = await window.api.database.selectBackupLocation()
      if (location) {
        handleChange('backup_location', location)
        await window.api.settings.update({ ...settings, backup_location: location })
        setSuccess('Backup location updated successfully.')
      }
    } catch (e: any) {
      setError(e.message || 'Failed to select location')
    }
  }

  const handleManualBackup = async () => {
    if (!settings.backup_location) {
      setError('Please configure a backup location first.')
      return
    }

    setIsBackingUp(true)
    setError('')
    setSuccess('')
    try {
      await window.api.database.runManualBackup()
      const data = await window.api.settings.getAll()
      handleChange('backup_last_local_success', data.backup_last_local_success || '')
      handleChange('backup_last_cloud_success', data.backup_last_cloud_success || '')
      handleChange('backup_last_cloud_error', data.backup_last_cloud_error || '')

      if (!data.backup_last_cloud_error) {
        setError('')
      }

      setSuccess('Local database backup completed and validated successfully.')
    } catch (e: any) {
      setError(e.message || 'Backup failed')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleCloudToggle = async (enabled: boolean) => {
    const val = enabled ? 'true' : 'false'
    handleChange('backup_cloud_enabled', val)
    try {
      await window.api.settings.update({ ...settings, backup_cloud_enabled: val })
      if (enabled) {
        setSuccess('NovoPharma Cloud Backup enabled.')
      } else {
        setSuccess('NovoPharma Cloud Backup disabled.')
      }
    } catch (e: any) {
      setError('Failed to update cloud backup setting.')
    }
  }

  const handleCloudBackupNow = async () => {
    if (!settings.backup_location) {
      setError('Please configure a local backup location first.')
      return
    }

    setIsCloudUploading(true)
    setCloudUploadStep('Creating & uploading verified backup...')
    setError('')
    setSuccess('')
    try {
      const res = await window.api.cloudBackup.uploadLatest()

      const data = await window.api.settings.getAll()
      handleChange('backup_last_local_success', data.backup_last_local_success || '')
      handleChange('backup_last_cloud_success', data.backup_last_cloud_success || '')
      handleChange('backup_last_cloud_error', data.backup_last_cloud_error || '')

      if (!data.backup_last_cloud_error) {
        setError('')
        setSuccess('Cloud backup completed successfully.')
      } else {
        setError(mapFriendlyCloudError(data.backup_last_cloud_error))
      }
    } catch (e: any) {
      setError(mapFriendlyCloudError(e.message || 'Cloud backup failed'))
    } finally {
      setIsCloudUploading(false)
      setCloudUploadStep('')
    }
  }

  const handleRestore = async () => {
    try {
      const result = await window.api.database.restore()
      if (result) {
        setSuccess('Database restored successfully.')
      }
    } catch (e: any) {
      setError(e.message || 'Failed to restore database')
    }
  }

  const mapFriendlyCloudError = (rawErr?: string) => {
    if (!rawErr) return ''
    if (rawErr.includes('UNAUTHENTICATED') || rawErr.includes('sign in')) {
      return 'Cloud backup needs you to sign in again.'
    }
    if (rawErr.includes('MISSING_TENANT_ID') || rawErr.includes('tenant')) {
      return 'Cloud backup is not configured for this account.'
    }
    if (rawErr.includes('NETWORK_UNAVAILABLE') || rawErr.includes('network') || rawErr.includes('Storage')) {
      return 'Cloud backup is temporarily unavailable. Your local backup is safe.'
    }
    if (rawErr.includes('PERMISSION_DENIED') || rawErr.includes('permission')) {
      return 'Cloud backup permission denied for this tenant. Your local backup is safe.'
    }
    return 'Cloud backup could not be completed. Your local backup is still safe.'
  }

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'No cloud backup yet'
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'No cloud backup yet'
    }
  }

  const getCloudStatusBadge = () => {
    if (!isCloudEnabled) {
      return <Badge variant="default">DISABLED</Badge>
    }
    if (lastCloudError && lastCloudError.length > 0) {
      return <Badge variant="warning">ATTENTION REQUIRED</Badge>
    }
    return <Badge variant="success">ACTIVE</Badge>
  }

  const getCloudStatusText = () => {
    if (!isCloudEnabled) {
      return 'Disabled'
    }
    if (lastCloudError && lastCloudError.length > 0) {
      return mapFriendlyCloudError(lastCloudError)
    }
    return '✓ Connected & working normally'
  }

  return (
    <div className="space-y-6">
      {/* 1. LOCAL BACKUP SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Local Automatic Backup</h2>
          <p className="text-sm text-slate-500 mb-4">
            Automatically backup your database locally. Retention policy keeps the newest 30 backups.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
            <div>
              <div className="font-medium text-slate-800">Automatic Local Backup</div>
              <div className="text-xs text-slate-500">Every 2 hours & on application close</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.backup_auto_enabled === 'true'}
                onChange={(e) => handleChange('backup_auto_enabled', e.target.checked ? 'true' : 'false')}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  label="Backup Location"
                  value={settings.backup_location || ''}
                  readOnly
                  placeholder="No location selected"
                  onChange={() => {}}
                />
              </div>
              <Button type="button" onClick={handleSelectLocation} className="mb-[2px]">
                Change Location
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-700">Last Successful Local Backup</div>
              <div className="text-sm text-slate-500">{formatDate(settings.backup_last_local_success)}</div>
            </div>
            <Button
              type="button"
              onClick={handleManualBackup}
              disabled={isBackingUp || !settings.backup_location}
              className="bg-slate-800 hover:bg-slate-900 text-white"
            >
              <svg className="w-4 h-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isBackingUp ? 'Backing up...' : 'Backup Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. NOVOPHARMA CLOUD BACKUP SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-slate-800">NovoPharma Cloud Backup</h2>
            {getCloudStatusBadge()}
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Keep an additional secure copy of your verified backups in NovoPharma Cloud.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
            <div>
              <div className="font-medium text-slate-800">NovoPharma Cloud Backup</div>
              <div className="text-xs text-slate-500">
                {isCloudEnabled ? 'Cloud backup is active.' : 'Cloud backup is currently disabled.'}
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={isCloudEnabled}
                onChange={(e) => handleCloudToggle(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 rounded-lg border border-slate-100 p-4 mb-4">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cloud Status</div>
              <div className={`text-sm ${isCloudEnabled && !lastCloudError ? 'text-teal-700 font-medium' : lastCloudError ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
                {getCloudStatusText()}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Cloud Backup</div>
              <div className="text-sm text-slate-700 font-medium">
                {formatDate(settings.backup_last_cloud_success)}
              </div>
            </div>

            <div className="md:col-span-2 border-t border-slate-200/60 pt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600">Cloud retention</span>
                <span className="font-medium text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded-sm">7 calendar days</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cloud backups are automatically retained for the latest 7 calendar days. Older cloud backup files are removed automatically. Your pharmacy data is not deleted.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-5 gap-3 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCloudModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-300"
            >
              <svg className="w-4 h-4 mr-2 inline-block text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              View Cloud Backups
            </Button>

            <Button
              type="button"
              onClick={handleCloudBackupNow}
              disabled={!isCloudEnabled || isCloudUploading || !settings.backup_location}
              isLoading={isCloudUploading}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              <svg className="w-4 h-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {isCloudUploading ? (cloudUploadStep || 'Uploading...') : 'Backup Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* 3. GOOGLE DRIVE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Google Drive for Desktop Sync (Optional)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Google Drive sync is an optional local-folder synchronization method. NovoPharma saves validated backups to your selected local folder. If Google Drive for desktop is configured to synchronize this folder, Google will automatically sync the files to your Google Drive.
          </p>

          <div className="bg-slate-50 rounded-lg border border-slate-100 p-4 mb-4 text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-800">To use Google Drive backup:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Install Google Drive for desktop.</li>
              <li>Sign in with your Google account.</li>
              <li>Configure Google Drive for desktop to synchronize your NovoPharma local backup folder.</li>
              <li>NovoPharma will automatically create validated backups in that folder.</li>
            </ol>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-700">Status</div>
              <div className="text-sm text-teal-600 font-medium">
                {settings.backup_location ? 'Google Drive sync folder available' : 'Backup folder unavailable'}
              </div>
            </div>
            {settings.backup_location && (
              <Button
                type="button"
                onClick={() => window.api.database.openBackupFolder(settings.backup_location!)}
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200"
              >
                Open Backup Folder
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4. RESTORE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Restore from Backup</h2>
        <p className="text-sm text-slate-500">
          Restore from a previous backup file. Restoring will overwrite all current data and restart the application.
        </p>
        <Button onClick={handleRestore} type="button" className="bg-amber-600 hover:bg-amber-700 text-white border-transparent">
          <svg className="w-4 h-4 mr-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Restore from Backup
        </Button>
      </div>

      {/* CLOUD BACKUP HISTORY MODAL */}
      <CloudBackupModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />
    </div>
  )
}
