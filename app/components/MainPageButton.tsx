import React from 'react'
import Link from 'next/link'

const MainPageButton = () => {
  return (
    <div className="card-actions">
      <Link href={`/`}>
        <button className="h-12 w-15 py-2 px-4 text-xl font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 cursor-pointer">
          Back
        </button>
      </Link>
    </div>
  )
}

export default MainPageButton