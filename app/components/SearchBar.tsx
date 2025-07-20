import React, { useRef, useEffect, useState } from "react";
import { useSearch } from "../context/SearchContext";

const SearchBar = () => {
  const { query, setQuery } = useSearch();
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleIconClick = () => {
    setIsVisible(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      {isVisible ? (
        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm px-3 py-1 w-[180px] focus-within:ring-2 focus-within:ring-[#1e3a8a] transition">
          <input
            ref={inputRef}
            type="text"
            className="bg-transparent w-full text-sm focus:outline-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-800 dark:text-white"
            placeholder="Search"
            value={query}
            onChange={handleInputChange}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-2"
          >
            <path
              fillRule="evenodd"
              d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ) : (
        <button
          onClick={handleIconClick}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="h-5 w-5 text-gray-600 dark:text-gray-300"
          >
            <path
              fillRule="evenodd"
              d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;
