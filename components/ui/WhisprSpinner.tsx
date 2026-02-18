import React from 'react';
import { motion } from 'framer-motion';

interface WhisprSpinnerProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

const WhisprSpinner: React.FC<WhisprSpinnerProps> = ({
  size = 40,
  className = '',
  showText = true
}) => {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer glowing ring */}
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500 border-r-orange-500 border-b-purple-500 border-l-orange-500 blur-[1px]"
        />

        {/* Inner spinning core */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 rounded-full border-2 border-white/20 border-t-white"
        />

        {/* Center Logo/Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1/3 h-1/3 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
        </div>
      </div>

      {showText && (
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-gray-400 text-sm font-medium tracking-wide"
        >
          Almost there...
        </motion.p>
      )}
    </div>
  );
};

export default WhisprSpinner;
