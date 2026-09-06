import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Language {
  code: string;
  name: string;
}

interface Props {
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  languages: Language[];
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
}

const LanguageSelector = ({
  selectedLanguage,
  setSelectedLanguage,
  languages,
  isDropdownOpen,
  setIsDropdownOpen
}: Props) => {
  const handleChange = (language: Language) => {
    setSelectedLanguage(language.name);
    setIsDropdownOpen(false);
    alert(`Language switched to ${language.name}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md hover:bg-orange-50 hover:text-red-600"
      >
        <Globe className="h-4 w-4" />
        <span>{selectedLanguage}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[120px] z-50">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleChange(language)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                selectedLanguage === language.name ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
            >
              {language.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
