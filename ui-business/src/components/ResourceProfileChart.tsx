import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Cpu, HardDrive, Zap, Activity } from 'lucide-react'

interface ResourceProfile {
  summary: {
    cpu_avg: number
    cpu_max: number
    ram_avg_mb: number
    ram_max_mb: number
    io_total_mb: number
    gpu_avg: number
    duration_ms: number
  }
  curve: {
    timestamps: number[]
    cpu: number[]
    ram: number[]
    io: number[]
    gpu: number[]
  }
}

interface Props {
  impl: string
  variant: string
  profile: ResourceProfile
  color: string
}

export function ResourceProfileChart({ impl, variant, profile, color }: Props) {
  const { summary, curve } = profile

  // Transform data for recharts
  const chartData = curve.timestamps.map((timestamp, idx) => ({
    time: timestamp,
    CPU: curve.cpu[idx],
    RAM: curve.ram[idx],
    'I/O': curve.io[idx],
    GPU: curve.gpu[idx]
  }))

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {impl} <span className="text-gray-500">/ {variant}</span>
          </h3>
          <p className="text-sm text-gray-600">Resource Usage Profile</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-700">
            {summary.duration_ms.toFixed(0)}ms
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
          <Cpu className="w-5 h-5 text-orange-600" />
          <div>
            <div className="text-xs text-gray-600">CPU</div>
            <div className="text-sm font-semibold text-gray-900">
              {summary.cpu_avg.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">
              max {summary.cpu_max.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
          <Activity className="w-5 h-5 text-purple-600" />
          <div>
            <div className="text-xs text-gray-600">RAM</div>
            <div className="text-sm font-semibold text-gray-900">
              {summary.ram_avg_mb.toFixed(0)} MB
            </div>
            <div className="text-xs text-gray-500">
              max {summary.ram_max_mb.toFixed(0)} MB
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <HardDrive className="w-5 h-5 text-blue-600" />
          <div>
            <div className="text-xs text-gray-600">I/O</div>
            <div className="text-sm font-semibold text-gray-900">
              {summary.io_total_mb.toFixed(1)} MB
            </div>
            <div className="text-xs text-gray-500">total</div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
          <Zap className="w-5 h-5 text-green-600" />
          <div>
            <div className="text-xs text-gray-600">GPU</div>
            <div className="text-sm font-semibold text-gray-900">
              {summary.gpu_avg.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-500">avg</div>
          </div>
        </div>
      </div>

      {/* Profile Curve */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              label={{ value: 'Time (%)', position: 'insideBottom', offset: -5 }}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              label={{ value: 'Usage', angle: -90, position: 'insideLeft' }}
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'RAM' || name === 'I/O') {
                  return [`${value.toFixed(1)} MB`, name]
                }
                return [`${value.toFixed(1)}%`, name]
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="CPU"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="CPU %"
            />
            <Line
              type="monotone"
              dataKey="RAM"
              stroke="#a855f7"
              strokeWidth={2}
              dot={false}
              name="RAM MB"
            />
            <Line
              type="monotone"
              dataKey="I/O"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="I/O MB"
            />
            <Line
              type="monotone"
              dataKey="GPU"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="GPU %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>Note:</strong> Resource profile shows {impl}/{variant} usage over time.
          Normalized to 0-100% timeline. Higher values indicate more resource consumption.
        </p>
      </div>
    </div>
  )
}

export function ResourceProfilesSection({ profiles }: { profiles: Record<string, ResourceProfile> }) {
  if (!profiles || Object.keys(profiles).length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ Resource profiles not available. Install <code className="bg-yellow-100 px-1 rounded">psutil</code> to enable resource profiling.
        </p>
      </div>
    )
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resource Profiles</h2>
          <p className="text-sm text-gray-600 mt-1">
            CPU, RAM, I/O, and GPU usage per implementation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {Object.entries(profiles).map(([key, profile], idx) => {
          const [impl, variant] = key.split('/')
          return (
            <ResourceProfileChart
              key={key}
              impl={impl}
              variant={variant}
              profile={profile}
              color={colors[idx % colors.length]}
            />
          )
        })}
      </div>
    </div>
  )
}
