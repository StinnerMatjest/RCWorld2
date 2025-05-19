import React from 'react'

const page = () => {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">About</h1>
      <p className="text-lg mb-4">
        This project is a community-driven theme park and roller coaster review system. 
        Users can browse parks, view coaster lineups, and submit detailed ratings based on their experience.
      </p>
      <p className="text-lg">
        Built with Next.js, PostgreSQL, and Cloudflare R2, it aims to provide a clean and fast user experience 
        for thrill-seekers and park enthusiasts alike.
      </p>
    </main>
  );
}

export default page