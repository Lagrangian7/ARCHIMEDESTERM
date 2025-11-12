
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, Trash2 } from 'lucide-react';

interface BackgroundManagerProps {
  onClose: () => void;
  onBackgroundChange: (imageUrl: string) => void;
}

interface WallpaperSlot {
  id: string;
  url: string;
  name: string;
}

export function BackgroundManager({ onClose, onBackgroundChange }: BackgroundManagerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [wallpapers, setWallpapers] = useState<WallpaperSlot[]>([]);
  const [selectedWallpaper, setSelectedWallpaper] = useState<string>('');

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
    setSelectedWallpaper(wallpaper.url);
    localStorage.setItem('terminal-background-url', wallpaper.url);
    // Force immediate update
    onBackgroundChange(wallpaper.url);
    // Trigger a custom event to notify Terminal of background change
    window.dispatchEvent(new CustomEvent('terminal-background-change', { detail: wallpaper.url }));
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
    onBackgroundChange('');
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
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              as="span"
              size="sm"
              style={{
                backgroundColor: 'var(--terminal-highlight)',
                color: 'var(--terminal-bg)'
              }}
            >
              Browse Files
            </Button>
          </label>
          <p className="text-xs mt-4" style={{ color: 'var(--terminal-subtle)' }}>
            {wallpapers.length}/10 slots used
          </p>
        </div>

        {/* Current Background Info */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--terminal-subtle)' }}>
              Current Background: {selectedWallpaper ? '✓ Active' : 'None'}
            </p>
          </div>
          {selectedWallpaper && (
            <Button
              onClick={clearBackground}
              size="sm"
              variant="outline"
              style={{
                borderColor: 'var(--terminal-subtle)',
                color: 'var(--terminal-text)'
              }}
            >
              Clear Background
            </Button>
          )}
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
