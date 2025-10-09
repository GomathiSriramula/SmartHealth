// src/components/CSVUpload.tsx
import React, { useState } from 'react';
import Alert from './Alert';

interface UploadResult {
  message: string;
  summary: {
    totalRows: number;
    successful: number;
    failed: number;
  };
  errors: Array<{
    line: number;
    error: string;
    data: any;
  }>;
}

export const CSVUpload: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'case-reports' | 'sensor-readings'>('case-reports');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<{ caseReports: number; sensorReadings: number } | null>(null);

  const API_URL = 'http://127.0.0.1:5000';

  // Fetch database statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/upload/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.database);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch stats on component mount
  React.useEffect(() => {
    fetchStats();
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setSelectedFile(null);
        return;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const endpoint = uploadType === 'case-reports' 
        ? '/upload/case-reports' 
        : '/upload/sensor-readings';

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Refresh stats
      fetchStats();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = (type: 'case-reports' | 'sensor-readings') => {
    let csvContent = '';
    let filename = '';

    if (type === 'case-reports') {
      csvContent = `reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
Clinic,c-2001,45,M,17.4530,78.3950,Fever|Headache,2025-11-01T10:30Z
ASHA,r-2002,32,F,17.4520,78.3960,Diarrhea,2025-11-02T14:15Z
Volunteer,v-2003,28,M,17.4510,78.3940,Vomiting|Nausea,2025-11-03T08:45Z
Clinic,c-2004,55,F,17.4540,78.3970,Stomach Pain,2025-11-04T16:20Z`;
      filename = 'sample_case_reports.csv';
    } else {
      csvContent = `sensor_id,reading_at,lat,lng,turbidity,pH,conductivity
S-001,2025-11-01T10:00Z,17.4530,78.3950,5.2,7.1,450
S-002,2025-11-01T10:15Z,17.4520,78.3960,8.5,6.8,520
S-003,2025-11-01T10:30Z,17.4510,78.3940,3.1,7.4,380
S-004,2025-11-01T11:15Z,17.4540,78.3970,12.3,6.5,680`;
      filename = 'sample_sensor_readings.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">📤 CSV File Upload</h2>

        {/* Database Statistics */}
        {stats && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">📊 Database Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-blue-700">Case Reports:</p>
                <p className="text-2xl font-bold text-blue-900">{stats.caseReports}</p>
              </div>
              <div>
                <p className="text-sm text-blue-700">Sensor Readings:</p>
                <p className="text-2xl font-bold text-blue-900">{stats.sensorReadings}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Type
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="case-reports"
                checked={uploadType === 'case-reports'}
                onChange={(e) => setUploadType(e.target.value as any)}
                className="mr-2"
              />
              <span className="text-gray-700">Case Reports</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="sensor-readings"
                checked={uploadType === 'sensor-readings'}
                onChange={(e) => setUploadType(e.target.value as any)}
                className="mr-2"
              />
              <span className="text-gray-700">Sensor Readings</span>
            </label>
          </div>
        </div>

        {/* File Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <div className="flex items-center gap-4">
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
            <button
              onClick={() => handleDownloadSample(uploadType)}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md hover:bg-blue-50"
            >
              📥 Download Sample
            </button>
          </div>
          {selectedFile && (
            <p className="mt-2 text-sm text-green-600">
              ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
            !selectedFile || uploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </span>
          ) : (
            '📤 Upload CSV File'
          )}
        </button>

        {/* Error Message */}
        {error && (
          <Alert type="error" message={error} onClose={() => setError('')} />
        )}

        {/* Success Result */}
        {result && (
          <div className="mt-6">
            <Alert
              type="success"
              message={result.message}
              onClose={() => setResult(null)}
            />
            
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">📈 Upload Summary</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Rows</p>
                  <p className="text-2xl font-bold text-gray-800">{result.summary.totalRows}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-green-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">{result.summary.successful}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-red-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{result.summary.failed}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-red-700 mb-2">❌ Errors (showing first 10):</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded border border-red-200 text-sm">
                        <p className="font-semibold text-red-800">Line {err.line}: {err.error}</p>
                        <p className="text-red-600 text-xs mt-1">
                          Data: {JSON.stringify(err.data).substring(0, 100)}...
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">📝 Instructions</h3>
          <ul className="text-sm text-yellow-800 space-y-1">
            <li>• File must be in CSV format (.csv)</li>
            <li>• Maximum file size: 10MB</li>
            <li>• First row must contain column headers</li>
            <li>• Download sample file to see required format</li>
            <li>• Use pipe (|) to separate multiple symptoms</li>
            <li>• Dates must be in ISO 8601 format (e.g., 2025-11-01T10:30Z)</li>
          </ul>
        </div>

        {/* Format Examples */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">Case Reports Format</h4>
            <pre className="text-xs text-gray-600 overflow-x-auto">
              reporter_type,reporter_id,patient_age,sex,lat,lng,symptoms,reported_at
              Clinic,c-001,45,M,17.45,78.39,Fever|Headache,2025-11-01T10:30Z
            </pre>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-800 mb-2">Sensor Readings Format</h4>
            <pre className="text-xs text-gray-600 overflow-x-auto">
              sensor_id,reading_at,lat,lng,turbidity,pH,conductivity
              S-001,2025-11-01T10:00Z,17.45,78.39,5.2,7.1,450
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
