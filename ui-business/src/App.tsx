import { useState } from 'react'
import { Upload } from 'lucide-react'
import { ReportSchema, type Report } from './types/report'
import ReportViewer from './components/ReportViewer'

function App() {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)
        const validated = ReportSchema.parse(json)
        setReport(validated)
        setError(null)
      } catch (err) {
        if (err instanceof Error) {
          setError(`Invalid report.json: ${err.message}`)
        } else {
          setError('Invalid report.json format')
        }
        setReport(null)
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.json')) {
      handleFile(file)
    } else {
      setError('Please drop a valid .json file')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  if (report) {
    return <ReportViewer report={report} onReset={() => setReport(null)} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">ChainBench</h1>
          <p className="text-slate-300 text-lg">
            Performance Analysis & Business Impact Platform
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            border-4 border-dashed rounded-2xl p-16 text-center transition-all
            ${
              isDragging
                ? 'border-primary-400 bg-primary-900/20 scale-105'
                : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
            }
          `}
        >
          <Upload className="w-16 h-16 mx-auto mb-6 text-slate-400" />
          <h2 className="text-2xl font-semibold text-white mb-3">
            Drop your report.json here
          </h2>
          <p className="text-slate-400 mb-6">
            or click to browse files
          </p>
          <label className="inline-block">
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="hidden"
            />
            <span className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer inline-block transition-colors">
              Choose File
            </span>
          </label>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        <div className="mt-8 p-6 bg-slate-800/50 rounded-xl border border-slate-700">
          <h3 className="text-white font-semibold mb-3">What is ChainBench?</h3>
          <ul className="text-slate-300 text-sm space-y-2">
            <li>• Measures structural performance gains in software chains</li>
            <li>• Provides kernel-level evidence via eBPF probes</li>
            <li>• Translates performance into business impact (€, kWh, CO₂)</li>
            <li>• Machine-agnostic comparison using ratios, not absolute times</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App
