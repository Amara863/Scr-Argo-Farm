// import { createContext, useContext, useEffect, useState } from 'react';

// // Create Language Context
// const LanguageContext = createContext();

// // Translation service
// const translateText = async (text, targetLang) => {
//   if (targetLang === 'en') return text;
//   try {
//     const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
//     const data = await response.json();
//     return data.responseData.translatedText || text;
//   } catch (error) {
//     console.error('Translation error:', error);
//     return text;
//   }
// };

// // Language Provider Component
// export const LanguageProvider = ({ children }) => {
//   const [selectedLanguage, setSelectedLanguage] = useState('en');
//   const [isTranslating, setIsTranslating] = useState(false);

//   const languages = [
//     { code: 'en', name: 'English' },
//     { code: 'ta', name: 'தமிழ்' },
//     { code: 'te', name: 'తెలుగు' },
//     { code: 'hi', name: 'हिंदी' }
//   ];

//   // Translation cache to avoid re-translating same content
//   const translationCache = {};

//   const translateContent = async (content, targetLang) => {
//     if (targetLang === 'en') return content;
//     const cacheKey = `${content}_${targetLang}`;
//     if (translationCache[cacheKey]) {
//       return translationCache[cacheKey];
//     }
//     try {
//       const translated = await translateText(content, targetLang);
//       translationCache[cacheKey] = translated;
//       return translated;
//     } catch (error) {
//       console.error('Translation error:', error);
//       return content;
//     }
//   };

//   const changeLanguage = async (languageCode) => {
//     setIsTranslating(true);
//     setSelectedLanguage(languageCode);
//     setIsTranslating(false);
//   };

//   const t = async (text) => {
//     if (selectedLanguage === 'en') return text;
//     return await translateContent(text, selectedLanguage);
//   };

//   // Hook for components to get translated text
//   const useTranslation = (text) => {
//     const [translatedText, setTranslatedText] = useState(text);

//     useEffect(() => {
//       const getTranslation = async () => {
//         if (selectedLanguage === 'en') {
//           setTranslatedText(text);
//         } else {
//           const translated = await translateContent(text, selectedLanguage);
//           setTranslatedText(translated);
//         }
//       };
//       getTranslation();
//     }, [text, selectedLanguage]);

//     return translatedText;
//   };

//   const value = {
//     selectedLanguage,
//     changeLanguage,
//     isTranslating,
//     languages,
//     t,
//     useTranslation,
//     translateContent
//   };

//   return (
//     <LanguageContext.Provider value={value}>
//       {children}
//     </LanguageContext.Provider>
//   );
// };

// // Custom hook to use language context
// export const useLanguage = () => {
//   const context = useContext(LanguageContext);
//   if (!context) {
//     throw new Error('useLanguage must be used within a LanguageProvider');
//   }
//   return context;
// };


import { createContext, useContext, useEffect, useState } from 'react';

type LanguageContextValue = { selectedLanguage: string; changeLanguage: (languageCode: string) => Promise<void>; isTranslating: boolean; languages: { code: string; name: string }[]; useTranslation: (text: string) => { text: string; isLoading: boolean }; translateContent: (content: string, targetLang: string) => Promise<string> };

// Create Language Context
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

// Translation service
const translateText = async (text, targetLang) => {
  if (targetLang === 'en') return text;
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
    const data = await response.json();
    return data.responseData.translatedText || text;
  } catch (error) {
    console.error('Translation error:', error);
    return text;
  }
};

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [isTranslating, setIsTranslating] = useState(false);
  
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'hi', name: 'हिंदी' }
  ];

  // Translation cache to avoid re-translating same content
  const [translationCache, setTranslationCache] = useState<Record<string, string>>({});

  const translateContent = async (content, targetLang) => {
    if (targetLang === 'en') return content;
    
    const cacheKey = `${content}_${targetLang}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    try {
      const translated = await translateText(content, targetLang);
      setTranslationCache(prev => ({
        ...prev,
        [cacheKey]: translated
      }));
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return content;
    }
  };

  const changeLanguage = async (languageCode) => {
    setIsTranslating(true);
    setSelectedLanguage(languageCode);
    // Small delay to show loading state
    setTimeout(() => {
      setIsTranslating(false);
    }, 500);
  };

  // Hook for components to get translated text
  const useTranslation = (text) => {
    const [translatedText, setTranslatedText] = useState(text);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      const getTranslation = async () => {
        if (selectedLanguage === 'en') {
          setTranslatedText(text);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        try {
          const translated = await translateContent(text, selectedLanguage);
          setTranslatedText(translated);
        } catch (error) {
          console.error('Translation failed:', error);
          setTranslatedText(text); // Fallback to original text
        } finally {
          setIsLoading(false);
        }
      };

      getTranslation();
    }, [text, selectedLanguage]);

    return { text: translatedText, isLoading };
  };

  const value = {
    selectedLanguage,
    changeLanguage,
    isTranslating,
    languages,
    useTranslation,
    translateContent
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
