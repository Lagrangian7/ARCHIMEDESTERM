
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Trash2, ImageOff, Eye, EyeOff } from 'lucide-react';

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
}

export function BackgroundManager({ onClose, onBackgroundChange, hideDefaultBackground: initialHideDefault, onDefaultBgToggle }: BackgroundManagerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [wallpapers, setWallpapers] = useState<WallpaperSlot[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('');
  const [isDefaultHidden, setIsDefaultHidden] = useState<boolean>(initialHideDefault || false);

  // Load wallpapers from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('terminal-wallpapers');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWallpapers(parsed);
      } catch (e) {
        console.error('Failed to load wallpapers:', e);
      }
    }

    const currentBg = localStorage.getItem('terminal-background-url');
    if (currentBg) {
      setSelectedWallpaper(currentBg);
    }
  }, []);

  // Sync isDefaultHidden with prop when it changes (e.g., when manager reopens)
  useEffect(() => {
    const storedValue = localStorage.getItem('terminal-hide-default-bg') === 'true';
    // Use prop if available, otherwise fall back to localStorage
    setIsDefaultHidden(initialHideDefault !== undefined ? initialHideDefault : storedValue);
  }, [initialHideDefault]);

  // Save wallpapers to localStorage whenever they change
  useEffect(() => {
    if (wallpapers.length > 0) {
      localStorage.setItem('terminal-wallpapers', JSON.stringify(wallpapers));
    }
  }, [wallpapers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only');
      return;
    }

    // Limit to 10 wallpapers
    const availableSlots = 10 - wallpapers.length;
    if (availableSlots === 0) {
      alert('Maximum 10 wallpapers allowed. Please delete some to add new ones.');
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        const newWallpaper: WallpaperSlot = {
          id: `wallpaper-${Date.now()}-${Math.random()}`,
          url: imageUrl,
          name: file.name
        };

        setWallpapers(prev => [...prev, newWallpaper]);
      };
      reader.readAsDataURL(file);
    });
  }, [wallpapers.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please select image files only');
      return;
    }

    const availableSlots = 10 - wallpapers.length;
    if (availableSlots === 0) {
      alert('Maximum 10 wallpapers allowed. Please delete some to add new ones.');
      return;
    }

    const filesToAdd = imageFiles.slice(0, availableSlots);

    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        const newWallpaper: WallpaperSlot = {
          id: `wallpaper-${Date.now()}-${Math.random()}`,
          url: imageUrl,
          name: file.name
        };

        setWallpapers(prev => [...prev, newWallpaper]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const selectWallpaper = (wallpaper: WallpaperSlot) => {
    console.log('Selecting wallpaper:', wallpaper.name);
    
    // Use the original URL (data URLs don't need cache busting)
    const imageUrl = wallpaper.url;
    
    // Update local state
    setSelectedWallpaper(imageUrl);
    
    // Save to localStorage (without cache busting for data URLs)
    localStorage.setItem('terminal-background-url', imageUrl);
    
    // Dispatch event to update background immediately
    const event = new CustomEvent('terminal-background-change', { 
      detail: imageUrl,
      bubbles: true 
    });
    window.dispatchEvent(event);
    
    // Call the callback
    onBackgroundChange(imageUrl);
    
    console.log('Wallpaper set successfully');
  };

  const deleteWallpaper = (id: string) => {
    setWallpapers(prev => {
      const updated = prev.filter(w => w.id !== id);
      
      // If we deleted the current wallpaper, clear the background
      const deletedWallpaper = prev.find(w => w.id === id);
      if (deletedWallpaper && deletedWallpaper.url === selectedWallpaper) {
        setSelectedWallpaper('');
        localStorage.removeItem('terminal-background-url');
        onBackgroundChange('');
      }

      // Update localStorage
      if (updated.length === 0) {
        localStorage.removeItem('terminal-wallpapers');
      }

      return updated;
    });
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

  const toggleDefaultBackground = () => {
    const newState = !isDefaultHidden;
    setIsDefaultHidden(newState);
    localStorage.setItem('terminal-hide-default-bg', String(newState));
    
    // Dispatch event to update Terminal immediately
    const event = new CustomEvent('terminal-default-bg-toggle', { 
      detail: newState,
      bubbles: true 
    });
    window.dispatchEvent(event);
    
    if (onDefaultBgToggle) {
      onDefaultBgToggle(newState);
    }
    
    console.log('Default background:', newState ? 'hidden' : 'visible');
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
            {wallpapers.length}/10 slots used
          </p>
        </div>

        {/* Default Theme Background Toggle */}
        <div className="mb-4 p-4 rounded-lg" style={{ 
          backgroundColor: 'rgba(var(--terminal-subtle-rgb), 0.1)',
          border: '1px solid var(--terminal-subtle)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ 
                  backgroundColor: isDefaultHidden ? 'var(--terminal-subtle)' : 'var(--terminal-highlight)'
                }}
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--terminal-text)' }}>
                  Default Theme Background
                </p>
                <p className="text-xs" style={{ color: 'var(--terminal-subtle)' }}>
                  {isDefaultHidden ? 'Hidden - showing solid color' : 'Visible - showing theme wallpaper'}
                </p>
              </div>
            </div>
            <Button
              onClick={toggleDefaultBackground}
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              style={{
                borderColor: isDefaultHidden ? 'var(--terminal-highlight)' : 'var(--terminal-subtle)',
                color: isDefaultHidden ? 'var(--terminal-highlight)' : 'var(--terminal-text)'
              }}
              data-testid="button-toggle-default-bg"
            >
              {isDefaultHidden ? (
                <>
                  <Eye className="w-4 h-4" />
                  Show Default
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Default
                </>
              )}
            </Button>
          </div>
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
          
          {wallpapers.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--terminal-subtle)' }}>
              No wallpapers uploaded yet. Drop some images above to get started!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {wallpapers.map((wallpaper) => (
                <div
                  key={wallpaper.id}
                  className="relative group cursor-pointer"
                  style={{
                    border: selectedWallpaper === wallpaper.url ? '2px solid var(--terminal-highlight)' : '1px solid var(--terminal-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => selectWallpaper(wallpaper)}
                    className="aspect-video bg-cover bg-center"
                    style={{ backgroundImage: `url(${wallpaper.url})` }}
                  />
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWallpaper(wallpaper.id);
                      }}
                      size="sm"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

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
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--terminal-highlight)' }}
                    >
                      <span className="text-xs font-bold" style={{ color: 'var(--terminal-bg)' }}>✓</span>
                    </div>
                  )}
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
            <li>• Upload up to 10 wallpapers to your library</li>
            <li>• Click a wallpaper to set it as your terminal background</li>
            <li>• Hover over a wallpaper and click the trash icon to delete it</li>
            <li>• Your wallpapers are saved in browser storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
