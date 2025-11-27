
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Trash2, ImageOff } from 'lucide-react';
import wallpaperImage from '../assets/terminal-bg-new.png';

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
  isBuiltIn?: boolean;
}

export function BackgroundManager({ onClose, onBackgroundChange }: BackgroundManagerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [wallpapers, setWallpapers] = useState<WallpaperSlot[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('');

  // Built-in wallpaper
  const builtInWallpaper: WallpaperSlot = {
    id: 'built-in-wallpaper',
    url: wallpaperImage,
    name: 'Default Terminal Background',
    isBuiltIn: true
  };

  // Load wallpapers from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('terminal-wallpapers');
    let userWallpapers: WallpaperSlot[] = [];
    
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        userWallpapers = parsed.filter((w: WallpaperSlot) => !w.isBuiltIn);
      } catch (e) {
        console.error('Failed to load wallpapers:', e);
      }
    }

    // Always include built-in wallpaper as first item
    setWallpapers([builtInWallpaper, ...userWallpapers]);

    const currentBg = localStorage.getItem('terminal-background-url');
    if (currentBg) {
      setSelectedWallpaper(currentBg);
    }
  }, []);

  // Save wallpapers to localStorage whenever they change (exclude built-in)
  useEffect(() => {
    const userWallpapers = wallpapers.filter(w => !w.isBuiltIn);
    if (userWallpapers.length > 0 || wallpapers.some(w => w.isBuiltIn)) {
      localStorage.setItem('terminal-wallpapers', JSON.stringify(userWallpapers));
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

    // Limit to 10 wallpapers (9 user + 1 built-in)
    const userWallpapers = wallpapers.filter(w => !w.isBuiltIn);
    const availableSlots = 9 - userWallpapers.length;
    if (availableSlots === 0) {
      alert('Maximum 9 custom wallpapers allowed (plus 1 built-in). Please delete some to add new ones.');
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

    const userWallpapers = wallpapers.filter(w => !w.isBuiltIn);
    const availableSlots = 9 - userWallpapers.length;
    if (availableSlots === 0) {
      alert('Maximum 9 custom wallpapers allowed (plus 1 built-in). Please delete some to add new ones.');
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
    console.log('Wallpaper URL type:', wallpaper.url.startsWith('data:') ? 'base64 data URL' : 'regular URL');
    console.log('URL length:', wallpaper.url.length);
    
    // Use the original URL (data URLs don't need cache busting)
    const imageUrl = wallpaper.url;
    
    // Update local state
    setSelectedWallpaper(imageUrl);
    
    // Save to localStorage (without cache busting for data URLs)
    try {
      localStorage.setItem('terminal-background-url', imageUrl);
      console.log('Saved to localStorage successfully');
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
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

  const deleteWallpaper = (id: string) => {
    // Prevent deleting built-in wallpaper
    const wallpaper = wallpapers.find(w => w.id === id);
    if (wallpaper?.isBuiltIn) {
      return;
    }

    setWallpapers(prev => {
      const updated = prev.filter(w => w.id !== id);
      
      // If we deleted the current wallpaper, clear the background
      const deletedWallpaper = prev.find(w => w.id === id);
      if (deletedWallpaper && deletedWallpaper.url === selectedWallpaper) {
        setSelectedWallpaper('');
        localStorage.removeItem('terminal-background-url');
        onBackgroundChange('');
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
            {wallpapers.filter(w => !w.isBuiltIn).length}/9 custom slots used (1 built-in included)
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
                  
                  {/* Built-in badge */}
                  {wallpaper.isBuiltIn && (
                    <div 
                      className="absolute top-1 left-1 px-2 py-1 rounded text-xs font-bold"
                      style={{ 
                        backgroundColor: 'var(--terminal-highlight)',
                        color: 'var(--terminal-bg)'
                      }}
                    >
                      Built-in
                    </div>
                  )}

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
            <li>• Upload up to 9 custom wallpapers (1 built-in included for total of 10)</li>
            <li>• Click a wallpaper to set it as your terminal background</li>
            <li>• Images automatically fit to screen while maintaining aspect ratio</li>
            <li>• Hover over custom wallpapers and click trash icon to delete</li>
            <li>• Your wallpapers are saved in browser storage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
