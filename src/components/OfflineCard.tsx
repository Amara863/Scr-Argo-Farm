// import React from "react";

// const OfflineCard: React.FC<{ message?: string }> = ({
//   message = "Connection lost. Check your internet and try again.",
// }) => {
//   return (
//     <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md text-center">

//       <div className="mx-auto w-32 h-32 flex items-center justify-center mb-4">
//         {/* Playful toon-style SVG for offline state */}
//         <svg viewBox="0 0 120 120" fill="Connection lost" xmlns="https://www.vecteezy.com/free-vector/connection-lost" className="w-full h-full">
//           <circle cx="60" cy="60" r="56" fill="#FDF6B2" stroke="#FBBF24" strokeWidth="4" />
//           {/* Cloud */}
//           <ellipse cx="60" cy="80" rx="32" ry="14" fill="#E0E7FF" />
//           <ellipse cx="45" cy="75" rx="12" ry="8" fill="#C7D2FE" />
//           <ellipse cx="75" cy="77" rx="10" ry="7" fill="#C7D2FE" />
//           {/* Sad face */}
//           <ellipse cx="60" cy="60" rx="22" ry="18" fill="#FFF" />
//           <ellipse cx="52" cy="58" rx="2.5" ry="3.5" fill="#A5B4FC" />
//           <ellipse cx="68" cy="58" rx="2.5" ry="3.5" fill="#A5B4FC" />
//           <path d="M54 68 Q60 72 66 68" stroke="#F87171" strokeWidth="2.5" strokeLinecap="round" fill="none" />
//           {/* Broken wifi */}
//           <path d="M60 90 Q70 85 80 90" stroke="#F87171" strokeWidth="3" strokeLinecap="round" fill="none" />
//           <path d="M60 90 Q50 85 40 90" stroke="#F87171" strokeWidth="3" strokeLinecap="round" fill="none" />
//           <circle cx="60" cy="94" r="2.5" fill="#F87171" />
//           {/* Toon effect: little spark */}
//           <circle cx="30" cy="40" r="2" fill="#FBBF24" />
//           <circle cx="90" cy="30" r="1.5" fill="#FBBF24" />
//           <circle cx="100" cy="60" r="1.5" fill="#FBBF24" />
//         </svg>
//       </div>

//       <h3 className="text-lg font-semibold mb-2">Connection Lost</h3>
//       <p className="text-sm text-gray-600">{message}</p>
//     </div>
//   );
// };

// export default OfflineCard;


import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";

const OfflineCard: React.FC<{ message?: string }> = ({
  message = "It looks like you've lost your internet connection.",
}) => {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 relative overflow-hidden">
          {/* Decorative gradient blobs */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-blue-200/30 to-purple-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-gradient-to-br from-pink-200/30 to-orange-200/30 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

          {/* Content */}
          <div className="relative z-10">
            {/* Illustration Container */}
            <div className="flex justify-center mb-6 md:mb-8">
              <div className="relative scale-75 md:scale-100">
                {/* Two people holding puzzle pieces with WiFi in middle */}
                <div className="flex items-center justify-center gap-2 md:gap-4">
                  {/* Left Person */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full mb-1 md:mb-2 relative">
                      <div className="absolute top-1 md:top-2 left-1/2 -translate-x-1/2 w-6 h-4 md:w-8 md:h-6 bg-amber-700 rounded-full"></div>
                    </div>
                    <div className="w-14 h-16 md:w-20 md:h-24 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-t-3xl"></div>
                    <div className="w-14 h-20 md:w-20 md:h-32 bg-gradient-to-br from-blue-400 to-blue-500 rounded-b-3xl"></div>
                    <div className="flex gap-1 md:gap-2 -mt-3 md:-mt-4">
                      <div className="w-6 h-12 md:w-8 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
                      <div className="w-6 h-12 md:w-8 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
                    </div>
                  </div>

                  {/* WiFi Symbol in Middle */}
                  <div className="relative mx-4 md:mx-8">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center relative shadow-lg">
                      <WifiOff className="w-8 h-8 md:w-12 md:h-12 text-red-500" strokeWidth={2.5} />
                      <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                        <span className="text-white text-sm md:text-xl font-bold">!</span>
                      </div>
                    </div>
                    {/* WiFi waves (broken) */}
                    <div className="absolute -top-6 md:-top-8 left-1/2 -translate-x-1/2">
                      <div className="w-12 h-2 md:w-16 md:h-3 border-t-4 border-gray-300 rounded-full opacity-50"></div>
                      <div className="w-8 h-1 md:w-12 md:h-2 border-t-4 border-gray-300 rounded-full opacity-50 mt-1 md:mt-2 ml-2"></div>
                    </div>
                  </div>

                  {/* Right Person */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-red-400 to-red-500 rounded-full mb-1 md:mb-2 relative">
                      <div className="absolute top-1 md:top-2 left-1/2 -translate-x-1/2 w-6 h-4 md:w-8 md:h-6 bg-amber-800 rounded-full"></div>
                    </div>
                    <div className="w-14 h-16 md:w-20 md:h-24 bg-gradient-to-br from-red-300 to-red-400 rounded-t-3xl"></div>
                    <div className="w-14 h-20 md:w-20 md:h-32 bg-gradient-to-br from-blue-400 to-blue-500 rounded-b-3xl"></div>
                    <div className="flex gap-1 md:gap-2 -mt-3 md:-mt-4">
                      <div className="w-6 h-12 md:w-8 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
                      <div className="w-6 h-12 md:w-8 md:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Decorative grass */}
                <div className="flex justify-between mt-2 md:mt-4 px-2 md:px-4">
                  <div className="w-8 h-2 md:w-12 md:h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full"></div>
                  <div className="w-8 h-2 md:w-12 md:h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Text Content */}
            <div className="text-center space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Connection Lost
              </h1>
              
              <p className="text-gray-600 text-lg md:text-xl">
                {message}
              </p>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-sm text-gray-700">
                  <strong>What you can try:</strong>
                </p>
                <ul className="text-sm text-gray-600 mt-2 space-y-1 text-left list-disc list-inside">
                  <li>Check if your WiFi or mobile data is turned on</li>
                  <li>Move closer to your router for better signal</li>
                  <li>Restart your router or modem</li>
                  <li>Check if other devices can connect to the internet</li>
                </ul>
              </div>

              {/* Action Button */}
              <button
                onClick={handleRetry}
                className="mt-6 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 mx-auto group"
              >
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                Try Again
              </button>

              <p className="text-xs text-gray-400 mt-4">
                Still having trouble? Contact your internet service provider
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfflineCard;