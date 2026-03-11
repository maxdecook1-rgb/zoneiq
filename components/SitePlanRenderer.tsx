'use client'

import { useState } from 'react'

interface SitePlanProps {
  lotWidth: number
  lotDepth: number
  building: {
    x_ft: number
    y_ft: number
    width_ft: number
    depth_ft: number
    rotation_deg?: number
  }
  setbacks: {
    front_ft: number
    rear_ft: number
    left_ft: number
    right_ft: number
  }
  driveway?: {
    start_x: number
    start_y: number
    end_x: number
    end_y: number
    width_ft: number
  } | null
  parkingAreas?: {
    x_ft: number
    y_ft: number
    width_ft: number
    depth_ft: number
    spaces: number
  }[]
  landscaping?: {
    x_ft: number
    y_ft: number
    width_ft: number
    depth_ft: number
    type: string
  }[]
  utilities?: {
    type: string
    from_x: number
    from_y: number
    to_x: number
    to_y: number
  }[]
  notes?: string[]
  tier: 'basic' | 'medium' | 'detailed'
  totalCoveragePct?: number
  totalImperviousPct?: number
}

export default function SitePlanRenderer({
  lotWidth,
  lotDepth,
  building,
  setbacks,
  driveway,
  parkingAreas = [],
  landscaping = [],
  utilities = [],
  notes = [],
  tier,
  totalCoveragePct,
  totalImperviousPct,
}: SitePlanProps) {
  const [showLabels, setShowLabels] = useState(true)
  const [showSetbacks, setShowSetbacks] = useState(true)

  // SVG dimensions and scaling
  const padding = 60
  const svgWidth = 800
  const svgHeight = 600
  const scale = Math.min(
    (svgWidth - padding * 2) / lotWidth,
    (svgHeight - padding * 2) / lotDepth
  )

  const toX = (ft: number) => padding + ft * scale
  const toY = (ft: number) => svgHeight - padding - ft * scale  // Flip Y axis
  const toW = (ft: number) => ft * scale
  const toH = (ft: number) => ft * scale

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-600">Labels</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSetbacks}
            onChange={(e) => setShowSetbacks(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-600">Setback Lines</span>
        </label>
        {totalCoveragePct !== undefined && (
          <span className="text-gray-500">Coverage: {totalCoveragePct.toFixed(1)}%</span>
        )}
        {totalImperviousPct !== undefined && (
          <span className="text-gray-500">Impervious: {totalImperviousPct.toFixed(1)}%</span>
        )}
      </div>

      {/* SVG Site Plan */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ maxHeight: '600px' }}
        >
          {/* Background */}
          <rect width={svgWidth} height={svgHeight} fill="#fafafa" />

          {/* Lot Boundary */}
          <rect
            x={toX(0)}
            y={toY(lotDepth)}
            width={toW(lotWidth)}
            height={toH(lotDepth)}
            fill="#e8f5e9"
            stroke="#2e7d32"
            strokeWidth={2}
          />

          {/* Setback Lines */}
          {showSetbacks && (
            <rect
              x={toX(setbacks.left_ft)}
              y={toY(lotDepth - setbacks.rear_ft)}
              width={toW(lotWidth - setbacks.left_ft - setbacks.right_ft)}
              height={toH(lotDepth - setbacks.front_ft - setbacks.rear_ft)}
              fill="none"
              stroke="#ef6c00"
              strokeWidth={1}
              strokeDasharray="6,4"
              opacity={0.7}
            />
          )}

          {/* Landscaping Areas (medium/detailed tier) */}
          {(tier === 'medium' || tier === 'detailed') && landscaping.map((area, i) => (
            <g key={`landscape-${i}`}>
              <rect
                x={toX(area.x_ft)}
                y={toY(area.y_ft + area.depth_ft)}
                width={toW(area.width_ft)}
                height={toH(area.depth_ft)}
                fill="#c8e6c9"
                stroke="#4caf50"
                strokeWidth={1}
                opacity={0.5}
              />
              {showLabels && (
                <text
                  x={toX(area.x_ft + area.width_ft / 2)}
                  y={toY(area.y_ft + area.depth_ft / 2)}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#2e7d32"
                >
                  {area.type}
                </text>
              )}
            </g>
          ))}

          {/* Parking Areas */}
          {parkingAreas.map((area, i) => (
            <g key={`parking-${i}`}>
              <rect
                x={toX(area.x_ft)}
                y={toY(area.y_ft + area.depth_ft)}
                width={toW(area.width_ft)}
                height={toH(area.depth_ft)}
                fill="#e0e0e0"
                stroke="#757575"
                strokeWidth={1}
              />
              {showLabels && (
                <text
                  x={toX(area.x_ft + area.width_ft / 2)}
                  y={toY(area.y_ft + area.depth_ft / 2)}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#424242"
                  fontWeight="bold"
                >
                  P ({area.spaces})
                </text>
              )}
            </g>
          ))}

          {/* Driveway */}
          {driveway && (
            <line
              x1={toX(driveway.start_x)}
              y1={toY(driveway.start_y)}
              x2={toX(driveway.end_x)}
              y2={toY(driveway.end_y)}
              stroke="#9e9e9e"
              strokeWidth={toW(driveway.width_ft)}
              strokeLinecap="round"
              opacity={0.6}
            />
          )}

          {/* Utility Lines (detailed tier) */}
          {tier === 'detailed' && utilities.map((util, i) => (
            <g key={`utility-${i}`}>
              <line
                x1={toX(util.from_x)}
                y1={toY(util.from_y)}
                x2={toX(util.to_x)}
                y2={toY(util.to_y)}
                stroke={util.type === 'water' ? '#1565c0' : util.type === 'sewer' ? '#6a1b9a' : '#ff8f00'}
                strokeWidth={1.5}
                strokeDasharray="3,3"
              />
              {showLabels && (
                <text
                  x={toX((util.from_x + util.to_x) / 2)}
                  y={toY((util.from_y + util.to_y) / 2) - 5}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#666"
                >
                  {util.type}
                </text>
              )}
            </g>
          ))}

          {/* Building Footprint */}
          <rect
            x={toX(building.x_ft)}
            y={toY(building.y_ft + building.depth_ft)}
            width={toW(building.width_ft)}
            height={toH(building.depth_ft)}
            fill="#1565c0"
            stroke="#0d47a1"
            strokeWidth={2}
            opacity={0.8}
          />

          {/* Building Label */}
          {showLabels && (
            <text
              x={toX(building.x_ft + building.width_ft / 2)}
              y={toY(building.y_ft + building.depth_ft / 2)}
              textAnchor="middle"
              fontSize={12}
              fill="white"
              fontWeight="bold"
            >
              BUILDING
            </text>
          )}

          {/* Dimension Labels */}
          {showLabels && (
            <>
              {/* Lot Width */}
              <text
                x={toX(lotWidth / 2)}
                y={toY(-3)}
                textAnchor="middle"
                fontSize={11}
                fill="#333"
              >
                {lotWidth}&apos;
              </text>

              {/* Lot Depth */}
              <text
                x={toX(-5)}
                y={toY(lotDepth / 2)}
                textAnchor="middle"
                fontSize={11}
                fill="#333"
                transform={`rotate(-90, ${toX(-5)}, ${toY(lotDepth / 2)})`}
              >
                {lotDepth}&apos;
              </text>

              {/* Setback labels */}
              {showSetbacks && (
                <>
                  <text x={toX(lotWidth / 2)} y={toY(setbacks.front_ft / 2)} textAnchor="middle" fontSize={9} fill="#ef6c00">
                    Front: {setbacks.front_ft}&apos;
                  </text>
                  <text x={toX(lotWidth / 2)} y={toY(lotDepth - setbacks.rear_ft / 2)} textAnchor="middle" fontSize={9} fill="#ef6c00">
                    Rear: {setbacks.rear_ft}&apos;
                  </text>
                </>
              )}
            </>
          )}

          {/* North Arrow */}
          <g transform={`translate(${svgWidth - 40}, 30)`}>
            <polygon points="0,-15 -6,5 6,5" fill="#333" />
            <text x={0} y={18} textAnchor="middle" fontSize={12} fill="#333" fontWeight="bold">N</text>
          </g>

          {/* Scale Bar */}
          <g transform={`translate(${padding}, ${svgHeight - 20})`}>
            <line x1={0} y1={0} x2={toW(20)} y2={0} stroke="#333" strokeWidth={2} />
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#333" strokeWidth={2} />
            <line x1={toW(20)} y1={-4} x2={toW(20)} y2={4} stroke="#333" strokeWidth={2} />
            <text x={toW(10)} y={-6} textAnchor="middle" fontSize={9} fill="#333">20 ft</text>
          </g>

          {/* Title Block */}
          <text x={svgWidth / 2} y={20} textAnchor="middle" fontSize={14} fill="#333" fontWeight="bold">
            SITE PLAN — {tier.toUpperCase()} TIER
          </text>
        </svg>
      </div>

      {/* Notes */}
      {notes.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Notes</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {notes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-700 rounded-sm" /> Building
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-500 rounded-sm" /> Lot
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gray-300 rounded-sm" /> Parking
        </div>
        {showSetbacks && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-orange-500" style={{ width: 12 }} /> Setback
          </div>
        )}
      </div>
    </div>
  )
}
