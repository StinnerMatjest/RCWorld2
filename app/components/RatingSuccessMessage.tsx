import React, {useEffect} from 'react'

interface SuccessMessageProps {
    message: string;
    onClose: () => void;
  }

const RatingSuccessMessage: React.FC<SuccessMessageProps> = ({ message, onClose }) => {
    useEffect(() => {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }, [message, onClose]);
  
    return (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50">
        {message}
      </div>
    );
  };

export default RatingSuccessMessage