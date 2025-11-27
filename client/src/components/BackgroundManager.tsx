import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Trash2, ImageOff } from 'lucide-react';
import wallpaperImage from '../assets/terminal-bg-new.png';

// Constants
const MAX_WALLPAPERS = 9; // Max custom wallpapers
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for each wallpaper

// --- IndexedDB Setup ---
const DB_NAME = 'terminal_wallpapers_db';
const STORE_NAME = 'wallpapers';
let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(`Database error: ${(event.target as IDBOpenDBRequest).error}`);
    };
  });
}

async function saveWallpaper(wallpaper: WallpaperData): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(wallpaper);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

async function getWallpapersFromDB(): Promise<WallpaperData[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result || []);
    };
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

async function deleteWallpaperFromDB(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

// --- Utility Functions ---
function getBase64Size(base64String: string): number {
  // Remove header and any potential padding
  const base64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  const byteLength = base64.length;
  // Calculate the actual size in bytes (approximate for base64)
  // Each 4 base64 chars represent 3 bytes.
  // We also need to account for potential padding '=' characters.
  let padding = 0;
  if (base64.endsWith('==')) {
    padding = 2;
  } else if (base64.endsWith('=')) {
    padding = 1;
  }
  return Math.ceil((byteLength * 3) / 4) - padding;
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}

// --- Component Interfaces ---
interface BackgroundManagerProps {
  onClose: () => void;
  onBackgroundChange: (imageUrl: string) => void;
  hideDefaultBackground?: boolean;
  onDefaultBgToggle?: (hide: boolean) => void;
}

interface WallpaperData { // Renamed for clarity with DB
  id: string;
  url: string; // Base64 encoded
  name: string;
  timestamp: number; // For sorting or internal use
}

interface WallpaperSlot extends WallpaperData {
  isBuiltIn?: boolean;
}

export function BackgroundManager({ onClose, onBackgroundChange }: BackgroundManagerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [wallpapers, setWallpapers] = useState<WallpaperSlot[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Built-in wallpaper
  const builtInWallpaper: WallpaperSlot = {
    id: 'built-in-wallpaper',
    url: wallpaperImage,
    name: 'Default Terminal Background',
    isBuiltIn: true,
    timestamp: 0 // Not relevant for built-in
  };

  // Load wallpapers from IndexedDB and localStorage on mount
  useEffect(() => {
    async function loadWallpapers() {
      setIsLoading(true);
      try {
        const dbWallpapers = await getWallpapersFromDB();
        // Sort by timestamp, newest first
        dbWallpapers.sort((a, b) => b.timestamp - a.timestamp);

        // Load current background from localStorage
        const currentBg = localStorage.getItem('terminal-background-url');
        if (currentBg) {
          // Check if the current background is one of the loaded DB wallpapers or the built-in one
          const foundWallpaper = dbWallpapers.find(w => w.url === currentBg) || (currentBg === builtInWallpaper.url ? builtInWallpaper : null);
          if (foundWallpaper) {
            setSelectedWallpaper(currentBg);
          } else {
            // If the saved URL is no longer in DB or is not built-in, clear it
            localStorage.removeItem('terminal-background-url');
            setSelectedWallpaper('');
          }
        } else {
          setSelectedWallpaper('');
        }
        setWallpapers([builtInWallpaper, ...dbWallpapers]);
      } catch (error) {
        console.error('Failed to load wallpapers from DB:', error);
        // Fallback to localStorage if DB fails (though we're moving away from it)
        const stored = localStorage.getItem('terminal-wallpapers');
        let userWallpapers: WallpaperSlot[] = [];
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            userWallpapers = parsed.filter((w: WallpaperSlot) => !w.isBuiltIn);
            // Convert to WallpaperData for consistency if needed, or just use as is if structure matches
          } catch (e) {
            console.error('Failed to load wallpapers from localStorage:', e);
          }
        }
        // If DB load failed, use whatever was in localStorage as a fallback
        setWallpapers([builtInWallpaper, ...userWallpapers]);
        alert('Could not load wallpapers from database. Some features might be limited.');
      } finally {
        setIsLoading(false);
      }
    }
    loadWallpapers();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only');
      return;
    }

    const userWallpapers = wallpapers.filter(w => !w.isBuiltIn);
    const availableSlots = MAX_WALLPAPERS - userWallpapers.length;
    if (availableSlots === 0) {
      alert(`Maximum ${MAX_WALLPAPERS} custom wallpapers allowed. Please delete some to add new ones.`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;

        // Check file size
        const size = getBase64Size(imageUrl);
        if (size > MAX_FILE_SIZE) {
          alert(`File "${file.name}" is too large (${formatFileSize(size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
          return;
        }

        const newWallpaper: WallpaperData = {
          id: `wallpaper-${Date.now()}-${Math.random()}`,
          url: imageUrl,
          name: file.name,
          timestamp: Date.now()
        };

        try {
          // Save to IndexedDB
          await saveWallpaper(newWallpaper);

          // Update UI
          setWallpapers(prev => [...prev, newWallpaper]);
          console.log(`Wallpaper "${file.name}" saved successfully (${formatFileSize(size)})`);
        } catch (error) {
          console.error('Failed to save wallpaper:', error);
          alert(`Failed to save wallpaper "${file.name}". Storage may be full.`);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [wallpapers.length]); // Dependency on wallpapers.length to re-evaluate availableSlots

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }

    const userWallpapers = wallpapers.filter(w => !w.isBuiltIn);
    const availableSlots = MAX_WALLPAPERS - userWallpapers.length;
    if (availableSlots === 0) {
      alert(`Maximum ${MAX_WALLPAPERS} custom wallpapers allowed. Please delete some to add new ones.`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;

        // Check file size
        const size = getBase64Size(imageUrl);
        if (size > MAX_FILE_SIZE) {
          alert(`File "${file.name}" is too large (${formatFileSize(size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
          return;
        }

        const newWallpaper: WallpaperData = {
          id: `wallpaper-${Date.now()}-${Math.random()}`,
          url: imageUrl,
          name: file.name,
          timestamp: Date.now()
        };

        try {
          // Save to IndexedDB
          await saveWallpaper(newWallpaper);

          // Update UI
          setWallpapers(prev => [...prev, newWallpaper]);
          console.log(`Wallpaper "${file.name}" saved successfully (${formatFileSize(size)})`);
        } catch (error) {
          console.error('Failed to save wallpaper:', error);
          alert(`Failed to save wallpaper "${file.name}". Storage may be full.`);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const selectWallpaper = async (wallpaper: WallpaperSlot) => {
    console.log('Selecting wallpaper:', wallpaper.name);
    const imageUrl = wallpaper.url;

    // Update local state
    setSelectedWallpaper(imageUrl);

    // Save to localStorage
    try {
      localStorage.setItem('terminal-background-url', imageUrl);
      console.log('Saved to localStorage successfully');
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
      alert('Could not save selected wallpaper. Browser storage might be full.');
    }

    // Dispatch event to update background immediately
    const event = new CustomEvent('terminal-background-change', {
      detail: imageUrl,
      bubbles: true
    });
    window.dispatchEvent(event);
    console.log('Dispatched terminal-background-change event');

    // Call the callback
    onBackgroundChange(imageUrl);

    console.log('Wallpaper set successfully, URL preview:', imageUrl.substring(0, 100) + '...');
  };

  const deleteWallpaper = async (id: string) => {
    const wallpaperToDelete = wallpapers.find(w => w.id === id);
    if (!wallpaperToDelete) return;

    // Prevent deleting built-in wallpaper
    if (wallpaperToDelete.isBuiltIn) {
      return;
    }

    try {
      // Delete from IndexedDB first
      await deleteWallpaperFromDB(id);

      // Update UI
      setWallpapers(prev => {
        const updated = prev.filter(w => w.id !== id);

        // If we deleted the currently selected wallpaper, clear the background
        if (wallpaperToDelete.url === selectedWallpaper) {
          setSelectedWallpaper('');
          localStorage.removeItem('terminal-background-url');
          onBackgroundChange('');

          // Dispatch event to clear background immediately
          const event = new CustomEvent('terminal-background-change', {
            detail: '',
            bubbles: true
          });
          window.dispatchEvent(event);
        }
        return updated;
      });
      console.log(`Wallpaper "${wallpaperToDelete.name}" deleted successfully.`);
    } catch (error) {
      console.error('Failed to delete wallpaper:', error);
      alert(`Failed to delete wallpaper "${wallpaperToDelete.name}".`);
    }
  };

  const clearBackground = () => {
    setSelectedWallpaper('');
    localStorage.removeItem('terminal-background-url');

    // Dispatch event to clear background immediately
    const event = new CustomEvent('terminal-background-change', {
      detail: '',
      bubbles: true
    });
    window.dispatchEvent(event);

    onBackgroundChange('');
    console.log('Background cleared');
  };

  // Filter out the built-in wallpaper for display in the grid
  const customWallpapers = wallpapers.filter(w => !w.isBuiltIn);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className="border rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--terminal-bg)',
          borderColor: 'var(--terminal-highlight)'
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--terminal-text)' }}>
            Terminal Background Manager
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-2xl"
            style={{ color: 'var(--terminal-text)' }}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Upload Area */}
        <div
          className="border-2 border-dashed rounded-lg p-8 mb-6 text-center transition-colors"
          style={dragOver ? {
            borderColor: 'var(--terminal-highlight)',
            backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.1)'
          } : {
            borderColor: 'var(--terminal-subtle)'
          }}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
        >
          <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--terminal-highlight)' }} />
          <p className="text-lg mb-2" style={{ color: 'var(--terminal-text)' }}>
            Drag & Drop Images Here
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--terminal-subtle)' }}>
            or
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="wallpaper-file-input"
          />
          <Button
            onClick={() => document.getElementById('wallpaper-file-input')?.click()}
            size="sm"
            style={{
              backgroundColor: 'var(--terminal-highlight)',
              color: 'var(--terminal-bg)'
            }}
          >
            Browse Files
          </Button>
          <p className="text-xs mt-4" style={{ color: 'var(--terminal-subtle)' }}>
            {customWallpapers.length}/{MAX_WALLPAPERS} custom slots used (1 built-in included)
          </p>
        </div>

        {/* Custom Background Status and Remove Option */}
        <div className="mb-6 p-4 rounded-lg" style={{
          backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.1)',
          border: '1px solid var(--terminal-subtle)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: selectedWallpaper ? 'var(--terminal-highlight)' : 'var(--terminal-subtle)'
                }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terminal-text)' }}>
                  Custom Background
                </p>
                <p className="text-xs" style={{ color: 'var(--terminal-subtle)' }}>
                  {selectedWallpaper ? 'Active - using uploaded wallpaper' : 'None selected'}
                </p>
              </div>
            </div>
            <Button
              onClick={clearBackground}
              size="sm"
              variant="outline"
              className="flex items-center gap-2 hover:bg-red-500/20"
              style={{
                borderColor: '#ef4444',
                color: '#ef4444'
              }}
              data-testid="button-remove-background"
            >
              <ImageOff className="w-4 h-4" />
              Remove Custom
            </Button>
          </div>
        </div>

        {/* Wallpaper Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--terminal-text)' }}>
            Wallpaper Library
          </h3>

          {isLoading ? (
            <p className="text-center py-8" style={{ color: 'var(--terminal-subtle)' }}>Loading wallpapers...</p>
          ) : customWallpapers.length === 0 && wallpapers.length === 1 ? ( // Only built-in is present
            <p className="text-center py-8" style={{ color: 'var(--terminal-subtle)' }}>
              No wallpapers uploaded yet. Drop some images above to get started!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Render built-in first if it's not hidden, then custom */}
              {!builtInWallpaper.isBuiltIn && ( // Example condition, adjust if hideDefaultBackground is used
                <div
                  key={builtInWallpaper.id}
                  className="relative group cursor-pointer"
                  onClick={() => selectWallpaper(builtInWallpaper)}
                  style={{
                    border: selectedWallpaper === builtInWallpaper.url ? '2px solid var(--terminal-highlight)' : '1px solid var(--terminal-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}
                  data-testid={`wallpaper-slot-${builtInWallpaper.id}`}
                >
                  <div
                    className="aspect-video bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${builtInWallpaper.url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  <div
                    className="p-2 text-xs truncate"
                    style={{
                      backgroundColor: 'var(--terminal-bg)',
                      color: 'var(--terminal-text)'
                    }}
                  >
                    {builtInWallpaper.name}
                  </div>
                  {selectedWallpaper === builtInWallpaper.url && (
                    <div
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--terminal-highlight)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--terminal-bg)' }}>✓</span>
                    </div>
                  )}
                </div>
              )}

              {customWallpapers.map((wallpaper) => (
                <div
                  key={wallpaper.id}
                  className="relative group cursor-pointer"
                  onClick={() => selectWallpaper(wallpaper)}
                  style={{
                    border: selectedWallpaper === wallpaper.url ? '2px solid var(--terminal-highlight)' : '1px solid var(--terminal-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}
                  data-testid={`wallpaper-slot-${wallpaper.id}`}
                >
                  <div
                    className="aspect-video bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${wallpaper.url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />

                  {/* Delete button - positioned in corner, doesn't block clicks - hidden for built-in */}
                  {!wallpaper.isBuiltIn && (
                    <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteWallpaper(wallpaper.id);
                        }}
                        size="sm"
                        variant="destructive"
                        className="bg-red-600 hover:bg-red-700 w-6 h-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Built-in badge - not needed as we explicitly render built-in slot */}
                  {/* {wallpaper.isBuiltIn && ( ... )} */}

                  {/* Name label */}
                  <div
                    className="p-2 text-xs truncate"
                    style={{
                      backgroundColor: 'var(--terminal-bg)',
                      color: 'var(--terminal-text)'
                    }}
                  >
                    {wallpaper.name}
                  </div>

                  {/* Selected indicator */}
                  {selectedWallpaper === wallpaper.url && (
                    <div
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--terminal-highlight)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--terminal-bg)' }}>✓</span>
                    </div>
                  )}

                  {/* Click-to-select overlay hint */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to select</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 rounded" style={{ backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.2)' }}>
          <p className="text-sm" style={{ color: 'var(--terminal-text)' }}>
            <strong>Tips:</strong>
          </p>
          <ul className="text-sm mt-2 space-y-1" style={{ color: 'var(--terminal-subtle)' }}>
            <li>• Upload up to {MAX_WALLPAPERS} custom wallpapers (1 built-in included for total of {MAX_WALLPAPERS + 1})</li>
            <li>• Click a wallpaper to set it as your terminal background</li>
            <li>• Images automatically fit to screen while maintaining aspect ratio</li>
            <li>• Hover over custom wallpapers and click trash icon to delete</li>
            <li>• Your wallpapers are saved in browser storage (IndexedDB)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}