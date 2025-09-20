import { useState, useEffect, useCallback } from 'react';

interface EncodeDecodeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EncodeDecodeOverlay({ isOpen, onClose }: EncodeDecodeOverlayProps) {
  const [isEncoded, setIsEncoded] = useState(false);
  const [keyBuffer, setKeyBuffer] = useState('');

  // Function to encode text by shifting to high ASCII (offset by 128)
  const encodeText = useCallback((text: string) => {
    return text
      .split('')
      .map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode((code + 128) % 256);
      })
      .join('');
  }, []);

  // Function to decode text by reversing the shift
  const decodeText = useCallback((text: string) => {
    return text
      .split('')
      .map(char => {
        const code = char.charCodeAt(0);
        return String.fromCharCode((code - 128 + 256) % 256);
      })
      .join('');
  }, []);

  // Handle encoding all terminal text content
  const handleEncode = useCallback(() => {
    if (!isEncoded) {
      // Target all text content on the page
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(el => {
        // Walk through all text nodes
        const walker = document.createTreeWalker(
          el,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent && node.textContent.trim()) {
            textNodes.push(node);
          }
        }
        
        textNodes.forEach(textNode => {
          textNode.textContent = encodeText(textNode.textContent || '');
        });
      });
      
      setIsEncoded(true);
    }
  }, [isEncoded, encodeText]);

  // Handle decode when "qwerty" is typed
  const handleDecode = useCallback(() => {
    if (isEncoded) {
      // Decode all text content on the page
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(el => {
        // Walk through all text nodes
        const walker = document.createTreeWalker(
          el,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent && node.textContent.trim()) {
            textNodes.push(node);
          }
        }
        
        textNodes.forEach(textNode => {
          textNode.textContent = decodeText(textNode.textContent || '');
        });
      });
      
      setIsEncoded(false);
      setKeyBuffer('');
      onClose();
    }
  }, [isEncoded, decodeText, onClose]);

  // Auto-encode when component opens
  useEffect(() => {
    if (isOpen && !isEncoded) {
      handleEncode();
    }
  }, [isOpen, isEncoded, handleEncode]);

  // Listen for "qwerty" to be typed
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isEncoded) {
        // Add the typed character to buffer
        const newBuffer = (keyBuffer + e.key.toLowerCase()).slice(-6); // Keep only last 6 characters
        setKeyBuffer(newBuffer);
        
        // Check if "qwerty" was typed
        if (newBuffer === 'qwerty') {
          handleDecode();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [isOpen, isEncoded, keyBuffer, handleDecode]);

  // Component is invisible - just handles encoding/decoding
  if (!isOpen) return null;

  // Return null - component works invisibly in background
  return null;
}