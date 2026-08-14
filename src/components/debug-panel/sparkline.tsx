interface SparklineProps {
	values: number[]
	max?: number
	width?: number
	height?: number
	color?: string
	label?: string
}

export function Sparkline({
	values,
	max,
	width = 96,
	height = 22,
	color = "currentColor",
}: SparklineProps) {
	if (values.length < 2) {
		return <div className="debug-sparkline debug-sparkline--empty" style={{ width, height }} />
	}

	const peak = max ?? Math.max(...values, 1)
	const step = width / (values.length - 1)
	const points = values.map((v, i) => {
		const x = i * step
		const y = height - Math.min(1, v / peak) * (height - 2) - 1
		return `${x.toFixed(1)},${y.toFixed(1)}`
	})
	const area = `0,${height} ${points.join(" ")} ${width},${height}`

	return (
		<svg className="debug-sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
			<polygon points={area} fill={color} opacity={0.15} />
			<polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
		</svg>
	)
}