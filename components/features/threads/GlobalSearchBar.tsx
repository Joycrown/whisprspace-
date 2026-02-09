import React, { useEffect, useState } from 'react';
import { useThreadStore } from '@/store/threadStore';
import { SearchBar } from './ThreadSearchBar';

const GlobalSearchBar: React.FC = () => {
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
    <SearchBar 
      placeholder="Search all threads..." 
      searchQuery={inputValue} 
      setSearchQuery={setInputValue} 
    />
  );
};

export default GlobalSearchBar;




