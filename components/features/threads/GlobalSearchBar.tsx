import React, { useEffect, useState } from 'react';
import { useThreadStore } from '@/store/threadStore';
import { SearchBar } from './ThreadSearchBar';

interface GlobalSearchBarProps {
  className?: string;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ className }) => {
  const { searchQuery, setSearchQuery } = useThreadStore();
  const [inputValue, setInputValue] = useState(searchQuery);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (inputValue !== searchQuery) {
        setSearchQuery(inputValue);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [inputValue, searchQuery, setSearchQuery]);

  return (
    <div className={className}>
      <SearchBar
        placeholder="Search all threads..."
        searchQuery={inputValue}
        setSearchQuery={setInputValue}
      />
    </div>
  );
};

export default GlobalSearchBar;




