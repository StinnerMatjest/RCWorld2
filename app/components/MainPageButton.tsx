import React from 'react'
import Link from 'next/link'

const MainPageButton = () => {
  return (
    <div className="card-actions">
      <Link href={`/`}>
        <button className="btn btn-primary">Home</button>
      </Link>
    </div>
  )
}

export default MainPageButton