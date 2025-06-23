import React, { useState, useCallback } from "react";
import { AddStartupWithAIModal } from "./AddStartupWithAIModal";

interface AIModalWrapperProps {
  trigger: React.ReactNode;
}

export function AIModalWrapper({ trigger }: AIModalWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    console.log('Opening AI Modal');
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    console.log('Closing AI Modal');
    setIsOpen(false);
  }, []);

  return (
    <>
      <div onClick={handleOpen}>
        {trigger}
      </div>
      <AddStartupWithAIModal 
        open={isOpen} 
        onClose={handleClose} 
      />
    </>
  );
}