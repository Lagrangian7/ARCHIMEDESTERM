import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Trash2, ImageOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { Wallpaper } from '@shared/schema';

const MAX_WALLPAPERS = 20;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

// --- IndexedDB Setup (fallback for unauthenticated users) ---
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

interface LocalWallpaperData {
  id: string;
  url: string;
  name: string;
  timestamp: number;
}

async function saveWallpaperToLocalDB(wallpaper: LocalWallpaperData): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(wallpaper);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject((event.target as IDBRequest).error);
  });
}

async function getWallpapersFromLocalDB(): Promise<LocalWallpaperData[]> {
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

async function deleteWallpaperFromLocalDB(id: string): Promise<void> {
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
  const base64 = base64String.replace(/^data:image\/\w+;base64,/, '');
  const byteLength = base64.length;
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

interface WallpaperSlot {
  id: string;
  url: string;
  name: string;
  timestamp: number;
  isSelected?: boolean;
  isBuiltIn?: boolean;
}

export function BackgroundManager({ onClose, onBackgroundChange }: BackgroundManagerProps) {
  const { isAuthenticated } = useAuth();
  const [dragOver, setDragOver] = useState(false);
  const [localWallpapers, setLocalWallpapers] = useState<WallpaperSlot[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('');
  const [isLocalLoading, setIsLocalLoading] = useState(true);

  // Server wallpapers query (only for authenticated users)
  const { data: serverWallpapers = [], isLoading: isServerLoading } = useQuery<Wallpaper[]>({
    queryKey: ['/api/wallpapers'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Create wallpaper mutation
  const createWallpaperMutation = useMutation({
    mutationFn: async (data: { name: string; dataUrl: string }) => {
      const response = await apiRequest('POST', '/api/wallpapers', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallpapers'] });
    },
  });

  // Delete wallpaper mutation
  const deleteWallpaperMutation = useMutation({
    mutationFn: async (wallpaperId: string) => {
      const response = await apiRequest('DELETE', `/api/wallpapers/${wallpaperId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallpapers'] });
    },
  });

  // Select wallpaper mutation
  const selectWallpaperMutation = useMutation({
    mutationFn: async (wallpaperId: string) => {
      const response = await apiRequest('POST', `/api/wallpapers/${wallpaperId}/select`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallpapers'] });
    },
  });

  // Clear selection mutation
  const clearSelectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/wallpapers/clear-selection');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/wallpapers'] });
    },
  });

  // Convert server wallpapers to display format
  const wallpapers: WallpaperSlot[] = isAuthenticated
    ? serverWallpapers.map(w => ({
        id: w.id,
        url: w.dataUrl || '',
        name: w.name,
        timestamp: new Date(w.timestamp).getTime(),
        isSelected: w.isSelected,
      }))
    : localWallpapers;

  const isLoading = isAuthenticated ? isServerLoading : isLocalLoading;

  // Load local wallpapers for unauthenticated users
  useEffect(() => {
    if (isAuthenticated) {
      setIsLocalLoading(false);
      return;
    }

    async function loadLocalWallpapers() {
      setIsLocalLoading(true);
      try {
        const dbWallpapers = await getWallpapersFromLocalDB();
        dbWallpapers.sort((a, b) => b.timestamp - a.timestamp);
        setLocalWallpapers(dbWallpapers);
      } catch (error) {
        console.error('Failed to load local wallpapers:', error);
      } finally {
        setIsLocalLoading(false);
      }
    }
    loadLocalWallpapers();
  }, [isAuthenticated]);

  // Sync selected wallpaper from server or localStorage
  useEffect(() => {
    if (isAuthenticated) {
      const selected = serverWallpapers.find(w => w.isSelected);
      if (selected?.dataUrl) {
        setSelectedWallpaper(selected.dataUrl);
        localStorage.setItem('terminal-background-url', selected.dataUrl);
      } else {
        const storedBg = localStorage.getItem('terminal-background-url');
        setSelectedWallpaper(storedBg || '');
      }
    } else {
      const storedBg = localStorage.getItem('terminal-background-url');
      setSelectedWallpaper(storedBg || '');
    }
  }, [isAuthenticated, serverWallpapers]);

  const processFile = useCallback(async (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;

        const size = getBase64Size(imageUrl);
        if (size > MAX_FILE_SIZE) {
          alert(`File "${file.name}" is too large (${formatFileSize(size)}). Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
          reject(new Error('File too large'));
          return;
        }

        try {
          if (isAuthenticated) {
            await createWallpaperMutation.mutateAsync({
              name: file.name,
              dataUrl: imageUrl,
            });
          } else {
            const newWallpaper: LocalWallpaperData = {
              id: `wallpaper-${Date.now()}-${Math.random()}`,
              url: imageUrl,
              name: file.name,
              timestamp: Date.now()
            };
            await saveWallpaperToLocalDB(newWallpaper);
            setLocalWallpapers(prev => [newWallpaper, ...prev]);
          }
          console.log(`Wallpaper "${file.name}" saved successfully (${formatFileSize(size)})`);
          resolve();
        } catch (error) {
          console.error('Failed to save wallpaper:', error);
          alert(`Failed to save wallpaper "${file.name}". Please try again.`);
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, [isAuthenticated, createWallpaperMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only');
      return;
    }

    const availableSlots = MAX_WALLPAPERS - wallpapers.length;
    if (availableSlots === 0) {
      alert(`Maximum ${MAX_WALLPAPERS} wallpapers allowed. Please delete some to add new ones.`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);
    filesToAdd.forEach(file => processFile(file));
  }, [wallpapers.length, processFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }

    const availableSlots = MAX_WALLPAPERS - wallpapers.length;
    if (availableSlots === 0) {
      alert(`Maximum ${MAX_WALLPAPERS} wallpapers allowed. Please delete some to add new ones.`);
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);
    filesToAdd.forEach(file => processFile(file));
    e.target.value = '';
  };

  const selectWallpaper = async (wallpaper: WallpaperSlot) => {
    console.log('Selecting wallpaper:', wallpaper.name);
    const imageUrl = wallpaper.url;

    setSelectedWallpaper(imageUrl);
    localStorage.setItem('terminal-background-url', imageUrl);

    if (isAuthenticated) {
      try {
        await selectWallpaperMutation.mutateAsync(wallpaper.id);
      } catch (error) {
        console.error('Failed to save selection to server:', error);
      }
    }

    const event = new CustomEvent('terminal-background-change', {
      detail: imageUrl,
      bubbles: true
    });
    window.dispatchEvent(event);
    onBackgroundChange(imageUrl);
  };

  const deleteWallpaper = async (id: string) => {
    const wallpaperToDelete = wallpapers.find(w => w.id === id);
    if (!wallpaperToDelete || wallpaperToDelete.isBuiltIn) return;

    try {
      if (isAuthenticated) {
        await deleteWallpaperMutation.mutateAsync(id);
      } else {
        await deleteWallpaperFromLocalDB(id);
        setLocalWallpapers(prev => prev.filter(w => w.id !== id));
      }

      if (wallpaperToDelete.url === selectedWallpaper) {
        setSelectedWallpaper('');
        localStorage.removeItem('terminal-background-url');
        onBackgroundChange('');

        const event = new CustomEvent('terminal-background-change', {
          detail: '',
          bubbles: true
        });
        window.dispatchEvent(event);
      }
      console.log(`Wallpaper "${wallpaperToDelete.name}" deleted successfully.`);
    } catch (error) {
      console.error('Failed to delete wallpaper:', error);
      alert(`Failed to delete wallpaper "${wallpaperToDelete.name}".`);
    }
  };

  const clearBackground = async () => {
    setSelectedWallpaper('');
    localStorage.removeItem('terminal-background-url');

    if (isAuthenticated) {
      try {
        await clearSelectionMutation.mutateAsync();
      } catch (error) {
        console.error('Failed to clear selection on server:', error);
      }
    }

    const event = new CustomEvent('terminal-background-change', {
      detail: '',
      bubbles: true
    });
    window.dispatchEvent(event);
    onBackgroundChange('');
    console.log('Background cleared');
  };

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

        {/* Auth status indicator */}
        {!isAuthenticated && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255, 200, 0, 0.1)', border: '1px solid rgba(255, 200, 0, 0.3)' }}>
            <p className="text-sm" style={{ color: 'var(--terminal-text)' }}>
              Log in to save your wallpapers permanently across devices and sessions.
            </p>
          </div>
        )}

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
            disabled={createWallpaperMutation.isPending}
          >
            {createWallpaperMutation.isPending ? 'Uploading...' : 'Browse Files'}
          </Button>
          <p className="text-xs mt-4" style={{ color: 'var(--terminal-subtle)' }}>
            {wallpapers.length}/{MAX_WALLPAPERS} wallpapers uploaded
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
              disabled={clearSelectionMutation.isPending}
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
          ) : wallpapers.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--terminal-subtle)' }}>
              No wallpapers uploaded yet. Drop some images above to get started!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {wallpapers.map((wallpaper) => (
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
                        disabled={deleteWallpaperMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  <div
                    className="p-2 text-xs truncate"
                    style={{
                      backgroundColor: 'var(--terminal-bg)',
                      color: 'var(--terminal-text)'
                    }}
                  >
                    {wallpaper.name}
                  </div>

                  {selectedWallpaper === wallpaper.url && (
                    <div
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--terminal-highlight)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--terminal-bg)' }}>✓</span>
                    </div>
                  )}

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
            <li>• Upload up to {MAX_WALLPAPERS} wallpapers</li>
            <li>• Click a wallpaper to set it as your terminal background</li>
            <li>• Images automatically fit to screen while maintaining aspect ratio</li>
            <li>• Hover over wallpapers and click trash icon to delete</li>
            {isAuthenticated ? (
              <li>• Your wallpapers are saved to your account and sync across devices</li>
            ) : (
              <li>• Log in to save wallpapers permanently across sessions</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
