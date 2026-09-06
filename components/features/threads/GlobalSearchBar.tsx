import React from 'react';
import { useThreadStore } from '@/store/threadStore';
import { SearchBar } from './ThreadSearchBar';

interface GlobalSearchBarProps {
  className?: string;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ className }) => {
  const searchQuery = useThreadStore((state) => state.searchQuery);
  const setSearchQuery = useThreadStore((state) => state.setSearchQuery);

  return (
    <div className={className}>
      <SearchBar
        placeholder="Search all discussions..."
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    </div>
  );
};

export default GlobalSearchBar;

