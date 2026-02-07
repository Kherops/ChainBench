import type { ImpactInputs, ImpactOutputs } from '@/types/report'

export function calculateImpact(
  delta_ms: number,
  inputs: ImpactInputs
): ImpactOutputs {
  const time_saved_hours_per_year =
    (delta_ms * inputs.executions_per_day * inputs.days_per_year) / 3_600_000

  const cost_saved_eur_per_year =
    time_saved_hours_per_year * inputs.cost_per_hour_eur

  const electricity_saved_kwh_per_year =
    time_saved_hours_per_year * inputs.electricity_kwh_per_hour

  const co2_avoided_kg_per_year =
    electricity_saved_kwh_per_year * inputs.co2_kg_per_kwh

  return {
    time_saved_hours_per_year,
    cost_saved_eur_per_year,
    electricity_saved_kwh_per_year,
    co2_avoided_kg_per_year,
  }
}

export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatLargeNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${formatNumber(num / 1_000_000, 1)}M`
  }
  if (num >= 1_000) {
    return `${formatNumber(num / 1_000, 1)}K`
  }
  return formatNumber(num, 0)
}
