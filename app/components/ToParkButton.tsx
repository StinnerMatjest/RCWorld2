import React from 'react'
import Link from 'next/link'

// parkId prop
interface ToParkButtonProps {
  parkId: number;
}

const ToParkButton: React.FC<ToParkButtonProps> = ({ parkId }) => {
  console.log("ToParkButton received parkId:", parkId);
  return (
    <div className="card-actions">
      <Link href={`/park/${parkId}`}>
        <button className="btn btn-primary">View Park</button>
      </Link>
    </div>
  )
}

export default ToParkButton
