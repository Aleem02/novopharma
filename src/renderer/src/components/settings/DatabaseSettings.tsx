import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface DatabaseSettingsProps {
  settings: Record<string, string>
  handleChange: (key: string, value: string) => void
  setError: (msg: string) => void
  setSuccess: (msg: string) => void
}

export const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({ settings, handleChange, setError, setSuccess }) => {
  const [isBackingUp, setIsBackingUp] = useState(false)

  const handleSelectLocation = async () => {
    try {
      const location = await window.api.database.selectBackupLocation()
      if (location) {
        handleChange('backup_location', location)
        // Also save immediately
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
      // Reload settings to get updated timestamp
      const data = await window.api.settings.getAll()
      handleChange('backup_last_local_success', data.backup_last_local_success || '')
      handleChange('backup_last_gdrive_success', data.backup_last_gdrive_success || '')
      
      setSuccess('Database backup completed and validated successfully.')
    } catch (e: any) {
      setError(e.message || 'Backup failed')
    } finally {
      setIsBackingUp(false)
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

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never'
    try {
      return new Date(isoString).toLocaleString()
    } catch {
      return 'Never'
    }
  }

  return (
    <div className="space-y-6">
      {/* LOCAL BACKUP SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Local Automatic Backup</h2>
          <p className="text-sm text-slate-500 mb-4">
            Automatically backup your database locally. Retention policy keeps the newest 30 backups.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 mb-4">
            <div>
              <div className="font-medium text-slate-800">Automatic Backup</div>
              <div className="text-xs text-slate-500">Every 2 hours & on application close</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={settings.backup_auto_enabled === 'true'}
                onChange={(e) => handleChange('backup_auto_enabled', e.target.checked ? 'true' : 'false')} placeholder="Enter value..."
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
              <div className="text-sm font-medium text-slate-700">Last Successful Backup</div>
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

      {/* GOOGLE DRIVE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Google Drive for Desktop Sync</h2>
          <p className="text-sm text-slate-500 mb-4">
            NovoPharma saves validated backups to the selected folder. If Google Drive for desktop is configured to synchronize this folder, Google will automatically synchronize the files to your Google Drive.
          </p>

          <div className="bg-slate-50 rounded-lg border border-slate-100 p-4 mb-4 text-sm text-slate-600 space-y-2">
            <p className="font-medium text-slate-800">To use Google Drive backup:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Install Google Drive for desktop.</li>
              <li>Sign in with your Google account.</li>
              <li>Configure Google Drive for desktop to synchronize your NovoPharma backup folder.</li>
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

      {/* RESTORE SECTION */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Restore</h2>
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
    </div>
  )
}
