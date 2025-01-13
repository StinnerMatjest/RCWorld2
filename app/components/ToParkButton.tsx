// components/ToParkButton.tsx
import React from 'react'
import Link from 'next/link'

// Add a prop for the rating ID
interface ToParkButtonProps {
  ratingId: number;
}

const ToParkButton: React.FC<ToParkButtonProps> = ({ ratingId }) => {
  return (
    <div className="card-actions">
      <Link href={`/park/${ratingId}`}>
        <button className="btn btn-primary">View Park</button>
      </Link>
    </div>
  )
}

export default ToParkButton
