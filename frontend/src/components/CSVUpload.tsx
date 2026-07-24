// src/components/CSVUpload.tsx
import React, { useState } from 'react';
import Alert from './Alert';
import { API_URL } from './api';

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
    data: Record<string, unknown>;
  }>;
  riskAlert?: {
    highRiskCases: number;
    emailsSent: number;
    predictionId?: string;
    message: string;
    alert?: {
      action: string;
      message: string;
      alertId: string | null;
    } | null;
  };
}

interface CSVUploadProps {
  token: string;
  onUploadSuccess?: () => void;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ token, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<{ caseReports: number } | null>(null);


  // Fetch database statistics
  // 🔑 FIX: /upload/stats now requires authentication on the backend
  // (it used to be a public endpoint that leaked case-report counts to
  // anyone). This call must send the Bearer token or it will 401 and the
  // stats box will silently stop showing.
  const fetchStats = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/upload/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.database);
      } else {
        console.error('Failed to fetch stats: HTTP', response.status);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  // Fetch stats on mount and whenever the token becomes available/changes
  React.useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

      const headers: HeadersInit = {};
      // Add authorization header if token exists
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      console.log('📤 Uploading CSV file:', selectedFile.name);

      const response = await fetch(`${API_URL}/upload/case-reports`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      console.log('✅ CSV upload successful:', data.summary);

      setResult(data);
      setSelectedFile(null);

      // Reset file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      // Refresh stats
      fetchStats();

      // 🔑 Trigger dashboard refresh to update report counts
      if (onUploadSuccess) {
        console.log('🔄 Triggering dashboard refresh after case reports CSV upload');
        // Wait for backend to finish processing and saving records
        setTimeout(async () => {
          console.log('📊 Fetching updated reports from backend...');
          await onUploadSuccess();
          console.log('✅ Dashboard refresh complete');
        }, 1000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    const csvContent = `reporter_type,patient_age,sex,district,village_area,severity,symptoms,reported_at,remarks
Clinic Staff,45,Male,Warangal,Ramapur,Moderate,Fever|Headache,2026-06-01T10:30Z,Patient advised to rest and hydrate
ASHA Worker,32,Female,Warangal,Ramapur,Mild,Diarrhea,2026-06-02T14:15Z,
Community Volunteer,28,Male,Warangal,Kothapet,Severe,Vomiting|Nausea,2026-06-03T08:45Z,Referred to local clinic
Clinic Staff,55,Female,Warangal,Kothapet,Moderate,Abdominal Pain|Fatigue,2026-06-04T16:20Z,`;
    const filename = 'sample_case_reports.csv';

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
            <div>
              <p className="text-sm text-blue-700">Case Reports:</p>
              <p className="text-2xl font-bold text-blue-900">{stats.caseReports}</p>
            </div>
          </div>
        )}

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
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              type="button"
              onClick={handleDownloadSample}
              className="whitespace-nowrap px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50"
            >
              📥 Sample CSV
            </button>
          </div>
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: <span className="font-medium">{selectedFile.name}</span> (
              {(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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

              {result.summary.successful > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    ℹ️ <strong>Next Steps:</strong> Check your <strong>Overview</strong> and <strong>Reports</strong> tabs to see the uploaded data reflected in your dashboard statistics and report list.
                  </p>
                </div>
              )}

              {/* High-Risk Alert */}
              {result.riskAlert && (
                <div className="mt-4 p-4 bg-red-50 rounded-lg border-2 border-red-300">
                  <h3 className="font-semibold text-red-800 mb-2">🚨 High-Risk Alert Triggered</h3>
                  <p className="text-sm text-red-800 mb-2">{result.riskAlert.message}</p>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <p className="text-xs text-red-600">High-Risk Cases</p>
                      <p className="text-xl font-bold text-red-800">{result.riskAlert.highRiskCases}</p>
                    </div>
                    <div>
                      <p className="text-xs text-red-600">Emails Sent</p>
                      <p className="text-xl font-bold text-red-800">{result.riskAlert.emailsSent}</p>
                    </div>
                  </div>
                  {result.riskAlert.predictionId && (
                    <p className="text-xs text-red-600">
                      Prediction ID: <span className="font-mono">{result.riskAlert.predictionId}</span>
                    </p>
                  )}
                  {result.riskAlert.alert && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <p className="text-sm text-red-800">
                        <strong>Alert {result.riskAlert.alert.action}:</strong> {result.riskAlert.alert.message}
                      </p>
                      {result.riskAlert.alert.alertId && (
                        <p className="text-xs text-red-600 mt-1">
                          Alert ID: <span className="font-mono">{result.riskAlert.alert.alertId}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h3 className="font-semibold text-yellow-900 mb-2">📝 Instructions</h3>
          <ul className="text-sm text-yellow-800 space-y-1">

            <li>• Use pipe (|) to separate multiple symptoms</li>
            <li>• Dates must be in ISO 8601 format (e.g., 2026-06-01T10:30Z)</li>
            <li>• If District is left blank, it's auto-filled from your operator account</li>
          </ul>
        </div>

        {/* Format Example */}
        <div className="mt-6">
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
            <h4 className="font-bold text-blue-900 mb-4 text-lg">📋 Case Reports CSV Format</h4>

            {/* Required Fields */}
            <div className="mb-4">
              <h5 className="font-semibold text-blue-800 mb-2">Required Fields:</h5>
              <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">reporter_type</span>
                  <span className="col-span-2 text-gray-700">ASHA Worker, Community Volunteer, Health Official, Clinic Staff</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">patient_age</span>
                  <span className="col-span-2 text-gray-700">Age in years (e.g., 45, 8, 67)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">sex</span>
                  <span className="col-span-2 text-gray-700">Male, Female, or Other (M, F, O also accepted)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">district</span>
                  <span className="col-span-2 text-gray-700">District name (e.g., Warangal) - auto-filled from your account if left blank</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">village_area</span>
                  <span className="col-span-2 text-gray-700">Village or area name (e.g., Ramapur)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">severity</span>
                  <span className="col-span-2 text-gray-700">Mild, Moderate, Severe, or Critical</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">symptoms</span>
                  <span className="col-span-2 text-gray-700">Pipe-separated (Fever|Headache|Diarrhea)</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">reported_at</span>
                  <span className="col-span-2 text-gray-700">ISO 8601 format (2026-06-10T10:30Z)</span>
                </div>
              </div>
            </div>

            {/* Optional Fields */}
            <div className="mb-4">
              <h5 className="font-semibold text-blue-800 mb-2">Optional Fields:</h5>
              <div className="bg-white p-3 rounded border border-blue-200 space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">remarks</span>
                  <span className="col-span-2 text-gray-700">Additional notes or observations</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="font-mono text-blue-700">reporter_id</span>
                  <span className="col-span-2 text-gray-700">Ignored - automatically set to your username</span>
                </div>
              </div>
            </div>

            {/* Example */}
            <div>
              <h5 className="font-semibold text-blue-800 mb-2">Example CSV:</h5>
              <pre className="text-xs bg-white p-3 rounded border border-blue-200 overflow-x-auto text-gray-800 font-mono">
                reporter_type,patient_age,sex,district,village_area,severity,symptoms,reported_at,remarks
                Clinic Staff,45,Male,Warangal,Ramapur,Moderate,Fever|Headache|Diarrhea,2026-06-10T10:30Z,Patient stable
                ASHA Worker,32,Female,Warangal,Ramapur,Severe,Diarrhea|Vomiting|Dehydration,2026-06-10T14:15Z,
                Community Volunteer,28,Male,Warangal,Kothapet,Mild,Nausea|Abdominal Pain,2026-06-10T08:45Z,
              </pre>
            </div>


            {/* Common Symptoms */}
            <div className="mt-4 p-3 bg-blue-100 rounded border border-blue-300">
              <h5 className="font-semibold text-blue-900 mb-1">💡 Common Symptoms:</h5>
              <p className="text-xs text-blue-800">
                Fever, Headache, Diarrhea, Vomiting, Nausea, Abdominal Pain, Stomach Pain, Dehydration, Blood in Stool, Fatigue, Body Ache, Cough
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};