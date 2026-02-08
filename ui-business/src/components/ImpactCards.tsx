import { useState } from 'react'
import { Clock, DollarSign, Zap, Leaf, Edit2, Check, X } from 'lucide-react'
import type { Report, ImpactInputs } from '@/types/report'
import { formatNumber, formatLargeNumber } from '@/utils/calculations'

interface Props {
  report: Report
  impactInputs: ImpactInputs
  onImpactInputsChange: (inputs: ImpactInputs) => void
}

export default function ImpactCards({ report, impactInputs, onImpactInputsChange }: Props) {
  const delta_ms = report.summary.delta_ms
  const inputs = impactInputs
  const outputs = report.impact.outputs
  const [isEditing, setIsEditing] = useState(false)
  const [editInputs, setEditInputs] = useState(inputs)

  const handleSave = () => {
    onImpactInputsChange(editInputs)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditInputs(inputs)
    setIsEditing(false)
  }

  return (
    <section className="bg-slate-800/50 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Business Impact</h2>
          <p className="text-slate-400 text-sm mt-1">
            Measurable value for non-technical stakeholders
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit Assumptions
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <h3 className="text-white font-semibold mb-4">Edit Assumptions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Executions per day</label>
              <input
                type="number"
                value={editInputs.executions_per_day}
                onChange={(e) => setEditInputs({ ...editInputs, executions_per_day: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Days per year</label>
              <input
                type="number"
                value={editInputs.days_per_year}
                onChange={(e) => setEditInputs({ ...editInputs, days_per_year: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Cost model</label>
              <select
                value={editInputs.cost_model}
                onChange={(e) => setEditInputs({ ...editInputs, cost_model: e.target.value as 'infra' | 'human' })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              >
                <option value="infra">Infrastructure</option>
                <option value="human">Human time</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Cost per hour (€)</label>
              <input
                type="number"
                step="0.01"
                value={editInputs.cost_per_hour_eur}
                onChange={(e) => setEditInputs({ ...editInputs, cost_per_hour_eur: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Electricity (kWh/hour)</label>
              <input
                type="number"
                step="0.001"
                value={editInputs.electricity_kwh_per_hour}
                onChange={(e) => setEditInputs({ ...editInputs, electricity_kwh_per_hour: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">CO₂ (kg/kWh)</label>
              <input
                type="number"
                step="0.001"
                value={editInputs.co2_kg_per_kwh}
                onChange={(e) => setEditInputs({ ...editInputs, co2_kg_per_kwh: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-lg p-6 border border-blue-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-600/30 rounded-lg">
              <Clock className="w-6 h-6 text-blue-300" />
            </div>
            <h3 className="text-blue-200 font-semibold">Time Saved</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {formatLargeNumber(outputs.time_saved_hours_per_year)}
          </p>
          <p className="text-blue-300 text-sm">hours per year</p>
          <div className="mt-3 pt-3 border-t border-blue-700/50">
            <p className="text-blue-200 text-xs">
              {formatNumber(delta_ms, 0)} ms × {formatLargeNumber(inputs.executions_per_day)} exec/day × {inputs.days_per_year} days
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-lg p-6 border border-green-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-600/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-300" />
            </div>
            <h3 className="text-green-200 font-semibold">Cost Saved</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            €{formatLargeNumber(outputs.cost_saved_eur_per_year)}
          </p>
          <p className="text-green-300 text-sm">per year</p>
          <div className="mt-3 pt-3 border-t border-green-700/50">
            <p className="text-green-200 text-xs">
              {inputs.cost_model === 'infra' ? 'Infrastructure' : 'Human'} cost model @ €{formatNumber(inputs.cost_per_hour_eur, 2)}/hour
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 rounded-lg p-6 border border-yellow-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-yellow-600/30 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-300" />
            </div>
            <h3 className="text-yellow-200 font-semibold">Energy Saved</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {formatLargeNumber(outputs.electricity_saved_kwh_per_year)}
          </p>
          <p className="text-yellow-300 text-sm">kWh per year</p>
          <div className="mt-3 pt-3 border-t border-yellow-700/50">
            <p className="text-yellow-200 text-xs">
              @ {formatNumber(inputs.electricity_kwh_per_hour, 3)} kWh/hour consumption
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-800/30 rounded-lg p-6 border border-emerald-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-emerald-600/30 rounded-lg">
              <Leaf className="w-6 h-6 text-emerald-300" />
            </div>
            <h3 className="text-emerald-200 font-semibold">CO₂ Avoided</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            {formatLargeNumber(outputs.co2_avoided_kg_per_year)}
          </p>
          <p className="text-emerald-300 text-sm">kg per year</p>
          <div className="mt-3 pt-3 border-t border-emerald-700/50">
            <p className="text-emerald-200 text-xs">
              @ {formatNumber(inputs.co2_kg_per_kwh, 3)} kg CO₂/kWh grid intensity
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
        <p className="text-slate-400 text-sm">
          <strong className="text-slate-300">Why it matters:</strong> These projections translate technical performance 
          into business value. Adjust assumptions above to match your specific use case. All calculations are transparent 
          and auditable.
        </p>
      </div>
    </section>
  )
}
