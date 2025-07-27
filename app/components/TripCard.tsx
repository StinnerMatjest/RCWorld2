'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getParkFlag } from '@/app/utils/design'

export type Trip = {
  country: string | string[]
  parks: string[]
  rcdb?: string[]
  startDate: string
  endDate: string
  status: 'booked' | 'planned' | 'past'
  notes?: string
  mapLink?: string
  tripLog?: { date: string; activity: string }[]
}

const getCardStyle = (status: Trip['status']) => {
  if (status === 'past') return 'bg-gray-50 border-gray-200'
  if (status === 'booked') return 'bg-green-50 border-green-400'
  return 'bg-yellow-50 border-yellow-300'
}

const getDateRangeLabel = (start: string, end: string) => {
  if (start === 'undecided' || end === 'undecided') {
    return 'Dates TBD'
  }

  const locale = 'da-DK'

  const from = new Date(start).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const to = new Date(end).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `${from} – ${to}`
}


const getDurationSummary = (start: string, end: string, parkCount: number) => {
  if (start === 'undecided' || end === 'undecided') {
    return `📍 ${parkCount} ${parkCount === 1 ? 'park' : 'parks'} · TBD`
  }

  const dayMs = 1000 * 60 * 60 * 24
  const from = new Date(start)
  const to = new Date(end)
  const days = Math.round((to.getTime() - from.getTime()) / dayMs) + 1
  return `📍 ${parkCount} ${parkCount === 1 ? 'park' : 'parks'} · ${days} ${days === 1 ? 'day' : 'days'}`
}

export default function TripCard({ trip }: { trip: Trip }) {
  const [expanded, setExpanded] = useState(false)
  const parkCount = trip.parks.length
  const visibleParks = expanded ? trip.parks : trip.parks.slice(0, 2)

  return (
    <div
      onClick={() => setExpanded(prev => !prev)}
      className={`relative rounded-xl border p-5 cursor-pointer ${getCardStyle(trip.status)} transition-transform hover:scale-[1.01] hover:shadow-md animate-fade-in-up delay-0 w-full`}
    >
      {/* Status Badge */}
      <span
        className={`absolute -top-3 -left-3 px-3 py-1 text-xs font-bold rounded-full shadow-md ${
          trip.status === 'past'
            ? 'bg-gray-200 text-gray-800'
            : trip.status === 'booked'
            ? 'bg-green-500 text-white'
            : 'bg-yellow-400 text-black'
        }`}
      >
        {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
      </span>

      {/* Trip Summary Top Right */}
      <div className="absolute top-4 right-5 text-sm text-gray-600 font-medium">
        {getDurationSummary(trip.startDate, trip.endDate, parkCount)}
      </div>

      {/* Chevron */}
      <div
        className="absolute bottom-4 right-5 text-gray-700 text-sm transition-transform duration-300 ease-in-out"
        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
      >
        ▼
      </div>

      {/* Countries & Flags */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {Array.isArray(trip.country) ? (
          trip.country.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Image
                src={getParkFlag(c)}
                alt={`${c} flag`}
                width={24}
                height={18}
                className="rounded-sm object-cover"
              />
              <span className="text-2xl font-bold">{c}</span>
              {idx < trip.country.length - 1 && <span className="text-xl font-bold">+</span>}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2">
            <Image
              src={getParkFlag(trip.country)}
              alt={`${trip.country} flag`}
              width={24}
              height={18}
              className="rounded-sm object-cover"
            />
            <h4 className="text-2xl font-bold">{trip.country}</h4>
          </div>
        )}
      </div>

      {/* Park Links */}
      <ul className="list-disc list-inside text-gray-800 space-y-1 mb-3">
        {visibleParks.map((park, idx) => {
          const rcdbUrl = trip.rcdb?.[idx]
          return (
            <li key={idx}>
              {rcdbUrl ? (
                <a
                  href={rcdbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {park}
                </a>
              ) : (
                park
              )}
            </li>
          )
        })}
        {!expanded && trip.parks.length > 2 && (
          <li className="text-sm text-gray-600 italic">
            ...and {trip.parks.length - 2} more park{trip.parks.length - 2 > 1 ? 's' : ''}
          </li>
        )}
      </ul>

      {/* Date Range */}
      <p className="text-sm text-gray-600 flex items-center gap-1">
        📅 {getDateRangeLabel(trip.startDate, trip.endDate)}
      </p>

      {/* Expandable Section */}
      <div className={`expandable mt-4 ${expanded ? 'expanded' : 'collapsed'}`}>
        <div className="space-y-3">
          {trip.notes && (
            <p className="text-sm text-gray-700">
              📝 <span className="font-medium">Notes:</span> {trip.notes}
            </p>
          )}

          {trip.mapLink && (
            <a
              href={trip.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-600 text-sm hover:underline inline-block"
            >
              🗺️ View on Google Maps
            </a>
          )}

          {trip.tripLog?.length && (
            <div className="text-sm text-gray-800 space-y-1 pt-2">
              <p className="font-medium">📅 Trip Log:</p>
              {trip.tripLog.map((entry, i) => (
                <div key={i} className="pl-2">
                  - {new Date(entry.date).toLocaleDateString('da-DK')}: {entry.activity}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
