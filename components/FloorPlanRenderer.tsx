'use client'

import { useState } from 'react'

interface FloorPlanProps {
  floors: {
    floor: number
    rooms: {
      name: string
      width_ft: number
      height_ft: number
      x_ft: number
      y_ft: number
      type: string
    }[]
    walls?: { x1: number; y1: number; x2: number; y2: number }[]
    doors?: { x: number; y: number; width_ft: number; rotation: number }[]
  }[]
  totalWidth: number
  totalDepth: number
  totalSqft: number
  description: string
}

const roomColors: Record<string, string> = {
  bedroom: '#e3f2fd',
  bathroom: '#e0f2f1',
  kitchen: '#fff3e0',
  living: '#f3e5f5',
  living_room: '#f3e5f5',
  dining: '#fce4ec',
  dining_room: '#fce4ec',
  garage: '#eceff1',
  closet: '#f5f5f5',
  hallway: '#fafafa',
  laundry: '#e8eaf6',
  office: '#e8f5e9',
  master_bedroom: '#e3f2fd',
  master_bath: '#e0f2f1',
  porch: '#fff8e1',
  entry: '#efebe9',
  foyer: '#efebe9',
  utility: '#f5f5f5',
  storage: '#eeeeee',
  default: '#f5f5f5',
}

function getRoomColor(type: string): string {
  const key = type.toLowerCase().replace(/\s+/g, '_')
  return roomColors[key] || roomColors.default
}

const roomStroke: Record<string, string> = {
  bedroom: '#1565c0',
  bathroom: '#00695c',
  kitchen: '#e65100',
  living: '#6a1b9a',
  living_room: '#6a1b9a',
  dining: '#880e4f',
  dining_room: '#880e4f',
  garage: '#37474f',
  default: '#616161',
}

function getRoomStroke(type: string): string {
  const key = type.toLowerCase().replace(/\s+/g, '_')
  return roomStroke[key] || roomStroke.default
}

export default function FloorPlanRenderer({
  floors,
  totalWidth,
  totalDepth,
  totalSqft,
  description,
}: FloorPlanProps) {
  const [activeFloor, setActiveFloor] = useState(0)
  const [showDimensions, setShowDimensions] = useState(true)

  const floor = floors[activeFloor]
  if (!floor) return null

  // SVG dimensions
  const padding = 50
  const svgWidth = 800
  const svgHeight = 600
  const scale = Math.min(
    (svgWidth - padding * 2) / totalWidth,
    (svgHeight - padding * 2) / totalDepth
  )

  const toX = (ft: number) => padding + ft * scale
  const toY = (ft: number) => svgHeight - padding - ft * scale
  const toW = (ft: number) => ft * scale
  const toH = (ft: number) => ft * scale

  return (
    <div className="space-y-4">
      {/* Floor selector */}
      {floors.length > 1 && (
        <div className="flex gap-2">
          {floors.map((f, i) => (
            <button
              key={i}
              onClick={() => setActiveFloor(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFloor === i
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.floor === 1 ? '1st Floor' : f.floor === 2 ? '2nd Floor' : `Floor ${f.floor}`}
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showDimensions}
            onChange={(e) => setShowDimensions(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-600">Dimensions</span>
        </label>
        <span className="text-gray-500">Total: {totalSqft.toLocaleString()} sq ft</span>
        <span className="text-gray-500">{totalWidth}&apos; x {totalDepth}&apos;</span>
      </div>

      {/* SVG Floor Plan */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ maxHeight: '600px' }}
        >
          {/* Background */}
          <rect width={svgWidth} height={svgHeight} fill="white" />

          {/* Outer walls */}
          <rect
            x={toX(0)}
            y={toY(totalDepth)}
            width={toW(totalWidth)}
            height={toH(totalDepth)}
            fill="none"
            stroke="#212121"
            strokeWidth={3}
          />

          {/* Rooms */}
          {floor.rooms.map((room, i) => (
            <g key={i}>
              <rect
                x={toX(room.x_ft)}
                y={toY(room.y_ft + room.height_ft)}
                width={toW(room.width_ft)}
                height={toH(room.height_ft)}
                fill={getRoomColor(room.type)}
                stroke={getRoomStroke(room.type)}
                strokeWidth={1.5}
              />
              {/* Room name */}
              <text
                x={toX(room.x_ft + room.width_ft / 2)}
                y={toY(room.y_ft + room.height_ft / 2) + 2}
                textAnchor="middle"
                fontSize={room.width_ft * scale > 60 ? 11 : 9}
                fill="#333"
                fontWeight="600"
              >
                {room.name}
              </text>
              {/* Room dimensions */}
              {showDimensions && room.width_ft * scale > 40 && (
                <text
                  x={toX(room.x_ft + room.width_ft / 2)}
                  y={toY(room.y_ft + room.height_ft / 2) + 16}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#888"
                >
                  {room.width_ft}&apos; x {room.height_ft}&apos;
                </text>
              )}
            </g>
          ))}

          {/* Additional walls */}
          {floor.walls?.map((wall, i) => (
            <line
              key={`wall-${i}`}
              x1={toX(wall.x1)}
              y1={toY(wall.y1)}
              x2={toX(wall.x2)}
              y2={toY(wall.y2)}
              stroke="#212121"
              strokeWidth={2}
            />
          ))}

          {/* Doors */}
          {floor.doors?.map((door, i) => (
            <g key={`door-${i}`} transform={`translate(${toX(door.x)}, ${toY(door.y)})`}>
              <line
                x1={0}
                y1={0}
                x2={toW(door.width_ft)}
                y2={0}
                stroke="#e65100"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Door swing arc */}
              <path
                d={`M 0 0 A ${toW(door.width_ft)} ${toW(door.width_ft)} 0 0 1 ${toW(door.width_ft)} ${-toW(door.width_ft)}`}
                fill="none"
                stroke="#e65100"
                strokeWidth={0.5}
                strokeDasharray="2,2"
                opacity={0.5}
              />
            </g>
          ))}

          {/* Overall dimensions */}
          {showDimensions && (
            <>
              <text
                x={toX(totalWidth / 2)}
                y={toY(-3)}
                textAnchor="middle"
                fontSize={12}
                fill="#333"
                fontWeight="bold"
              >
                {totalWidth}&apos;
              </text>
              <text
                x={toX(-3)}
                y={toY(totalDepth / 2)}
                textAnchor="middle"
                fontSize={12}
                fill="#333"
                fontWeight="bold"
                transform={`rotate(-90, ${toX(-3)}, ${toY(totalDepth / 2)})`}
              >
                {totalDepth}&apos;
              </text>
            </>
          )}

          {/* Title */}
          <text x={svgWidth / 2} y={20} textAnchor="middle" fontSize={14} fill="#333" fontWeight="bold">
            FLOOR PLAN — {floor.floor === 1 ? '1ST' : floor.floor === 2 ? '2ND' : `${floor.floor}TH`} FLOOR
          </text>
        </svg>
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 italic">{description}</p>
      )}

      {/* Room Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        {floor.rooms.map((room, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{
                backgroundColor: getRoomColor(room.type),
                borderColor: getRoomStroke(room.type),
              }}
            />
            {room.name}
          </div>
        ))}
      </div>
    </div>
  )
}
